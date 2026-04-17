import { Sliders, Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";

export function ConfigPanel({ className }: { className?: string }) {
  const config = useDashboardStore((s) => s.config);
  const setConfig = useDashboardStore((s) => s.setConfig);
  const processing = useDashboardStore((s) => s.processing);
  const locked = processing === "processing";

  return (
    <section className={cn("panel animate-fade-in h-full flex flex-col", className)}>
      <div className="panel-header">
        <h2 className="panel-title">
          <Settings2 className="h-3.5 w-3.5" /> Configuration
        </h2>
        {locked && (
          <span className="text-[10px] uppercase tracking-wider text-warning font-semibold">
            Locked
          </span>
        )}
      </div>
      <div className="p-5 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Sliders className="h-3 w-3 text-primary" /> Confidence Threshold
            </Label>
            <span className="text-xs font-mono text-primary">
              {config.confidenceThreshold.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[config.confidenceThreshold]}
            min={0}
            max={1}
            step={0.01}
            disabled={locked}
            onValueChange={(v) => setConfig({ confidenceThreshold: v[0] })}
          />
          <p className="text-[10px] text-muted-foreground">
            Minimum detection confidence (0 — 1)
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Loitering Time</Label>
            <span className="text-xs font-mono text-primary">{config.loiteringTime}s</span>
          </div>
          <Slider
            value={[config.loiteringTime]}
            min={1}
            max={120}
            step={1}
            disabled={locked}
            onValueChange={(v) => setConfig({ loiteringTime: v[0] })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Crowd Threshold</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.crowdThreshold}
            disabled={locked}
            onChange={(e) =>
              setConfig({ crowdThreshold: Math.max(1, Number(e.target.value) || 1) })
            }
            className="bg-background/60"
          />
          <p className="text-[10px] text-muted-foreground">
            Triggers crowd alert when people in zone exceed this number
          </p>
        </div>
      </div>
    </section>
  );
}
