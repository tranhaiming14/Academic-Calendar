import React, { useEffect, useState } from "react";
import { getLocalProfile } from "@/lib/profileService";
import { formatDateLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell, User } from "lucide-react";
import DashboardBanner from "@/components/ui/dashboard-banner";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

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
  const navigate = useNavigate();
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date();
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay()); // start on Sunday
    s.setHours(0,0,0,0);
    return s;
  });
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedLecturer, setSelectedLecturer] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  // Set default export dates when opening (start/end of current month)
  useEffect(() => {
    if (exportOpen) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setExportStart(formatDateLocal(start));
      setExportEnd(formatDateLocal(end));
    }
  }, [exportOpen]);

  // Derived lists and filtered events
  const lecturers: string[] = Array.from(new Set(events.map((e) => e.tutor_name).filter((x): x is string => !!x)));
  const courses: string[] = Array.from(new Set(events.map((e) => e.course_name).filter((x): x is string => !!x)));
  const filteredEvents = events.filter((e) => {
    if (selectedLecturer && e.tutor_name !== selectedLecturer) return false;
    if (selectedCourse && e.course_name !== selectedCourse) return false;
    return true;
  });

  const handleExport = async () => {
    if (!exportStart || !exportEnd) {
      alert("Please select start and end dates");
      return;
    }
    const token = localStorage.getItem("accessToken");
    const url = `${API_BASE}/api/calendar/export/?start=${exportStart}&end=${exportEnd}`;

    try {
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Export failed: ${res.status} ${res.statusText} - ${txt}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `calendar_export_${exportStart}_${exportEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to export calendar");
    }
  };

  const getWeekDays = (start: Date) => {
    const days: Date[] = [];
    const s = new Date(start);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(s));
      s.setDate(s.getDate() + 1);
    }
    return days;
  };

  const API_BASE = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";

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
    if (typeof t === "string") return t.length >= 5 ? t.slice(0, 5) : t;
    try { return t.toString().slice(0, 5); } catch { return String(t); }
  };

  const colorForType = (t?: string) => {
    const def = { dot: 'bg-blue-500', block: 'bg-blue-600 text-white' };
    if (!t) return def;
    const s = t.toLowerCase();
    if (s.includes('exam')) return { dot: 'bg-red-500', block: 'bg-red-600 text-white' };
    if (s.includes('lab')) return { dot: 'bg-yellow-400', block: 'bg-yellow-300 text-black' };
    // default = normal lecture
    return def;
  };

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("accessToken");
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        console.log("Token exists:", !!token, "Token length:", token?.length);
        console.log("Headers being sent:", headers);
        console.log("API_BASE:", API_BASE);
        console.log("Full URL:", `${API_BASE}/api/calendar/scheduledevents/`);
        const res = await fetch(`${API_BASE}/api/calendar/scheduledevents/`, { headers });
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
          const token = localStorage.getItem("accessToken");
          const headers: any = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          
          const res2 = await fetch(`${API_BASE}/api/calendar/events/`, { headers });
          if (res2.ok) {
            const d2 = await res2.json();
            console.log("Fetched events fallback:", d2);
            if (mounted) setEvents(Array.isArray(d2) ? d2 : (d2.results || []));
            setError(null);
          }
        } catch { }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvents();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex gap-6 flex-1 min-h-0">
          <div className={`${viewMode === 'week' ? 'w-full' : 'w-2/3'} flex flex-col min-h-0 ${loading ? 'relative' : ''}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-4">
                {viewMode === 'month' ? (
                  <>
                    <Button variant="ghost" onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}>
                      <ChevronLeft />
                    </Button>
                    <div className="px-3 text-sm font-medium whitespace-nowrap">
                      {displayMonth.toLocaleString('en-US', { month: "long" })} {displayMonth.getFullYear()}
                    </div>
                    <Button variant="ghost" onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}>
                      <ChevronRight />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7))}>
                      <ChevronLeft />
                    </Button>
                    <div className="px-3 text-sm font-medium">
                      Week of {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <Button variant="ghost" onClick={() => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7))}>
                      <ChevronRight />
                    </Button>
                  </>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Select value={selectedLecturer ?? "__all__"} onValueChange={(v) => setSelectedLecturer(v === "__all__" ? null : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Lecturers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Lecturers</SelectItem>
                    {lecturers.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCourse ?? "__all__"} onValueChange={(v) => setSelectedCourse(v === "__all__" ? null : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Courses</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={viewMode} onValueChange={(value: 'month' | 'week') => {
                  if (value === 'month') {
                    setViewMode('month');
                  } else {
                    setViewMode('week');
                    const now = new Date();
                    const s = new Date(now);
                    s.setDate(now.getDate() - now.getDay());
                    s.setHours(0,0,0,0);
                    setWeekStart(s);
                  }
                }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                </SelectContent>
                </Select>
                <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Export Calendar</DialogTitle>
                      <DialogDescription>
                        Select a date range to export events to CSV.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="start" className="text-right">
                          Start
                        </Label>
                        <Input
                          id="start"
                          type="date"
                          value={exportStart}
                          onChange={(e) => setExportStart(e.target.value)}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="end" className="text-right">
                          End
                        </Label>
                        <Input
                          id="end"
                          type="date"
                          value={exportEnd}
                          onChange={(e) => setExportEnd(e.target.value)}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleExport}>Download CSV</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow flex-1 min-h-0 overflow-auto">
              {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                  <div className="flex flex-col items-center">
                    <div role="status" aria-label="Loading events" className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <div className="mt-3 text-sm text-gray-700">Loading events…</div>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <div className="text-sm text-gray-700">&nbsp;</div>
              </div>

              {viewMode === 'month' ? (
                (() => {
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
                          const eventsForDay = filteredEvents.filter((ev) => ev && ev.date === dayStr && ev.status !== 'rejected');
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
                              {/* event indicators by type (small colored dots) */}
                              {eventsForDay.length > 0 && (
                                <div className="absolute bottom-1 right-1 flex items-center gap-1">
                                  {Array.from(new Set(eventsForDay.map(ev => (ev.event_type || 'lecture').toLowerCase()))).slice(0,3).map((typ) => {
                                    const cls = colorForType(typ).dot;
                                    return <span key={typ} className={`${cls} w-3 h-3 rounded-full`} />;
                                  })}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  // week view
                  const days = getWeekDays(weekStart);
                  const startHour = 6;
                  const endHour = 22;
                  const hourCount = endHour - startHour;
                  const pxPerMinute = 1; // 1px per minute -> hour = 60px
                  const containerHeight = hourCount * 60; // px

                  const now = new Date();
                  const todayStr = formatDateLocal(now);

                  return (
                    <div className="w-full">
                      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
                        {days.map((d) => (
                          <div key={d.toISOString()} className="py-1 font-medium">
                            <div className="text-sm">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                            <div className="text-xs text-gray-500">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {/* times column */}
                        <div className="w-16 text-xs text-gray-500">
                          <div style={{ height: 24 }} />
                          <div style={{ height: containerHeight, position: 'relative' }}>
                            {Array.from({ length: hourCount }).map((_, i) => {
                              const h = startHour + i;
                              return (
                                <div key={i} className="h-16 border-t border-gray-100 flex items-start pr-1" style={{ height: 60 }}>
                                  <div className="text-xs text-right w-full pr-2">{String(h).padStart(2,'0')}:00</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* days columns */}
                        <div className="flex-1 grid grid-cols-7 gap-2 overflow-auto">
                          {days.map((d) => {
                            const dayStr = formatDateLocal(d);
                            const dayEvents = filteredEvents.filter((ev) => ev && ev.date === dayStr && ev.status !== 'rejected');
                            return (
                              <div key={dayStr} className="relative bg-white border rounded-md" style={{ minHeight: containerHeight }}>
                                <div style={{ position: 'relative', height: containerHeight }}>
                                  {dayEvents.map((ev: any) => {
                                    // parse times
                                    const parseTime = (t: string) => {
                                      const [hh, mm] = (t || '00:00').split(':').map((x: string) => parseInt(x, 10));
                                      return hh * 60 + mm;
                                    };
                                    const evStart = parseTime(ev.start_time || '00:00');
                                    const evEnd = parseTime(ev.end_time || ev.start_time || '00:00');
                                    const topMinutes = Math.max(0, evStart - startHour * 60);
                                    const duration = Math.max(15, evEnd - evStart);
                                    const top = topMinutes * pxPerMinute;
                                    const height = duration * pxPerMinute;
                                    const colorCls = colorForType(ev.event_type).block;
                                    return (
                                      <div key={ev.id} className={`${colorCls} absolute left-1 right-1 rounded-md p-2 text-[12px] shadow overflow-hidden`} style={{ top: top, height: height }}>
                                        <div className="font-semibold text-sm leading-tight truncate">{ev.title || ev.course_name || `Event ${ev.id}`}</div>
                                        <div className="text-[11px] leading-tight">{fmtTime(ev.start_time)} - {fmtTime(ev.end_time)}</div>
                                        {ev.course_name && <div className="text-[11px] leading-tight">{ev.course_name}{ev.event_type ? ` • ${ev.event_type}` : ''}</div>}
                                        {ev.tutor_name && <div className="text-[11px] leading-tight">Instructor: {ev.tutor_name}</div>}
                                        {ev.room_name && <div className="text-[11px] leading-tight">Room: {ev.room_name}</div>}
                                        {ev.notes && <div className="text-[11px] truncate">{ev.notes}</div>}
                                        {ev.status && <div className="mt-1 inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/20">{ev.status}</div>}
                                      </div>
                                    );
                                  })}

                                  {/* current time indicator */}
                                  {formatDateLocal(d) === todayStr && (() => {
                                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                                    const relative = nowMinutes - startHour * 60;
                                    if (relative >= 0 && relative <= hourCount * 60) {
                                      return (
                                        <div key={`now-${dayStr}`} style={{ position: 'absolute', top: relative * pxPerMinute, left: 0, right: 0 }}>
                                          <div className="h-[2px] bg-red-500 w-full" />
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {viewMode === 'month' && (
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
                      const list = filteredEvents.filter((e) => e.date === dayStr);
                      if (list.length === 0) return <div className="text-sm text-gray-500">No events for this date.</div>;
                      return (
                        <div className="space-y-3">
                          {list.map((e) => (
                            <div key={e.id} className="p-4 border border-gray-200 rounded-lg bg-gradient-to-br from-blue-50 to-white hover:shadow-md transition-shadow">
                              <div className="font-semibold text-gray-900 text-base mb-2">{e.title || e.course_name || `Event ${e.id}`}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                {e.course_name && e.event_type && `${e.course_name} - ${e.event_type}`}
                                {e.course_name && !e.event_type && e.course_name}
                                {!e.course_name && e.event_type && e.event_type}
                              </div>
                              <div className="text-sm text-gray-700 mb-2">
                                <span className="font-medium">Time:</span> {fmtTime(e.start_time)} - {fmtTime(e.end_time)}
                              </div>
                              {e.tutor_name && <div className="text-sm text-gray-600">Lecturer: {e.tutor_name}</div>}
                              {e.room_name && <div className="text-xs text-gray-500 mt-2">Room: {e.room_name}</div>}
                              {e.status && <div className="mt-2 inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{e.status}</div>}
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
          )}
        </div>
      </main>
    </div>
  );
}
