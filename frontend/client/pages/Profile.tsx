import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Bell, Mail, Shield, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateLocal } from "@/lib/utils";
import { getProfile, updateProfile, clearLocalProfile, getLocalProfile } from "@/lib/profileService";
// calendar grid is implemented inline to keep frontend-only behavior
import CreateEvents from "./CreateEvents";
import DashboardBanner from "@/components/ui/dashboard-banner";
import Sidebar from "@/components/Sidebar";

export default function Profile() {

    const [user, setUser] = useState<{ username: string; email: string; role: string; contactNumber?: string } | null>(null);
    const [viewMode, setViewMode] = useState<"profile" | "calendar" | "create" | "approve">("profile");
    const navigate = useNavigate();
    const [selected, setSelected] = useState<Date | undefined>(undefined);
    const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
    const [events, setEvents] = useState<Array<any>>([]);
    const [editMode, setEditMode] = useState(false);
    const [editUsername, setEditUsername] = useState("");
    const [editContact, setEditContact] = useState("");

    // generate a 6x7 matrix of Date objects covering the calendar view
    const getMonthMatrix = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);

        // start from the Sunday of the week containing the 1st
        const start = new Date(firstOfMonth);
        start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

        const matrix: Date[][] = [];
        let cur = new Date(start);
        for (let week = 0; week < 6; week++) {
            const row: Date[] = [];
            for (let d = 0; d < 7; d++) {
                row.push(new Date(cur));
                cur.setDate(cur.getDate() + 1);
            }
            matrix.push(row);
        }
        return matrix;
    };

    useEffect(() => {
        const loadEvents = () => {
            const raw = localStorage.getItem("events");
            const arr = raw ? JSON.parse(raw) : [];
            setEvents(arr);
        };
        loadEvents();
        const handler = () => loadEvents();
        window.addEventListener('events:changed', handler);
        return () => window.removeEventListener('events:changed', handler);
    }, []);

    useEffect(() => {
        const load = async () => {
            const data = await getProfile();
            if (!data) {
                // frontend-only demo profile when no backend/auth
                setUser({ username: "Demo User", email: "demo@example.com", role: "User" });
                return;
            }
            setUser(data);
        };
        load();
    }, []);

    const handleEdit = () => {
        if (!user) return;
        setEditUsername(user.username);
        setEditContact(user.contactNumber || "");
        setEditMode(true);
    };

    const handleCancel = () => {
        setEditMode(false);
    };

    const handleSave = async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            clearLocalProfile();
            navigate('/auth/login');
            return;
        }
        try {
            const updated = await updateProfile(token, { username: editUsername, contactNumber: editContact || undefined });
            setUser(updated);
            setEditMode(false);
        } catch (err) {
            console.error(err);
            // on error, keep edit mode so user can retry
        }
    };

    const handleLogout = () => {
        clearLocalProfile();
        try { navigate('/auth/login'); } catch (err) { /* ignore */ }
    };

    useEffect(() => {
        if (viewMode === 'calendar') {
            try { navigate('/calendar'); } catch (err) { /* ignore */ }
        }
        if (viewMode === 'create') {
            try { navigate('/create'); } catch (err) { /* ignore */ }
        }
        if (viewMode === 'approve') {
            try { navigate('/approve'); } catch (err) { /* ignore */ }
        }
    }, [viewMode, navigate]);

    const updateEventStatus = (id: number, status: string) => {
        const raw = localStorage.getItem("events");
        const arr = raw ? JSON.parse(raw) : [];
        const newArr = arr.map((e: any) => (e.id === id ? { ...e, status } : e));
        localStorage.setItem("events", JSON.stringify(newArr));
        setEvents(newArr);
        try {
            window.dispatchEvent(new Event('events:changed'));
        } catch (err) { /* ignore */ }
    };

    const isLoading = !user;

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Sidebar - collapsible on md+ with smooth animation */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 p-0 flex flex-col items-stretch min-h-0">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="bg-white p-6 rounded-2xl shadow text-center">
                            <div className="text-lg font-medium">Loading profile…</div>
                            <div className="text-sm text-gray-500 mt-2">Please wait while we load your data.</div>
                        </div>
                    </div>
                ) : viewMode === "profile" ? (
                    <Card className="w-full h-full shadow-2xl border-0 overflow-hidden rounded-2xl">
                        <div className="h-28 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                        <CardContent className="pt-0 relative px-8 pb-12 h-full flex flex-col items-stretch">
                            {/* Avatar overlapping */}
                            {/* Top-right circular logo (cropped by rounded-full) */}
                            <img
                                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsOL1koVOg5bTb4jxMIA_t92WJytDYA1xGGw&s"
                                alt="Logo"
                                className="absolute -top-24 right-6 w-48 h-48 rounded-full object-cover shadow-md ring-4 ring-white bg-transparent"
                            />

                            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                                <Avatar className="w-24 h-24 ring-4 ring-white shadow-md">
                                    <AvatarFallback>{user.username?.charAt(0).toUpperCase() ?? "D"}</AvatarFallback>
                                </Avatar>
                            </div>

                            <div className="mt-12 text-center space-y-4">
                                {/* Username */}
                                <div>
                                    {editMode ? (
                                        <div className="space-y-2">
                                            <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-72 mx-auto block px-3 py-2 border rounded-md" />
                                            <input value={editContact} onChange={(e) => setEditContact(e.target.value)} placeholder="Contact number" className="w-72 mx-auto block px-3 py-2 border rounded-md" />
                                        </div>
                                    ) : (
                                        <>
                                            <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
                                            <div className="mt-2">
                                                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors uppercase">
                                                    <Shield className="w-3 h-3 mr-1 inline" />
                                                    {user.role}
                                                </Badge>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Email */}
                                <div className="flex items-center justify-center space-x-2 text-gray-500 bg-gray-50 py-2 px-4 rounded-full mx-auto w-max shadow-sm">
                                    <Mail className="w-4 h-4" />
                                    <span className="font-medium">{user.email}</span>
                                </div>
                                {/* Action buttons */}
                                <div className="mt-4 flex items-center justify-center gap-3">
                                    {!editMode ? (
                                        <>
                                            <Button variant="default" className="px-4 py-2" onClick={handleEdit}>Edit</Button>
                                            <Button variant="outline" className="px-4 py-2" onClick={handleLogout}>Logout</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="default" className="px-4 py-2" onClick={handleSave}>Save</Button>
                                            <Button variant="ghost" className="px-4 py-2" onClick={handleCancel}>Cancel</Button>
                                            <Button variant="outline" className="px-4 py-2" onClick={handleLogout}>Logout</Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : viewMode === "calendar" ? (
                    <div className="flex-1 p-6">
                        <div className="text-sm text-gray-600">Redirecting to calendar...</div>
                    </div>
                ) : viewMode === "create" ? (
                    <div className="flex-1 p-6">
                        <div className="text-sm text-gray-600">Redirecting to Create Event page...</div>
                    </div>
                ) : viewMode === "approve" ? (
                    <div className="flex-1 p-6">
                        <div className="text-sm text-gray-600">Redirecting to Approve Events page...</div>
                    </div>
                ) : (
                    <div className="w-full max-w-3xl">
                        <CreateEvents />
                    </div>
                )}
            </main>
        </div>
    );
}
