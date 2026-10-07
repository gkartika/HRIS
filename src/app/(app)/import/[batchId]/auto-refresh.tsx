"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the batch page every few seconds while another run is importing it,
// so the screen turns into the finished result by itself.
export function AutoRefresh({ everyMs = 4000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
