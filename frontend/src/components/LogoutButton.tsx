"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/services/authService";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  async function handleLogout() {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#163a5f] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
