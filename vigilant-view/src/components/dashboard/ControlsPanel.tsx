import { Play, Pause, RotateCcw, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDashboardStore } from "@/store/dashboardStore";
import { api } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ControlsPanel({ className }: { className?: string }) {
  const videos = useDashboardStore((s) => s.videos);
  const zones = useDashboardStore((s) => s.zones);
  const config = useDashboardStore((s) => s.config);
  const videoConfigs = useDashboardStore((s) => s.videoConfigs);
  const processing = useDashboardStore((s) => s.processing);
  const stats = useDashboardStore((s) => s.stats);
  const errorMessage = useDashboardStore((s) => s.errorMessage);
  const setProcessing = useDashboardStore((s) => s.setProcessing);
  const setError = useDashboardStore((s) => s.setError);
  const resetAll = useDashboardStore((s) => s.resetAll);
  const setProcessedUrl = useDashboardStore((s) => s.setProcessedUrl);

  const uploadedVideos = videos.filter((v) => v.uploaded);
  const allHaveZones = uploadedVideos.length > 0 && uploadedVideos.every((v) => zones[v.name]?.saved);
  const canStart = uploadedVideos.length > 0 && allHaveZones && processing !== "processing";
  const isActive = processing === "processing";

  const startProcessing = async () => {
    setError(null);
    setProcessing("processing");
    try {
      // Map frontend config keys to backend config keys for each video
      const mappedVideoConfigs: Record<string, any> = {};
      Object.entries(videoConfigs).forEach(([name, cfg]) => {
        mappedVideoConfigs[name] = {
          confidence_threshold: cfg.confidenceThreshold,
          loitering_time: cfg.loiteringTime,
          crowd_threshold: cfg.crowdThreshold,
        };
      });

      await api.startProcessing({
        confidence_threshold: config.confidenceThreshold,
        loitering_time: config.loiteringTime,
        crowd_threshold: config.crowdThreshold,
        videos: uploadedVideos.map((v) => v.name),
        video_configs: mappedVideoConfigs,
      });
      toast.success("Processing started");
    } catch (e: any) {
      setProcessing("error");
      setError(e?.message ?? "Failed to start processing");
      toast.error(e?.message ?? "Failed to start processing");
    }
  };

  const pauseProcessing = async () => {
    try {
      await api.pause();
      setProcessing("paused");
      toast.info("Processing paused");
    } catch (e: any) {
      toast.error("Failed to pause");
    }
  };

  const resumeProcessing = async () => {
    try {
      await api.resume();
      setProcessing("processing");
      toast.success("Processing resumed");
    } catch (e: any) {
      toast.error("Failed to resume");
    }
  };

  const reset = () => {
    if (isActive) {
      toast.error("Stop processing before resetting");
      return;
    }
    resetAll();
    toast.success("Dashboard reset");
  };

  const downloadResults = async () => {
    const uploaded = videos.filter(v => v.uploaded);
    if (!uploaded.length) {
      toast.error("No videos available");
      return;
    }

    let count = 0;
    for (const v of uploaded) {
      const url = api.videoUrl(v.name, true);
      setProcessedUrl(v.name, api.videoUrl(v.name)); 
      
      const a = document.createElement("a");
      a.href = url;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      
      // Small pause to help browser handle multiple downloads
      await new Promise(r => setTimeout(r, 800));
      document.body.removeChild(a);
      count++;
    }
    toast.success(`Download started for ${count} video${count > 1 ? "s" : ""}`);
  };

  // Once completed, swap originals -> annotated outputs in the player
  if (processing === "completed") {
    videos.forEach((v) => {
      if (!v.processedUrl) setProcessedUrl(v.name, api.videoUrl(v.name));
    });
  }

  const progressPct = Math.round(stats.progress * 100);

  return (
    <section className={cn("panel animate-fade-in h-full flex flex-col", className)}>
      <div className="panel-header">
        <h2 className="panel-title">Controls</h2>
        {!canStart && processing === "idle" && (
          <span className="text-[10px] text-muted-foreground">
            {uploadedVideos.length === 0
              ? "Upload a video"
              : !allHaveZones
              ? "Save a zone for each video"
              : ""}
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {processing === "paused" ? (
            <Button
              onClick={resumeProcessing}
              className="bg-success text-white hover:bg-success/90"
            >
              <Play className="h-4 w-4 mr-1.5" /> Resume
            </Button>
          ) : (
            <Button
              onClick={startProcessing}
              disabled={!canStart || isActive}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              {isActive ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1.5" />
              )}
              {processing === "error" ? "Retry" : isActive ? "Processing…" : "Start"}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={pauseProcessing}
            disabled={!isActive}
          >
            <Pause className="h-4 w-4 mr-1.5" /> Pause
          </Button>
          <Button variant="ghost" onClick={reset} disabled={isActive}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button
            variant="outline"
            onClick={downloadResults}
            disabled={processing !== "completed" && processing !== "paused"}
          >
            <Download className="h-4 w-4 mr-1.5" /> Download
          </Button>
        </div>

        {(isActive || processing === "paused" || processing === "completed") && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {processing === "completed"
                  ? "Completed"
                  : `Processing frame ${stats.currentFrame.toLocaleString()} of ${(stats.totalFrames || "—").toLocaleString()}`}
              </span>
              <span className="font-mono text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs animate-fade-in">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Processing failed</p>
              <p className="text-destructive/80 mt-0.5 break-words">{errorMessage}</p>
              <p className="text-destructive/70 mt-1">
                Your uploaded videos and zones are preserved. Click <b>Retry</b> to try again.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
