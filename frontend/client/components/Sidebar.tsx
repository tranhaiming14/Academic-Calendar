import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getLocalProfile } from "@/lib/profileService";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User, Bell, Shield } from "lucide-react";

export default function Sidebar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize from localStorage, default to false (expanded)
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const navigate = useNavigate();
  const location = useLocation();
  // management routes that should keep the Management dropdown open when navigated
  const managementRoutes = ["/import-students", "/students"];

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const profile = getLocalProfile();
  const role = profile?.role;
  const [managementOpen, setManagementOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('managementOpen');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    // default open if current route is under management
    return managementRoutes.some((r) => location.pathname.startsWith(r));
  });

  // persist managementOpen
  useEffect(() => {
    try {
      localStorage.setItem('managementOpen', JSON.stringify(managementOpen));
    } catch (e) {
      // ignore
    }
  }, [managementOpen]);

  // keep Management open when navigating within management routes
  useEffect(() => {
    if (managementRoutes.some((r) => location.pathname.startsWith(r))) {
      setManagementOpen(true);
    }
    // do not auto-close when navigating away; user-controlled or stored state remains
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const showCreate = role === "academic_assistant" || role === "administrator";
  const showApprove = role === "department_assistant" || role === "administrator";

  // Helper to get button styles based on active route
  const getButtonClassName = (path: string) => {
    const isActive = location.pathname === path;
    const baseClass = "font-medium transition-colors duration-200 rounded-md";
    const activeClass = isActive ? "bg-gray-900 text-white hover:bg-gray-800 hover:text-white" : "hover:bg-gray-200";
    return `${baseClass} ${activeClass}`;
  };

  // Helper for collapsed button styles
  const getCollapsedButtonClassName = (path: string) => {
    const isActive = location.pathname === path;
    const baseClass = "p-2 transition-colors duration-200 rounded-md flex items-center justify-center";
    const activeClass = isActive ? "bg-gray-900 text-white hover:bg-gray-800 hover:text-white" : "hover:bg-gray-200";
    return `${baseClass} ${activeClass}`;
  };

  return (
    <div className="hidden md:block mt-2 mb-2 ml-2 mr-0">
      <aside
        className={`bg-white border border-gray-200 sticky top-0 h-screen p-1 flex flex-col transition-all duration-300 ease-in-out transform rounded-lg shadow-lg ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className={`flex items-center px-1 ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}>
          <div className="flex items-center gap-2">
            {sidebarCollapsed ? (
              <div className="p-1">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
            ) : (
              <>
                <button
                  aria-label="Logo"
                  className="p-1 rounded-md hover:bg-gray-200"
                >
                  <CalendarIcon className="w-6 h-6 text-blue-600" />
                </button>
                <div className="font-bold text-xl tracking-tight">
                  CalendarApp
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex-1 flex flex-col gap-4">
          {/* Expanded Navigation */}
          <nav
            className={`flex flex-col gap-1 px-1 transition-all duration-300 ${
              sidebarCollapsed ? "hidden" : "flex"
            }`}
          >
            <Button
              variant="ghost"
              className={`justify-start ${getButtonClassName("/profile")}`}
              onClick={() => navigate("/profile")}
              title="Profile"
            >
              <User className="mr-2 h-4 w-4" /> Profile
            </Button>
            <Button
              variant="ghost"
              className={`justify-start ${getButtonClassName("/calendar")}`}
              onClick={() => navigate("/calendar")}
              title="Calendar"
            >
              <CalendarIcon className="mr-2 h-4 w-4" /> Calendar
            </Button>
            {showCreate && (
              <Button
                variant="ghost"
                className={`justify-start ${getButtonClassName("/create")}`}
                onClick={() => navigate("/create")}
                title="Create Event"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Event
              </Button>
            )}
            {showApprove && (
              <Button
                variant="ghost"
                className={`justify-start ${getButtonClassName("/approve")}`}
                onClick={() => navigate("/approve")}
                title="Approve Events"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Approve Events
              </Button>
            )}
            {showApprove && (
              <div>
                <Button
                  variant="ghost"
                  className={`w-full flex items-center justify-between ${getButtonClassName("/management")}`}
                  onClick={() => setManagementOpen(!managementOpen)}
                  title="Management"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                    </svg>
                    Management
                  </span>
                  {managementOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <div className={`w-full mt-1 overflow-hidden transition-all duration-200 ease-in-out ${managementOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`} aria-hidden={!managementOpen}>
                  <div className="w-full flex flex-col gap-1 pl-4">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${getButtonClassName("/import-students")}`}
                      onClick={() => navigate("/import-students")}
                      title="Import Students"
                    >
                      Import Students
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${getButtonClassName("/students")}`}
                      onClick={() => navigate("/students")}
                      title="Student Management"
                    >
                      Student Management
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {role === "administrator" && (
              <Button
                variant="ghost"
                className={`justify-start ${getButtonClassName("/audit")}`}
                onClick={() => navigate("/audit")}
                title="Audit Trail"
              >
                <Shield className="h-4 w-4 mr-2" />
                Audit Trail
              </Button>
            )}
            <Button
              variant="ghost"
              className="justify-start font-medium transition-colors duration-200 rounded-md hover:bg-gray-200"
              title="Reminders"
            >
              <Bell className="mr-2 h-4 w-4" /> Reminders
            </Button>
          </nav>

          {/* Collapsed Navigation (Icons Only) */}
          <nav
            className={`flex flex-col gap-2 px-1 transition-all duration-300 ${
              sidebarCollapsed ? "flex" : "hidden"
            }`}
          >
            <button
              onClick={() => navigate("/profile")}
              className={getCollapsedButtonClassName("/profile")}
              title="Profile"
            >
              <User className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate("/calendar")}
              className={getCollapsedButtonClassName("/calendar")}
              title="Calendar"
            >
              <CalendarIcon className="h-5 w-5" />
            </button>
            {showCreate && (
              <button
                onClick={() => navigate("/create")}
                className={getCollapsedButtonClassName("/create")}
                title="Create Event"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
            {showApprove && (
              <button
                onClick={() => navigate("/approve")}
                className={getCollapsedButtonClassName("/approve")}
                title="Approve Events"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            {showApprove && (
              <button
                onClick={() => navigate("/import-students")}
                className={getCollapsedButtonClassName("/import-students")}
                title="Import Students"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 5 17 10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            )}
            {role === "administrator" && (
              <button
                onClick={() => navigate("/audit")}
                className={getCollapsedButtonClassName("/audit")}
                title="Audit Trail"
              >
                <Shield className="h-5 w-5" />
              </button>
            )}
            <button
              className="p-2 transition-colors duration-200 rounded-md flex items-center justify-center hover:bg-gray-200"
              title="Reminders"
            >
              <Bell className="h-5 w-5" />
            </button>
          </nav>
        </div>

        {/* Bottom collapse/expand button */}
        <div className="mt-auto px-1 pb-2">
          {!sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="w-full flex items-center justify-start gap-2 p-2 rounded-md hover:bg-gray-200 transition-colors duration-200"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-600">Collapse</span>
            </button>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-200 transition-colors duration-200"
              title="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
