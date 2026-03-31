"use client";

import { useEffect } from "react";

export default function ReferralActivator() {
  useEffect(() => {
    const match = document.cookie.match(/zafe_ref=([^;]+)/);
    if (!match) return;
    const code = match[1];

    fetch("/api/referral/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).finally(() => {
      // Apaga o cookie independentemente do resultado
      document.cookie = "zafe_ref=; Max-Age=0; path=/";
    });
  }, []);

  return null;
}
