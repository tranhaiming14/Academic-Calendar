import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getLocalProfile } from "@/lib/profileService";

type Props = { roles: string[]; children: ReactNode };

export default function RequireRole({ roles, children }: Props) {
  const profile = getLocalProfile();
  const role = profile?.role;
  if (!role) return <Navigate to="/notfound" replace />;
  return roles.includes(role) ? <>{children}</> : <Navigate to="/notfound" replace />;
}
