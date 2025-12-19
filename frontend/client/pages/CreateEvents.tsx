import React, { useEffect, useMemo, useState } from "react";
import { getLocalProfile } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Bell, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardBanner from "@/components/ui/dashboard-banner";

type CreateEventFormProps = {
  onDone?: () => void;
};

function CreateEventForm({ onDone }: CreateEventFormProps) {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState("");
  const [coursesList, setCoursesList] = useState<Array<any>>([]);
  const [course, setCourse] = useState<string>("");
  const [tutorsList, setTutorsList] = useState<Array<any>>([]);
  const [tutor, setTutor] = useState<string>("");
  const [eventType, setEventType] = useState<string>("");
  const [startHour, setStartHour] = useState<string>("");
  const [startMinute, setStartMinute] = useState<string>("00");
  const [endHour, setEndHour] = useState<string>("");
  const [endMinute, setEndMinute] = useState<string>("00");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const locations = [
  ];
  // Hours limited to 06..18 for scheduling; minutes in 5-minute increments
  const hours = Array.from({ length: 13 }, (_, i) => String(i + 6).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const eventTypes = [
    { value: "lecture", label: "Lecture" },
    { value: "labwork", label: "Labwork" },
    { value: "exam", label: "Exam" },
  ];

  // Helper to combine hour/min into HH:MM
  const toTime = (h: string, m: string) => (h ? `${h}:${m}` : "");

  // Compute start/end as strings
  const startTime = toTime(startHour, startMinute);
  const endTime = toTime(endHour, endMinute);

  const formatTime = (t: string) => t;

  // Fetch courses on load
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/calendar/courses/`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        console.log("Fetched courses:", data);
        console.log(`Courses fetch succeeded: ${Array.isArray(data) ? data.length : 'unknown'} items`);
        // Expect array of {id, name}
        setCoursesList(data);
        console.log('coursesList set (count):', Array.isArray(data) ? data.length : 'unknown');
      })
      .catch((err) => {
        console.error("Failed to fetch courses", err);
      });
    return () => { mounted = false };
  }, []);

  // When course changes, fetch tutors for that course
  useEffect(() => {
    if (!course) {
      setTutorsList([]);
      return;
    }
    let mounted = true;
    fetch(`${API_BASE}/calendar/courses/${course}/tutors/`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setTutorsList(data);
        console.log(`Fetched tutors for course ${course}:`, data);
      })
      .catch((err) => { console.error('Failed to fetch tutors', err); setTutorsList([]); });
    return () => { mounted = false };
  }, [course]);

  // Debug: log tutorsList updates (count only)
  useEffect(() => {
    console.log('tutorsList count:', Array.isArray(tutorsList) ? tutorsList.length : 0);
  }, [tutorsList]);

  // Debug current tutor/date state
  useEffect(() => {
    console.log('Current tutor:', tutor, 'date:', date, 'start enabled?', !!tutor && !!date);
  }, [tutor, date]);

  // Debug: log coursesList updates (count only)
  useEffect(() => {
    console.log('coursesList count:', Array.isArray(coursesList) ? coursesList.length : 0);
  }, [coursesList]);

  // Consolidated form-state logger (concise values)
  useEffect(() => {
    console.log('Form state:', { date, course, eventType, tutor, startHour, startMinute, endHour, endMinute });
  }, [date, course, eventType, tutor, startHour, startMinute, endHour, endMinute]);

  // When tutor or date changes we will fetch that tutor's schedules for date
  const [tutorBusyRanges, setTutorBusyRanges] = useState<Array<{start: string, end: string}>>([]);
  useEffect(() => {
    if (!tutor || !date) {
      setTutorBusyRanges([]);
      return;
    }
    let mounted = true;
    fetch(`${API_BASE}/calendar/tutors/${tutor}/schedules/?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        // Expect data: [{start_time: 'HH:MM', end_time: 'HH:MM'}, ...]
        setTutorBusyRanges(data.map((d: any) => ({ start: d.start_time, end: d.end_time })) );
      })
      .catch((err) => { console.error('Failed to fetch tutor schedules', err); setTutorBusyRanges([]); });
    return () => { mounted = false };
  }, [tutor, date]);

  // Compute available time slots by removing busy ranges (simple approach: disable overlapping selections client-side)
  const isRangeOverlapping = (sA: string, eA: string, sB: string, eB: string) => {
    return !(eA <= sB || sA >= eB);
  }

  // Rooms available after start/end selected
  const [availableRooms, setAvailableRooms] = useState<Array<any>>([]);
  useEffect(() => {
    if (!date || !startTime || !endTime) { setAvailableRooms([]); return; }
    fetch(`${API_BASE}/calendar/rooms/available/?date=${date}&start=${startTime}&end=${endTime}`)
      .then((r) => r.json())
      .then((data) => setAvailableRooms(data))
      .catch((err) => { console.error('Failed to fetch available rooms', err); setAvailableRooms([]); });
  }, [date, startTime, endTime]);

  const validateNoTutorOverlap = () => {
    if (!startTime || !endTime) return false;
    for (const b of tutorBusyRanges) {
      if (isRangeOverlapping(startTime, endTime, b.start, b.end)) return false;
    }
    return true;
  }

  const validateNoRoomOverlap = async () => {
    // We already requested available rooms; if room list is empty then none available
    return availableRooms.length > 0;
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    // Basic validation
    if (!title) { alert("Please fill title"); return; }
    if (!date) { alert("Please choose a date"); return; }
    if (!course) { alert("Please choose a course"); return; }
    if (!eventType) { alert("Please choose an event type"); return; }
    if (!tutor) { alert("Please choose a tutor"); return; }
    if (!startTime || !endTime) { alert("Please choose start and end time"); return; }
    if (startTime >= endTime) { alert("Start time must be before end time"); return; }
    if (!validateNoTutorOverlap()) { alert("Tutor has a conflicting schedule"); return; }
    const roomAvailable = await validateNoRoomOverlap();
    if (!roomAvailable) { alert("No rooms available for the chosen timeframe"); return; }
    // If backend returned availableRooms, require user to select one of them
    if (availableRooms.length) {
      if (!location) { alert("Please choose a room"); return; }
      const ok = availableRooms.some((r: any) => String(r.id) === String(location) || r.name === location);
      if (!ok) { alert("Selected room is not available at that time"); return; }
    }

    // Submit to backend API
    const payload = {
      title,
      date,
      course: course,
      event_type: eventType,
      tutor: tutor,
      start_time: startTime,
      end_time: endTime,
      room: location,
      notes,
      status: "pending",
    };
    try {
      const token = localStorage.getItem("accessToken");
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/calendar/create_event/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Failed to create event: " + (err.detail || res.statusText));
        return;
      }
      setSaved(true);
      try { window.dispatchEvent(new Event('events:changed')); } catch(_){}
      setTimeout(() => { if (onDone) onDone(); }, 700);
    } catch (err) {
      console.error(err);
      alert('Network error while creating event');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {saved && (
        <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm text-green-800">Event created and sent for approval.</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2" placeholder="Short, descriptive title" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2" />
        </div>
        <div>
          {/* placeholder column to keep layout consistent until location appears after time selectors */}
          <div className="mt-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Course</label>
          <select value={course} onChange={(e) => setCourse(String(e.target.value))} disabled={!date} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            {coursesList.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Event type</label>
          <select value={eventType} onChange={(e) => setEventType(String(e.target.value))} disabled={!course} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            {eventTypes.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tutor</label>
          <select
            value={tutor}
            onChange={(e) => { console.log('tutor select onChange raw value:', e.target.value); setTutor(String(e.target.value)); }}
            disabled={!course}
            className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2"
          >
            {tutorsList.map((t: any) => (
              <option key={String(t.id)} value={String(t.id)}>{t.name || t.username || t.email}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start time</label>
          <div className="mt-1 flex gap-2 items-center">
            <select value={startHour} onChange={(e) => setStartHour(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
            <span className="text-sm text-gray-500">:</span>
            <select value={startMinute} onChange={(e) => setStartMinute(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              {minutes.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End time</label>
          <div className="mt-1 flex gap-2 items-center">
            <select value={endHour} onChange={(e) => setEndHour(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
            <span className="text-sm text-gray-500">:</span>
            <select value={endMinute} onChange={(e) => setEndMinute(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              {minutes.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} disabled={!startTime || !endTime} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            <option value="" disabled>{availableRooms.length ? 'Select room' : 'No rooms available'}</option>
            {availableRooms.length ? availableRooms.map((r: any) => (
              <option key={r.id || r.name} value={r.id || r.name}>{r.name || r.id}</option>
            )) : locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">(Optional) Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2" rows={4} placeholder="Additional context, objectives, or materials needed" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saved} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
          Create & Send to DAA
        </button>
        <button type="button" onClick={() => { if (onDone) onDone(); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md">Cancel</button>
      </div>
    </form>
  );
}

export default function CreateEvents() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

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
              {(() => {
                const profile = getLocalProfile();
                const role = profile?.role;
                const showCreate = role === "academic_assistant" || role === "administrator";
                const showApprove = role === "department_assistant" || role === "administrator";
                return (
                  <>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Schedule</h3>
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

      <div className="w-full self-start flex flex-col h-full min-h-0">

        <div className="flex gap-6 flex-1 min-h-0">
          <div className="w-2/3 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-b-2xl shadow flex-1 min-h-0 overflow-auto">
              <CreateEventForm onDone={() => { window.location.href = '/profile'; }} />
            </div>
          </div>

          <aside className="w-1/3 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-2xl shadow flex-1 overflow-auto">
              <div className="text-sm text-gray-500">Insert ảnh ở đây</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
