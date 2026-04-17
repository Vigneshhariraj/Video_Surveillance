import { Shield, Activity, Circle } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  idle: { label: "Idle", color: "bg-muted-foreground" },
  processing: { label: "Processing", color: "bg-primary animate-pulse-glow" },
  paused: { label: "Paused", color: "bg-warning" },
  completed: { label: "Completed", color: "bg-success" },
  error: { label: "Error", color: "bg-destructive animate-pulse-danger" },
};

export function Header() {
  const processing = useDashboardStore((s) => s.processing);
  const backendConnected = useDashboardStore((s) => s.backendConnected);
  const fps = useDashboardStore((s) => s.stats.fps);
  const meta = STATE_LABEL[processing];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="container flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gradient">
              Surveillance Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Smart video monitoring & event analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-mono text-muted-foreground">
              {fps.toFixed(1)} FPS
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60">
            <span className={`h-2 w-2 rounded-full ${backendConnected ? "bg-success" : "bg-destructive animate-pulse"}`} />
            <span className="text-xs font-medium">Backend: {backendConnected ? "Connected" : "Offline"}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60">
            <span className={`h-2 w-2 rounded-full ${meta.color}`} />
            <span className="text-xs font-medium">{meta.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
