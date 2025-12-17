import React, { useEffect, useState } from "react";
import { formatDateLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell } from "lucide-react";
import DashboardBanner from "@/components/ui/dashboard-banner";
import { useNavigate } from "react-router-dom";

export default function CalendarPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [events, setEvents] = useState<Array<any>>([]);

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

  useEffect(() => {
    const raw = localStorage.getItem("events");
    const arr = raw ? JSON.parse(raw) : [];
    setEvents(arr);
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
        <div className="mb-6">
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
                      {weekdayLetters.map((w) => (
                        <div key={w} className="py-1">
                          {w}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-sm text-gray-700">
                      {weeks.flat().map((day, idx) => {
                        const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                        const dayStr = formatDateLocal(day);
                        const has = events.some((ev: any) => ev && ev.status === "approved" && ev.date === dayStr);
                        const isSelected = selected && formatDateLocal(selected) === dayStr;
                        return (
                          <button
                            key={dayStr + "-" + idx}
                            onClick={() => setSelected(new Date(day))}
                            className={`relative p-2 flex items-center justify-center h-12 ${isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"} ${isSelected ? "ring-2 ring-blue-500 rounded-full" : ""}`}
                          >
                            <div className="text-sm">{day.getDate()}</div>
                            {has && <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-600 rounded-full" />}
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
                <div className="text-sm text-gray-500">{selected ? selected.toLocaleDateString() : ""}</div>
              </div>

              <div>
                {selected ? (
                  (() => {
                    const dayStr = formatDateLocal(selected as Date);
                    const list = events.filter((e) => e.status === "approved" && e.date === dayStr);
                    if (list.length === 0) return <div className="text-sm text-gray-500">No approved events for this date.</div>;
                    return (
                      <div className="space-y-3">
                        {list.map((e) => (
                          <div key={e.id} className="p-3 border border-gray-100 rounded-md">
                            <div className="font-medium">{e.title || "Untitled"}</div>
                            <div className="text-xs text-gray-500">{e.startHour} - {e.endHour} · {e.location}</div>
                            <div className="text-sm text-gray-700 mt-2">{e.notes}</div>
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
