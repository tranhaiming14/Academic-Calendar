import React from "react";
import { Navigate } from "react-router-dom";

export default function EditProfile() {
  // Redirect legacy edit-profile route to canonical /profile
  return <Navigate to="/profile" replace />;
}
