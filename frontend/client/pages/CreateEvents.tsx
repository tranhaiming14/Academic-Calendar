import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Bell, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardBanner from "@/components/ui/dashboard-banner";

type CreateEventFormProps = {
  onDone?: () => void;
};

function CreateEventForm({ onDone }: CreateEventFormProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState("");
  const [course, setCourse] = useState("");
  const [tutor, setTutor] = useState("");
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const locations = [
    "-- Choose location --",
    "Nhà 2H, phòng 204",
    "Nhà 3C, phòng 408",
    "Nhà 2A, phòng 312",
    "Nhà A10, hội trường tầng 4",
    "Nhà A21, hội trường tầng 8",
  ];
  const courses = [
    "-- Choose course --",
    "Advanced databases",
    "Scientific writing and communication",
    "Distributed systems",
    "Introduction to Deep Learning",
    "Web Application Development",
  ];
  const tutors = [
    "-- Choose tutor --",
    "Lê Như Chu Hiệp",
    "Trần Giang Sơn",
    "Đoàn Nhật Quang",
    "Kiều Quốc Việt",
    "Huỳnh Vĩnh Nam",
  ];
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const ev = { id: Date.now(), title, date, location, course, tutor, startHour, endHour, notes, status: "pending" };
    try {
      const raw = localStorage.getItem("events");
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(ev);
      localStorage.setItem("events", JSON.stringify(arr));
      try {
        window.dispatchEvent(new Event("events:changed"));
      } catch (err) {
        /* ignore */
      }
      setSaved(true);
      setTimeout(() => {
        if (onDone) onDone();
      }, 700);
    } catch (err) {
      console.error(err);
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
          <label className="block text-sm font-medium text-gray-700">Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Course</label>
          <select value={course} onChange={(e) => setCourse(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            {courses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tutor</label>
          <select value={tutor} onChange={(e) => setTutor(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            {tutors.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start hour</label>
          <select value={startHour} onChange={(e) => setStartHour(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            <option value="">-- from --</option>
            {hours.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End hour</label>
          <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 shadow-sm px-3 py-2">
            <option value="">-- to --</option>
            {hours.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
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

      <div className="w-full self-start flex flex-col h-full min-h-0">
        <div className="mb-0">
          <DashboardBanner
            images={[
              "https://storage.googleapis.com/usth-edu.appspot.com/2025-08-14_10-34-59%2Fbanner-ts.jpg",
              "http://storage.googleapis.com/usth-edu.appspot.com/2025-08-14_10-35-08%2Fbanner-master.jpg",
              "https://usth.edu.vn/wp-content/uploads/2021/12/1slidectsv.jpg",
            ]}
            intervalMs={5000}
          />
        </div>

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
