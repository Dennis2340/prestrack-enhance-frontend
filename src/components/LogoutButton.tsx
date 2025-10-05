"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-sm border border-red-200 disabled:opacity-50"
      aria-label="Logout"
    >
      {loading ? "Logging out…" : "Logout"}
    </button>
  );
}
