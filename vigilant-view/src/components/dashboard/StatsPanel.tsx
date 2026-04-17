import { useEffect, useState } from "react";
import { Users, ShieldAlert, Clock, UsersRound, Gauge } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";

function useAnimatedNumber(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const delta = value - start;
    if (delta === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

interface CardProps {
  label: string;
  value: number;
  icon: typeof Users;
  tone?: "primary" | "danger" | "warn" | "muted";
  format?: (n: number) => string;
}

function StatCard({ label, value, icon: Icon, tone = "primary", format }: CardProps) {
  const display = useAnimatedNumber(value);
  const tones = {
    primary: "text-primary bg-primary/15 border-primary/25",
    danger: "text-destructive bg-destructive/15 border-destructive/25",
    warn: "text-warning bg-warning/15 border-warning/25",
    muted: "text-muted-foreground bg-muted/40 border-border",
  } as const;

  return (
    <div className="stat-card">
      <div className={cn("h-11 w-11 rounded-lg border grid place-items-center shrink-0", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p key={display} className="text-2xl font-bold font-mono tabular-nums animate-count-up">
          {format ? format(display) : display.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function StatsPanel() {
  const stats = useDashboardStore((s) => s.stats);

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 animate-fade-in">
      <StatCard label="Total People" value={stats.totalPeople} icon={Users} tone="primary" />
      <StatCard label="Intrusions" value={stats.intrusions} icon={ShieldAlert} tone="danger" />
      <StatCard label="Loitering" value={stats.loitering} icon={Clock} tone="warn" />
      <StatCard label="Crowd Alerts" value={stats.crowdAlerts} icon={UsersRound} tone="danger" />
      <StatCard
        label="Current FPS"
        value={Math.round(stats.fps)}
        icon={Gauge}
        tone="muted"
        format={(n) => n.toFixed(0)}
      />
    </section>
  );
}
