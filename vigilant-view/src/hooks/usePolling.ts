import { useEffect, useRef } from "react";
import { api } from "@/services/api";
import { useDashboardStore } from "@/store/dashboardStore";

/**
 * Polls /status and /logs while processing is active.
 * Cleans up automatically on unmount and when processing stops.
 */
export function usePolling(intervalMs = 1500) {
  const processing = useDashboardStore((s) => s.processing);
  const activeVideo = useDashboardStore((s) => s.activeVideo);
  const applyStatus = useDashboardStore((s) => s.applyStatus);
  const replaceEvents = useDashboardStore((s) => s.replaceEvents);
  const setError = useDashboardStore((s) => s.setError);
  const setBackendConnected = useDashboardStore((s) => s.setBackendConnected);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    const isActive = processing === "processing" || processing === "paused";
    // Fast polling during activity (1.5s), very slow polling when idle (10m)
    const currentInterval = isActive ? intervalMs : 600000;
    
    const tick = async () => {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const [status, logs] = await Promise.all([
          api.getStatus(activeVideo ?? undefined),
          isActive ? api.getLogs(activeVideo ?? undefined) : Promise.resolve([])
        ]);
        
        applyStatus(status);
        setBackendConnected(true);
        if (logs && logs.length) replaceEvents(logs);
      } catch (e: any) {
        setBackendConnected(false);
        if (isActive) {
          setError(e?.message ?? "Failed to poll status");
        }
      } finally {
        inflight.current = false;
      }
    };

    tick(); // Run immediately on mount or state change
    timer.current = setInterval(tick, currentInterval);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [processing, activeVideo, intervalMs, applyStatus, replaceEvents, setError, setBackendConnected]);
}
