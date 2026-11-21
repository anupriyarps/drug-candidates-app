"use client";

import { useEffect } from "react";

import {
  clearFrontendAuthenticationState,
  initializeSession,
} from "@/services/authService";

export default function SessionInitializer() {
  useEffect(() => {
    void initializeSession().catch((error: unknown) => {
      clearFrontendAuthenticationState();
      console.error("Unable to initialize the authentication session.", error);
    });
  }, []);

  return null;
}
