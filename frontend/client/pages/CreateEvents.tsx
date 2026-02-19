import React, { useEffect, useMemo, useState } from "react";
import { getLocalProfile } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Bell, ChevronLeft, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardBanner from "@/components/ui/dashboard-banner";
import Sidebar from "@/components/Sidebar";

export interface CreateEventFormProps {
  onDone?: () => void;
  initialData?: any;
}

export function CreateEventForm({ onDone, initialData }: CreateEventFormProps) {
  const API_BASE = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState("");
  const [coursesList, setCoursesList] = useState<Array<any>>([]);
  const [course, setCourse] = useState<string>("");
  const [tutorsList, setTutorsList] = useState<Array<any>>([]);
  const [tutor, setTutor] = useState<string>("");
  const [eventType, setEventType] = useState<string>("");
  const [startHour, setStartHour] = useState<string>("");
  const [startMinute, setStartMinute] = useState<string>("");
  const [endHour, setEndHour] = useState<string>("");
  const [endMinute, setEndMinute] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  // Pre-fill form if initialData is provided
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDate(initialData.date || "");
      if (initialData.course) setCourse(String(initialData.course));
      // Wait for courses to load? Ideally yes, but setting ID usually works for select value
      if (initialData.event_type) setEventType(initialData.event_type);
      if (initialData.tutor) setTutor(String(initialData.tutor));
      if (initialData.start_time) {
        const [h, m] = initialData.start_time.split(':');
        setStartHour(h);
        setStartMinute(m);
      }
      if (initialData.end_time) {
        const [h, m] = initialData.end_time.split(':');
        setEndHour(h);
        setEndMinute(m);
      }
      if (initialData.room) setLocation(String(initialData.room)); // ID or name
      if (initialData.notes) setNotes(initialData.notes);
    }
  }, [initialData]);

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

    fetch(`${API_BASE}/api/calendar/courses/`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setCoursesList(data);
      })
      .catch((err) => console.error("Failed to fetch courses", err));

    return () => { mounted = false };
  }, []);

  // Fetch tutors for the selected course
  useEffect(() => {
    if (!course) {
      setTutorsList([]);
      return;
    }

    let mounted = true;
    fetch(`${API_BASE}/api/calendar/courses/${course}/tutors/`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setTutorsList(Array.isArray(data) ? data : (data.results || []));
      })
      .catch((err) => {
        console.error("Failed to fetch tutors for course", err);
        setTutorsList([]);
      });

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
  const [tutorBusyRanges, setTutorBusyRanges] = useState<Array<{ start: string, end: string }>>([]);
  useEffect(() => {
    if (!tutor || !date) {
      setTutorBusyRanges([]);
      return;
    }
    let mounted = true;
    let url = `${API_BASE}/api/calendar/tutors/${tutor}/schedules/?date=${date}`;
    // If editing, exclude current event
    if (initialData && initialData.id) {
      url += `&exclude=${initialData.id}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        // Expect data: [{start_time: 'HH:MM', end_time: 'HH:MM'}, ...]
        setTutorBusyRanges(data.map((d: any) => ({ start: d.start_time, end: d.end_time })));
      })
      .catch((err) => { console.error('Failed to fetch tutor schedules', err); setTutorBusyRanges([]); });
    return () => { mounted = false };
  }, [tutor, date, initialData]);

  // Compute available time slots by removing busy ranges (simple approach: disable overlapping selections client-side)
  const isRangeOverlapping = (sA: string, eA: string, sB: string, eB: string) => {
    return !(eA <= sB || sA >= eB);
  }

  // Rooms available after start/end selected
  const [availableRooms, setAvailableRooms] = useState<Array<any>>([]);
  useEffect(() => {
    if (!date || !startTime || !endTime) { setAvailableRooms([]); return; }

    let url = `${API_BASE}/api/calendar/rooms/available/?date=${date}&start=${startTime}&end=${endTime}`;
    if (initialData && initialData.id) {
      url += `&exclude=${initialData.id}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((data) => setAvailableRooms(data))
      .catch((err) => { console.error('Failed to fetch available rooms', err); setAvailableRooms([]); });
  }, [date, startTime, endTime, initialData]);

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

      let url = `${API_BASE}/api/calendar/create_event/`;
      let method = 'POST';

      // If editing (initialData has id)
      if (initialData && initialData.id) {
        url = `${API_BASE}/api/calendar/edit_event/${initialData.id}/`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Failed to save event: " + (err.detail || res.statusText));
        return;
      }
      setSaved(true);
      try { window.dispatchEvent(new Event('events:changed')); } catch (_) { }
      // Stay on page, reset saved state after delay if needed or just let user see success message
      setTimeout(() => {
        setSaved(false);
        if (onDone) onDone(); // call onDone to close modal if needed
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Network error while creating event');
    }
  };

  const handleCancel = () => {
    setTitle("");
    setDate("");
    setLocation("");
    setCourse("");
    setTutor("");
    setEventType("");
    setStartHour("");
    setStartMinute("");
    setEndHour("");
    setEndMinute("");
    setNotes("");
    setSaved(false);
    if (onDone) onDone();
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
            <option value="" disabled>Select course</option>
            {coursesList.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Event type</label>
          <select value={eventType} onChange={(e) => setEventType(String(e.target.value))} disabled={!course} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            <option value="" disabled>Select event type</option>
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
            <option value="" disabled>Select Tutor...</option>
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
              <option value="" disabled>--</option>
              {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
            <span className="text-sm text-gray-500">:</span>
            <select value={startMinute} onChange={(e) => setStartMinute(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              <option value="" disabled>--</option>
              {minutes.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End time</label>
          <div className="mt-1 flex gap-2 items-center">
            <select value={endHour} onChange={(e) => setEndHour(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              <option value="" disabled>--</option>
              {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
            <span className="text-sm text-gray-500">:</span>
            <select value={endMinute} onChange={(e) => setEndMinute(e.target.value)} disabled={String(tutor).trim() === ""} className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm">
              <option value="" disabled>--</option>
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
          {initialData ? 'Update Event' : 'Create & Send to DAA'}
        </button>

        {/* Cancel Event Button for Admin/DAA */}
        {initialData && ['administrator', 'department_assistant'].includes(getLocalProfile()?.role || '') && (
          <button
            type="button"
            onClick={async () => {
              try {
                const token = localStorage.getItem("accessToken");
                const headers: any = { 'Content-Type': 'application/json' };
                if (token) headers.Authorization = `Bearer ${token}`;

                // Use the edit endpoint with action="cancel"
                const res = await fetch(`${API_BASE}/api/calendar/edit_event/${initialData.id}/`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({ action: 'cancel' }),
                });

                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  alert("Failed to cancel event: " + (err.detail || res.statusText));
                  return;
                }

                // Success
                setSaved(true); // Show momentary success feedback if desired, or just close
                try { window.dispatchEvent(new Event('events:changed')); } catch (_) { }
                if (onDone) onDone();
              } catch (err) {
                console.error(err);
                alert("Network error while cancelling event");
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            Cancel Event
          </button>
        )}

        <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Close</button>
      </div>
    </form>
  );
}

export default function CreateEvents() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />

      <main className="w-full self-start flex flex-col h-full min-h-0">

        <div className="flex gap-6 flex-1 min-h-0">
          <div className="w-2/3 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-b-2xl shadow flex-1 min-h-0 overflow-auto">
              {/* Removed redirect to stay on page */}
              <CreateEventForm />
            </div>
          </div>

          <aside className="w-1/3 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-2xl shadow flex-1 overflow-auto">
              <div className="text-sm text-gray-500">Insert ảnh ở đây</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
