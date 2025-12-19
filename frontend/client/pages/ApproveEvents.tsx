import React, { useEffect, useState } from "react";
import { getLocalProfile } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Bell, ChevronLeft, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ApproveEvents() {
  const [events, setEvents] = useState<Array<any>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const API_BASE = (import.meta as any).env.VITE_API_BASE || "http://localhost:8000";

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/calendar/scheduledevents/`);
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
    const token = localStorage.getItem("accessToken");
    // optimistic local update
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    try {
      if (!token) throw new Error("No auth token");
      const res = await fetch(`${API_BASE}/calendar/${status === 'approved' ? 'approve' : 'reject'}/${id}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      // refresh list from server
      const fresh = await fetch(`${API_BASE}/calendar/scheduledevents/`);
      if (fresh.ok) {
        const d = await fresh.json();
        const arr = Array.isArray(d) ? d : (d.results || []);
        setEvents(arr);
        try { window.dispatchEvent(new Event("events:changed")); } catch {}
      }
    } catch (err) {
      console.error("Failed to update status on server, falling back to localStorage:", err);
      // fallback: persist to localStorage
      const raw = localStorage.getItem("events");
      const arr = raw ? JSON.parse(raw) : [];
      const newArr = arr.map((e: any) => (e.id === id ? { ...e, status } : e));
      localStorage.setItem("events", JSON.stringify(newArr));
      setEvents(newArr);
      try { window.dispatchEvent(new Event("events:changed")); } catch {}
    }
  };

  const pending = events.filter((e) => e.status === undefined || e.status === "pending");

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <div className="hidden md:block">
        <aside className={`bg-white border-r border-gray-200 sticky top-0 h-screen p-3 flex flex-col transition-all duration-300 ease-in-out transform ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                aria-label={sidebarCollapsed ? 'Open sidebar' : 'Logo'}
                onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </button>
              <div className={`font-bold text-xl tracking-tight transition-all duration-300 transform ${sidebarCollapsed ? 'opacity-0 -translate-x-2 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                CalendarApp
              </div>
            </div>
            {!sidebarCollapsed && (
              <button
                aria-label="Collapse sidebar"
                onClick={() => setSidebarCollapsed(true)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          <div className={`mt-4 flex-1 flex flex-col gap-4 transition-all duration-300 transform ${sidebarCollapsed ? 'opacity-0 -translate-x-2 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
            <nav className="flex flex-col gap-1 px-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Schedule
              </h3>
              {(() => {
                const profile = getLocalProfile();
                const role = profile?.role;
                const showCreate = role === "academic_assistant" || role === "administrator";
                const showApprove = role === "department_assistant" || role === "administrator";
                return (
                  <>
                    <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/calendar')}>
                      <CalendarIcon className="mr-2 h-4 w-4" /> Calendar
                    </Button>
                    {showCreate && (
                      <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/create') }>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Event
                      </Button>
                    )}
                    {showApprove && (
                      <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/approve') }>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Approve Events
                      </Button>
                    )}
                  </>
                );
              })()}
              <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white">
                <Bell className="mr-2 h-4 w-4" /> Reminders
              </Button>
            </nav>

            <div className="mt-auto bg-gray-50 p-4 rounded-xl border border-gray-100 px-1">
              <div className="flex justify-between items-center mb-4 font-semibold text-sm">
                <span>November</span>
                <span className="text-gray-500">2025</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-700">
                <div className="p-1"></div><div className="p-1"></div><div className="p-1">1</div>
                <div className="p-1">2</div><div className="p-1 bg-black text-white rounded-full">3</div><div className="p-1">4</div><div className="p-1">5</div>
                <div className="p-1">6</div><div className="p-1">7</div><div className="p-1">8</div><div className="p-1">9</div>
                <div className="p-1">10</div><div className="p-1">11</div><div className="p-1">12</div><div className="p-1">13</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="w-full self-start flex flex-col h-full min-h-0 overflow-auto">
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
                          <button aria-label="Reject" title="Reject" onClick={() => updateStatus(e.id, 'rejected')} className="inline-flex items-center justify-center w-9 h-9 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition">
                            <X className="w-4 h-4" />
                          </button>
                          <button aria-label="Approve" title="Approve" onClick={() => updateStatus(e.id, 'approved')} className="inline-flex items-center justify-center w-9 h-9 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition">
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
      </div>
    </div>
  );
}
