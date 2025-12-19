import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getProfile, clearLocalProfile } from "@/lib/profileService";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await getProfile();
        if (!mounted) return;
        // if profile not present but a token exists, clear stale local tokens
        if (!p) {
          try { clearLocalProfile(); } catch {}
        }
        setAuthed(!!p);
      } catch {
        if (!mounted) return;
        setAuthed(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!authed) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  return children;
}
