export type Profile = {
  username: string;
  email: string;
  role: string;
  contactNumber?: string;
  recoveryEmail?: string;
  // student-specific
  major?: string;
  className?: string;
  courses?: string[];
};

const LOCAL_KEY = "localProfile";
const TOKEN_KEY = "accessToken";

export const getLocalProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
};

export const saveLocalProfile = (p: Profile) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
};

export const clearLocalProfile = () => {
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

// Use Vite env var for API base when present.
const API = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "http://127.0.0.1:8000";

export const fetchProfileFromApi = async (token: string): Promise<Profile> => {
  const res = await fetch(`${API}/users/my-profile/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Fetch failed");
  return (await res.json()) as Profile;
};

export const getProfile = async (): Promise<Profile | null> => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const p = await fetchProfileFromApi(token);
    // update local cache for optional offline use, but still require API success
    try { saveLocalProfile(p); } catch {}
    return p;
  } catch {
    // treat any API failure as unauthenticated
    return null;
  }
};

export const updateProfile = async (token: string, data: Partial<Profile>): Promise<Profile> => {
  const res = await fetch(`${API}/users/my-profile/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Update failed");
  const p = (await res.json()) as Profile;
  try { saveLocalProfile(p); } catch {}
  return p;
};
