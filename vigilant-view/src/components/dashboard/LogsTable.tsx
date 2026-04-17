import { Download, ListOrdered, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ALERT_TYPES = new Set(["Intrusion", "Crowd"]);

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function LogsTable({ className }: { className?: string }) {
  const events = useDashboardStore((s) => s.events);

  const downloadCsv = () => {
    if (!events.length) {
      toast.error("No logs to export");
      return;
    }
    const rows = events.map((e) => ({
      frame: e.frame ?? "",
      person_id: e.person_id,
      event_type: e.event_type,
      timestamp: e.timestamp,
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surveillance-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  return (
    <section className={cn("panel animate-fade-in flex flex-col h-full overflow-hidden max-h-[400px]", className)}>
      <div className="panel-header flex-col items-start gap-2 py-3">
        <div className="flex items-center justify-between w-full">
           <h2 className="panel-title">
             <ListOrdered className="h-3.5 w-3.5" /> Event Logs
           </h2>
           <Button size="sm" variant="secondary" onClick={downloadCsv}>
             <Download className="h-3.5 w-3.5 mr-1.5" /> Download CSV
           </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          Comprehensive audit trail of all detected events, indexed by frame and person ID for forensic review.
        </p>
      </div>
      <div className="overflow-auto flex-1 scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-4 py-2.5 font-semibold">Frame</th>
              <th className="px-4 py-2.5 font-semibold">Person ID</th>
              <th className="px-4 py-2.5 font-semibold">Event Type</th>
              <th className="px-4 py-2.5 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No log entries yet
                </td>
              </tr>
            ) : (
              events.map((e, i) => {
                const isAlert = ALERT_TYPES.has(String(e.event_type));
                const isLoiter = e.event_type === "Loitering";
                return (
                  <tr
                    key={`${i}-${e.timestamp}`}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      isAlert && "bg-destructive/5",
                      isLoiter && "bg-warning/5"
                    )}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.frame ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">#{e.person_id}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                          isAlert && "bg-destructive/15 text-destructive border-destructive/30",
                          isLoiter && "bg-warning/15 text-warning border-warning/30",
                          !isAlert && !isLoiter && "bg-muted/40 text-muted-foreground border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isAlert ? "bg-destructive" : isLoiter ? "bg-warning" : "bg-muted-foreground"
                          )}
                        />
                        {e.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {e.timestamp}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
