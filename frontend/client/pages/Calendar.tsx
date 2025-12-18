import React, { useEffect, useState } from "react";
import { formatDateLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell } from "lucide-react";
import DashboardBanner from "@/components/ui/dashboard-banner";
import { useNavigate } from "react-router-dom";

type EventItem = {
  id: number;
  status?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  room?: any;
  room_name?: string | null;
  course?: any;
  course_name?: string | null;
  title?: string;
  event_type?: string;
  location?: string;
  notes?: string;
  tutor_name?: string | null;
};

export default function CalendarPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = (import.meta as any).env.VITE_API_BASE || "http://localhost:8000";

  const getMonthMatrix = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstOfMonth = new Date(year, month, 1);
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

  const fmtTime = (t: any) => {
    if (!t) return "";
    if (typeof t === "string") return t.length >= 5 ? t.slice(0,5) : t;
    try { return t.toString().slice(0,5); } catch { return String(t); }
  };

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/calendar/scheduledevents/`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        console.log("Fetched events raw:", data);
        if (!mounted) return;
        // normalize to array of events
        const normalized = Array.isArray(data) ? data : (data.results || []);
        setEvents(normalized);
      } catch (err: any) {
        setError(String(err));
        console.warn("Failed to fetch /scheduledevents/, trying /events/:", err);
        // fallback: try a shorter path
        try {
          const res2 = await fetch(`${API_BASE}/calendar/events/`);
          if (res2.ok) {
            const d2 = await res2.json();
            console.log("Fetched events fallback:", d2);
            if (mounted) setEvents(Array.isArray(d2) ? d2 : (d2.results || []));
            setError(null);
          }
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvents();
    return () => { mounted = false; };
  }, []);

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
              <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/calendar')}>
                <CalendarIcon className="mr-2 h-4 w-4" /> Calendar
              </Button>
              <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/create') }>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Event
              </Button>
              <Button variant="ghost" className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-black hover:text-white" onClick={() => navigate('/approve') }>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Approve Events
              </Button>
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

      <div className="flex-1 p-0 flex flex-col items-stretch min-h-0">

        <div className="flex gap-6 flex-1 min-h-0">
          <div className="w-2/3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft />
                </Button>
                <div className="px-3 text-sm font-medium">
                  {displayMonth.toLocaleString(undefined, { month: "long" })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 text-sm font-medium">{displayMonth.getFullYear()}</div>
                <Button
                  variant="ghost"
                  onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow flex-1 min-h-0 overflow-auto">
              <div className="mb-4">
                <div className="text-sm text-gray-700">&nbsp;</div>
              </div>

              {(() => {
                const weeks = getMonthMatrix(displayMonth);
                const weekdayLetters = ["S", "M", "T", "W", "T", "F", "S"];
                return (
                  <div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
                      {weekdayLetters.map((w, i) => (
                        <div key={`${w}-${i}`} className="py-1">
                          {w}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-sm text-gray-700">
                      {weeks.flat().map((day, idx) => {
                        const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                        const dayStr = formatDateLocal(day);
                        const eventsForDay = events.filter((ev) => ev && ev.date === dayStr && ev.status !== 'rejected');
                        const isSelected = selected && formatDateLocal(selected) === dayStr;
                        return (
                          <button
                            key={dayStr + "-" + idx}
                            onClick={() => setSelected(new Date(day))}
                            className={`relative p-2 h-14 flex flex-col items-start overflow-hidden ${isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"} ${isSelected ? "ring-2 ring-blue-500 rounded-md" : ""}`}
                          >
                            <div className="w-full flex items-start justify-between">
                              <div className="text-sm font-medium">{day.getDate()}</div>
                            </div>
                            {/* event indicator (small blue circle) */}
                            {eventsForDay.length > 0 && (
                              <div className="absolute bottom-1 right-1 w-3 h-3 bg-blue-500 rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <aside className="w-1/3 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-2xl shadow flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Events</h3>
                <div className="flex items-center gap-3">
                  {loading && <div className="text-sm text-gray-500">Loading…</div>}
                  {error && <div className="text-sm text-red-500">Error fetching events</div>}
                  <div className="text-sm text-gray-500">{selected ? selected.toLocaleDateString() : ""}</div>
                </div>
              </div>

              <div>
                {selected ? (
                  (() => {
                    const dayStr = formatDateLocal(selected as Date);
                    const list = events.filter((e) => e.date === dayStr);
                    if (list.length === 0) return <div className="text-sm text-gray-500">No events for this date.</div>;
                    return (
                      <div className="space-y-3">
                        {list.map((e) => (
                          <div key={e.id} className="p-3 border border-gray-100 rounded-md">
                            <div className="flex justify-between items-center">
                              <div className="font-medium">{e.title || e.course_name || `Event ${e.id}`}</div>
                              <div className="text-xs text-gray-500">{fmtTime(e.start_time)} - {fmtTime(e.end_time)}</div>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {e.course_name && <span>{e.course_name}</span>}
                              {e.room_name && <span className="ml-2">· {e.room_name}</span>}
                              {e.tutor_name && <span className="ml-2">· {e.tutor_name}</span>}
                              {e.status && <span className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-100">{e.status}</span>}
                            </div>
                            <div className="text-sm text-gray-700 mt-2">{e.event_type || ''}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-gray-500">Select a date to see events.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
