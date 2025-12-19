import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import Profile from "./pages/Profile";
import EditProfileStudent from "./pages/EditProfile-Student";
import CalendarPage from "./pages/Calendar";
import CreateEvents from "./pages/CreateEvents";
import ApproveEvents from "./pages/ApproveEvents";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Index />} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/profile/student" element={<RequireAuth><EditProfileStudent /></RequireAuth>} />
          <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <RequireRole roles={["academic_assistant", "administrator"]}>
                  <CreateEvents />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/approve"
            element={
              <RequireAuth>
                <RequireRole roles={["department_assistant", "administrator"]}>
                  <ApproveEvents />
                </RequireRole>
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
