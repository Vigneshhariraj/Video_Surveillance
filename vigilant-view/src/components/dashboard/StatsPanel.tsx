import { useEffect, useState } from "react";
import { Users, ShieldAlert, Clock, UsersRound, Gauge, Info } from "lucide-react";
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
  }, [value]);
  return display;
}

interface CardProps {
  label: string;
  value: number;
  icon: typeof Users;
  tone?: "primary" | "danger" | "warn" | "muted";
  format?: (n: number) => string;
  description: string;
}

function StatCard({ label, value, icon: Icon, tone = "primary", format, description }: CardProps) {
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
            {label}
          </p>
          <div title={description} className="cursor-help text-muted-foreground/40 hover:text-primary transition-colors">
            <Info className="h-3 w-3" />
          </div>
        </div>
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
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-fade-in">
      <StatCard 
        label="Total People" 
        value={stats.totalPeople} 
        icon={Users} 
        tone="primary" 
        description="Total unique individuals detected during the monitoring session."
      />
      <StatCard 
        label="Intrusions" 
        value={stats.intrusions} 
        icon={ShieldAlert} 
        tone="danger" 
        description="Total occurrences of individuals entering a restricted detection zone."
      />
      <StatCard 
        label="Loitering" 
        value={stats.loitering} 
        icon={Clock} 
        tone="warn" 
        description="Count of individuals staying inside a zone beyond the allowed time limit."
      />
      <StatCard 
        label="Crowd Alerts" 
        value={stats.crowdAlerts} 
        icon={UsersRound} 
        tone="danger" 
        description="Alerts triggered when person density in a zone exceeds the safety threshold."
      />
      <StatCard
        label="Current FPS"
        value={Math.round(stats.fps)}
        icon={Gauge}
        tone="muted"
        format={(n) => n.toFixed(0)}
        description="Real-time processing performance of the analysis engine (Frames Per Second)."
      />
    </section>
  );
}
