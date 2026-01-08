import React, { useEffect, useState } from "react";
import { getLocalProfile } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Bell, ChevronLeft, Check, X, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function ApproveEvents() {
  const [events, setEvents] = useState<Array<any>>([]);
  const navigate = useNavigate();
  const API_BASE = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        
        const res = await fetch(`${API_BASE}/api/calendar/scheduledevents/`, { headers });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.results || []);
        if (mounted) setEvents(arr);
      } catch (err) {
        // fallback to localStorage if backend not available
        const raw = localStorage.getItem("events");
        const arr = raw ? JSON.parse(raw) : [];
        if (mounted) setEvents(arr);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handler = () => {
      const raw = localStorage.getItem("events");
      const arr = raw ? JSON.parse(raw) : [];
      setEvents(arr);
    };
    window.addEventListener("events:changed", handler);
    return () => window.removeEventListener("events:changed", handler);
  }, []);

  const updateStatus = async (id: number, status: string) => {
    console.debug("updateStatus called", { id, status });
    const token = localStorage.getItem("accessToken");
    const event = events.find(e => e.id === id);
    // optimistic local update
    const newArr = events.map((e) => (e.id === id ? { ...e, status } : e));
    setEvents(newArr);
    try {
      if (!token) throw new Error("No auth token");
      const res = await fetch(`${API_BASE}/api/calendar/${status === 'approved' ? 'approve' : 'reject'}/${id}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        console.warn("approve/reject request failed", { status: res.status, statusText: res.statusText, body: txt });
        throw new Error(`${res.status} ${res.statusText}`);
      }
      // on success, persist the optimistic update to localStorage so other listeners don't overwrite
      try {
        localStorage.setItem("events", JSON.stringify(newArr));
      } catch {}
      try { window.dispatchEvent(new Event("events:changed")); } catch { }
    } catch (err) {
      console.error("Failed to update status on server, falling back to localStorage:", err);
      // fallback: persist to localStorage but preserve in-memory events if localStorage empty
      const raw = localStorage.getItem("events");
      const arr = raw ? JSON.parse(raw) : events;
      const newArr = arr.map((ev: any) => (ev.id === id ? { ...ev, status } : ev));
      try { localStorage.setItem("events", JSON.stringify(newArr)); } catch { }
      setEvents(newArr);
      try { window.dispatchEvent(new Event("events:changed")); } catch { }
    }
  };

  const pending = events.filter((e) => e.status === undefined || e.status === "pending");

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />

      <main className="w-full self-start flex flex-col h-full min-h-0 overflow-auto">
        <div className="mb-6">
          <header className="rounded-2xl bg-gradient-to-r from-white via-sky-50 to-white p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Approve Events</h1>
                <p className="mt-1 text-sm text-gray-500">Review and approve or reject pending event requests.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs text-gray-500">Pending</span>
                  <span className="text-lg font-semibold text-gray-900">{pending.length}</span>
                </div>
                <div>
                  <Button variant="outline" className="hidden sm:inline-flex" onClick={() => window.location.reload()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </header>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow flex-1">
          {pending.length === 0 ? (
            <div className="text-sm text-gray-500">No pending events.</div>
          ) : (
            <div className="space-y-4 max-h-[55vh] overflow-auto pr-2">
              {pending.map((e) => (
                <article key={e.id} className="relative bg-white p-4 rounded-lg shadow-md border border-gray-100 hover:shadow-lg transition-shadow flex gap-4">
                  <div className="w-1 rounded-l-lg" style={{ background: 'linear-gradient(180deg, #06b6d4, #60a5fa)' }} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{e.title || 'Untitled'}</h3>
                        <div className="mt-1 text-sm text-gray-500">{e.date} · {e.startHour} - {e.endHour}</div>
                        <div className="mt-2 text-sm text-gray-600">{e.location}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">Course: {e.course}</span>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">Tutor: {e.tutor}</span>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">Pending</span>
                        </div>
                        {e.notes && <p className="mt-3 text-sm text-gray-700">{e.notes}</p>}
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-sm text-gray-500">Requested</div>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label="Reject" title="Reject" onClick={(ev) => { ev.preventDefault(); updateStatus(e.id, 'rejected'); }} className="inline-flex items-center justify-center w-9 h-9 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition">
                            <X className="w-4 h-4" />
                          </button>
                          <button type="button" aria-label="Approve" title="Approve" onClick={(ev) => { ev.preventDefault(); updateStatus(e.id, 'approved'); }} className="inline-flex items-center justify-center w-9 h-9 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
