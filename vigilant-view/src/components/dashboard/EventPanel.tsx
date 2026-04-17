import { AlertTriangle, Clock, LogOut, Users, Bell, FileVideo } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import type { SurveillanceEvent } from "@/services/api";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; tone: "alert" | "warn" | "info" }> = {
  Intrusion: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/15 border-destructive/30", tone: "alert" },
  Crowd:     { icon: Users,        color: "text-destructive", bg: "bg-destructive/15 border-destructive/30", tone: "alert" },
  Loitering: { icon: Clock,        color: "text-warning",     bg: "bg-warning/15 border-warning/30",         tone: "warn"  },
  Exit:      { icon: LogOut,       color: "text-sky-500",     bg: "bg-sky-500/10 border-sky-500/30",         tone: "info"  },
  Tracking:  { icon: FileVideo,    color: "text-success",     bg: "bg-success/10 border-success/30",         tone: "info"  },
};

function EventCard({ e }: { e: SurveillanceEvent }) {
  const meta = ICONS[e.event_type as string] ?? ICONS.Exit;
  const Icon = meta.icon;
  return (
    <li
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border animate-slide-in",
        meta.bg,
        meta.tone === "alert" && "shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)]"
      )}
    >
      <div className={cn("h-8 w-8 rounded-md grid place-items-center shrink-0 bg-background/40", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("text-sm font-semibold", meta.color)}>{e.event_type}</p>
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {e.timestamp}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Person <span className="font-mono text-foreground">#{e.person_id}</span>
          {e.frame !== undefined && (
            <> • Frame <span className="font-mono text-foreground">{e.frame}</span></>
          )}
        </p>
      </div>
    </li>
  );
}

export function EventPanel({ className }: { className?: string }) {
  const events = useDashboardStore((s) => s.events);

  return (
    <section className={cn("panel animate-fade-in flex flex-col h-full", className)}>
      <div className="panel-header">
        <h2 className="panel-title">
          <Bell className="h-3.5 w-3.5" /> Live Events
        </h2>
        <span className="text-xs text-muted-foreground">{events.length} total</span>
      </div>
      <div className="p-4 flex-1 min-h-0">
        {events.length === 0 ? (
          <div className="h-full grid place-items-center text-center py-10">
            <div>
              <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Events appear in real time during processing
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2 h-full overflow-y-auto scrollbar-thin pr-1">
            {events.map((e, i) => (
              <EventCard key={`${e.id ?? ""}-${i}-${e.timestamp}`} e={e} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
