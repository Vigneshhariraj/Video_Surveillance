// Centralised API service layer.
// Base URL is configurable via VITE_API_BASE_URL; defaults to "/api".
// All API calls go through here - no raw fetch in components.

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api";

export type EventType = "Intrusion" | "Loitering" | "Exit" | "Crowd";

export interface SurveillanceEvent {
  id?: string | number;
  person_id: string | number;
  event_type: EventType | string;
  timestamp: string;
  frame?: number;
}

export interface StatusResponse {
  state: "idle" | "processing" | "paused" | "completed" | "error";
  progress?: number; // 0..1 or 0..100 — we normalise downstream
  current_frame?: number;
  total_frames?: number;
  fps?: number;
  total_people?: number;
  intrusions?: number;
  loitering?: number;
  crowd_alerts?: number;
  message?: string;
  current_video?: string;
}

export interface ProcessConfig {
  confidence_threshold: number;
  loitering_time: number;
  crowd_threshold: number;
  videos: string[];
  video_configs?: Record<string, {
    confidence_threshold: number;
    loitering_time: number;
    crowd_threshold: number;
  }>;
}

export interface ZonePayload {
  video: string;
  // Normalised polygon points in [0,1] coordinates plus pixel coords
  points_normalised: { x: number; y: number }[];
  points_pixels?: { x: number; y: number }[];
  width?: number;
  height?: number;
}

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
      else if (data?.error) msg = data.error;
    } catch {
      try {
        const txt = await res.text();
        if (txt) msg = txt;
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(msg, res.status);
  }
  // Some endpoints might return empty body
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return undefined as unknown as T;
}

export const api = {
  baseUrl: BASE_URL,

  async uploadVideos(files: File[]): Promise<{ filenames: string[] }> {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f, f.name));
    const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: fd });
    return handle<{ filenames: string[] }>(res);
  },

  async startProcessing(config: ProcessConfig): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    return handle<{ ok: boolean }>(res);
  },

  async getStatus(videoName?: string): Promise<StatusResponse> {
    const url = new URL(`${BASE_URL}/status`);
    if (videoName) url.searchParams.append("video", videoName);
    const res = await fetch(url.toString(), { cache: "no-store" });
    return handle<StatusResponse>(res);
  },
  
  async pause(): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE_URL}/pause`, { method: "POST" });
    return handle<{ ok: boolean }>(res);
  },

  async resume(): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE_URL}/resume`, { method: "POST" });
    return handle<{ ok: boolean }>(res);
  },

  async getLogs(videoName?: string): Promise<SurveillanceEvent[]> {
    const url = new URL(`${BASE_URL}/logs`);
    if (videoName) url.searchParams.append("video", videoName);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await handle<SurveillanceEvent[] | { logs: SurveillanceEvent[] }>(res);
    if (Array.isArray(data)) return data;
    return data?.logs ?? [];
  },

  videoUrl(name: string, download = false): string {
    return `${BASE_URL}/video?name=${encodeURIComponent(name)}${download ? "&download=1" : ""}`;
  },

  async saveZone(payload: ZonePayload): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE_URL}/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handle<{ ok: boolean }>(res);
  },
};

export { ApiError };
