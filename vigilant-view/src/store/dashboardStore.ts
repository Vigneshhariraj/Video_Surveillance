import { create } from "zustand";
import type { StatusResponse, SurveillanceEvent } from "@/services/api";

export interface UploadedVideo {
  name: string; // canonical filename used by backend
  localUrl?: string; // object URL of the originally selected file (for instant preview)
  processedUrl?: string; // backend-served annotated video URL once processing completes
  uploaded: boolean;
}

export interface ZonePoint {
  x: number; // normalised 0..1
  y: number; // normalised 0..1
}

export interface ZoneConfig {
  points: ZonePoint[]; // saved polygon
  saved: boolean;
}

export type ProcessingState = "idle" | "processing" | "paused" | "completed" | "error";

export interface ConfigSettings {
  confidenceThreshold: number; // 0..1
  loiteringTime: number; // seconds
  crowdThreshold: number; // people count
}

export interface Stats {
  totalPeople: number;
  intrusions: number;
  loitering: number;
  crowdAlerts: number;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  progress: number; // 0..1
  currentVideo: string | null;
}

interface DashboardState {
  videos: UploadedVideo[];
  activeVideo: string | null;
  zones: Record<string, ZoneConfig>; // per-video zone, keyed by video name
  events: SurveillanceEvent[];
  stats: Stats;
  config: ConfigSettings;
  videoConfigs: Record<string, ConfigSettings>;
  processing: ProcessingState;
  backendConnected: boolean;
  errorMessage: string | null;

  // Actions - every mutation that touches uploads/zones/config is gated by `processing`
  // so the lock is enforced at the state level, not just by disabling buttons.
  addVideos: (videos: UploadedVideo[]) => void;
  removeVideo: (name: string) => void;
  setActiveVideo: (name: string | null) => void;
  setProcessedUrl: (name: string, url: string) => void;

  setZone: (videoName: string, points: ZonePoint[], saved: boolean) => void;
  resetZone: (videoName: string) => void;

  setConfig: (patch: Partial<ConfigSettings>) => void;

  setProcessing: (state: ProcessingState) => void;
  setBackendConnected: (connected: boolean) => void;
  setError: (msg: string | null) => void;

  pushEvents: (events: SurveillanceEvent[]) => void;
  replaceEvents: (events: SurveillanceEvent[]) => void;
  clearEvents: () => void;

  applyStatus: (s: StatusResponse) => void;
  resetAll: () => void;
}

const initialStats: Stats = {
  totalPeople: 0,
  intrusions: 0,
  loitering: 0,
  crowdAlerts: 0,
  fps: 0,
  currentFrame: 0,
  totalFrames: 0,
  progress: 0,
  currentVideo: null,
};

const DEFAULT_CONFIG: ConfigSettings = {
  confidenceThreshold: 0.5,
  loiteringTime: 10,
  crowdThreshold: 5,
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  videos: [],
  activeVideo: null,
  zones: {},
  events: [],
  stats: initialStats,
  config: DEFAULT_CONFIG,
  videoConfigs: {},
  processing: "idle",
  backendConnected: false,
  errorMessage: null,

  addVideos: (videos) =>
    set((s) => {
      // PROCESSING LOCK - refuse mutation while processing
      if (s.processing === "processing") return s;
      const existing = new Set(s.videos.map((v) => v.name));
      const merged = [...s.videos];
      for (const v of videos) {
        if (!existing.has(v.name)) merged.push(v);
      }
      return {
        videos: merged,
        activeVideo: s.activeVideo ?? merged[0]?.name ?? null,
      };
    }),

  removeVideo: (name) =>
    set((s) => {
      if (s.processing === "processing") return s;
      const v = s.videos.find((x) => x.name === name);
      if (v?.localUrl) URL.revokeObjectURL(v.localUrl);
      const videos = s.videos.filter((x) => x.name !== name);
      const { [name]: _, ...zones } = s.zones;
      const activeVideo =
        s.activeVideo === name ? videos[0]?.name ?? null : s.activeVideo;
      return { videos, zones, activeVideo };
    }),

  setActiveVideo: (name) =>
    set((s) => {
      if (!name) return { activeVideo: null, events: [], stats: initialStats };
      // Load this video's config if it exists, else use DEFAULT
      const videoConfig = s.videoConfigs[name] || DEFAULT_CONFIG;
      return { 
        activeVideo: name, 
        config: videoConfig,
        events: [], 
        stats: initialStats,
        errorMessage: null 
      };
    }),

  setProcessedUrl: (name, url) =>
    set((s) => ({
      videos: s.videos.map((v) => (v.name === name ? { ...v, processedUrl: url } : v)),
    })),

  setZone: (videoName, points, saved) =>
    set((s) => {
      if (s.processing === "processing") return s;
      return { zones: { ...s.zones, [videoName]: { points, saved } } };
    }),

  resetZone: (videoName) =>
    set((s) => {
      if (s.processing === "processing") return s;
      const { [videoName]: _, ...rest } = s.zones;
      return { zones: rest };
    }),

  setConfig: (patch) =>
    set((s) => {
      if (s.processing === "processing") return s;
      const newConfig = { ...s.config, ...patch };
      const videoConfigs = s.activeVideo
        ? { ...s.videoConfigs, [s.activeVideo]: newConfig }
        : s.videoConfigs;
      return { config: newConfig, videoConfigs };
    }),

  setProcessing: (state) => set({ processing: state }),
  setBackendConnected: (connected) => set({ backendConnected: connected }),
  setError: (msg) => set({ errorMessage: msg }),

  pushEvents: (events) =>
    set((s) => {
      // De-dup by id+timestamp+person
      const key = (e: SurveillanceEvent) =>
        `${e.id ?? ""}-${e.timestamp}-${e.person_id}-${e.event_type}-${e.frame ?? ""}`;
      const seen = new Set(s.events.map(key));
      const fresh = events.filter((e) => !seen.has(key(e)));
      return { events: [...fresh, ...s.events].slice(0, 1000) };
    }),

  replaceEvents: (events) => set({ events: [...events].reverse().slice(0, 1000) }),
  clearEvents: () => set({ events: [] }),

  applyStatus: (s) => {
    // Normalise progress (accept 0..1 or 0..100)
    let progress = s.progress ?? 0;
    if (progress > 1) progress = progress / 100;
    progress = Math.max(0, Math.min(1, progress));
    set((prev) => ({
      stats: {
        ...prev.stats,
        totalPeople: s.total_people ?? prev.stats.totalPeople,
        intrusions: s.intrusions ?? prev.stats.intrusions,
        loitering: s.loitering ?? prev.stats.loitering,
        crowdAlerts: s.crowd_alerts ?? prev.stats.crowdAlerts,
        fps: s.fps ?? prev.stats.fps,
        currentFrame: s.current_frame ?? prev.stats.currentFrame,
        totalFrames: s.total_frames ?? prev.stats.totalFrames,
        progress,
        currentVideo: s.current_video ?? prev.stats.currentVideo,
      },
    }));
    if (s.state) get().setProcessing(s.state);
    if (s.state === "error") get().setError(s.message ?? "Processing failed");
  },

  resetAll: () =>
    set((s) => {
      s.videos.forEach((v) => v.localUrl && URL.revokeObjectURL(v.localUrl));
      return {
        videos: [],
        activeVideo: null,
        zones: {},
        events: [],
        stats: initialStats,
        processing: "idle",
        errorMessage: null,
      };
    }),
}));
