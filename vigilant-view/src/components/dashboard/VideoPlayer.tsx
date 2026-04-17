import { useEffect, useRef, useState } from "react";
import { Play, Pause, Save, RotateCcw, Pencil, Film, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore, type ZonePoint } from "@/store/dashboardStore";
import { api } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CLOSE_DISTANCE_PX = 14; // distance to first point that auto-closes the polygon

export function VideoPlayer({ className }: { className?: string }) {
  const videos = useDashboardStore((s) => s.videos);
  const activeVideo = useDashboardStore((s) => s.activeVideo);
  const setActiveVideo = useDashboardStore((s) => s.setActiveVideo);
  const zones = useDashboardStore((s) => s.zones);
  const setZone = useDashboardStore((s) => s.setZone);
  const resetZone = useDashboardStore((s) => s.resetZone);
  const processing = useDashboardStore((s) => s.processing);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<ZonePoint[]>([]);
  const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 });
  const [videoError, setVideoError] = useState(false);

  const active = videos.find((v) => v.name === activeVideo);
  const currentZone = activeVideo ? zones[activeVideo] : undefined;
  const locked = processing === "processing";

  // Display the processed (annotated) URL once it's available, otherwise the local preview.
  const sourceUrl = active?.processedUrl ?? active?.localUrl ?? "";

  // Reset draft points and pause video when switching videos so per-video state is clean.
  useEffect(() => {
    setDraftPoints([]);
    setDrawMode(false);
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [activeVideo, sourceUrl]);

  // Track overlay size for normalised<->pixel conversion
  useEffect(() => {
    if (!overlayRef.current) return;
    const el = overlayRef.current;
    const update = () => setOverlaySize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!drawMode || !overlayRef.current || locked) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Auto-close if user clicks near the first point and at least 3 points exist
    if (draftPoints.length >= 3) {
      const first = draftPoints[0];
      const dx = first.x * rect.width - px;
      const dy = first.y * rect.height - py;
      if (Math.hypot(dx, dy) <= CLOSE_DISTANCE_PX) {
        // Close — keep current draft, exit draw mode
        setDrawMode(false);
        toast.info("Polygon closed — click Save Zone to persist");
        return;
      }
    }

    setDraftPoints((p) => [
      ...p,
      { x: px / rect.width, y: py / rect.height },
    ]);
  };

  const startDrawing = () => {
    if (locked) return;
    setDraftPoints([]);
    setDrawMode(true);
  };

  const handleSaveZone = async () => {
    if (!activeVideo) return;
    const points = draftPoints.length ? draftPoints : currentZone?.points ?? [];
    if (points.length < 3) {
      toast.error("Draw at least 3 points to form a zone");
      return;
    }
    try {
      const w = overlaySize.w || 1;
      const h = overlaySize.h || 1;
      await api.saveZone({
        video: activeVideo,
        points_normalised: points,
        points_pixels: points.map((p) => ({ x: Math.round(p.x * w), y: Math.round(p.y * h) })),
        width: w,
        height: h,
      });
      setZone(activeVideo, points, true);
      setDraftPoints([]);
      setDrawMode(false);
      toast.success("Zone saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save zone");
    }
  };

  const handleResetZone = () => {
    if (!activeVideo) return;
    setDraftPoints([]);
    setDrawMode(false);
    resetZone(activeVideo);
    toast.info("Zone cleared");
  };

  const polyPoints = (pts: ZonePoint[]) =>
    pts.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  const stats = useDashboardStore((s) => s.stats);
  const isStreamingThisVideo = locked && (stats.currentVideo === activeVideo);
  const isWaiting = locked && (stats.currentVideo !== activeVideo);

  return (
    <section className={cn("panel animate-fade-in text-card-foreground flex flex-col h-full", className)}>
      <div className="panel-header">
        <h2 className="panel-title">
          <Film className="h-3.5 w-3.5" /> Video Player & Zone Editor
        </h2>
        {currentZone?.saved && (
          <span className="text-xs text-success flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Zone active
          </span>
        )}
      </div>

      {/* Tabs */}
      {videos.length > 0 && (
        <div className="flex gap-1 px-3 pt-3 overflow-x-auto scrollbar-thin pb-1">
          {videos.map((v) => (
            <button
              key={v.name}
              onClick={() => setActiveVideo(v.name)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-200",
                "border shadow-sm",
                activeVideo === v.name
                  ? "bg-primary/10 text-primary border-primary/30 shadow-primary/5"
                  : "bg-background text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                {stats.currentVideo === v.name && (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                )}
                {v.name}
                {v.processedUrl && (
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="relative rounded-xl overflow-hidden bg-black/90 ring-1 ring-white/10 aspect-video shadow-2xl">
          {isStreamingThisVideo ? (
            <div className="absolute inset-0">
               <img
                src={`${api.baseUrl}/stream?t=${Date.now()}`}
                className="h-full w-full object-contain"
                alt="Live Processing Stream"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-destructive/90 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live Analysis
              </div>
            </div>
          ) : isWaiting ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-center p-6">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
              <p className="text-white font-semibold">Waiting in Queue</p>
              <p className="text-xs text-muted-foreground mt-1">
                Processing {stats.currentVideo}...
              </p>
            </div>
          ) : sourceUrl ? (
            <video
              ref={videoRef}
              src={sourceUrl}
              className="absolute inset-0 h-full w-full object-contain"
              onEnded={() => setPlaying(false)}
              onLoadedData={() => {
                setPlaying(false);
                setVideoError(false);
              }}
              onError={() => {
                if (sourceUrl) setVideoError(true);
              }}
              playsInline
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-grid">
              <div className="text-center px-6">
                <Film className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Upload a video to begin
                </p>
              </div>
            </div>
          )}

          {videoError && sourceUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6 animate-fade-in">
              <AlertCircle className="h-8 w-8 text-warning mb-3" />
              <p className="text-sm font-medium text-white mb-1">
                Playback limited in browser
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                This format (e.g. AVI) might not preview directly. 
                Proceed with <b>Start Processing</b> to view the web-optimized result.
              </p>
            </div>
          )}

          {/* Drawing overlay */}
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={cn(
              "absolute inset-0",
              drawMode ? "cursor-crosshair" : "cursor-default"
            )}
          >
            <svg 
              className="absolute inset-0 h-full w-full pointer-events-none"
              viewBox="0 0 100 100" 
              preserveAspectRatio="none"
            >
              {/* Saved zone */}
              {currentZone?.points && currentZone.points.length >= 3 && draftPoints.length === 0 && (
                <polygon
                  points={polyPoints(currentZone.points)}
                  fill="hsl(var(--primary) / 0.18)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              )}
              {/* Draft polygon being drawn */}
              {draftPoints.length > 0 && (
                <>
                  {draftPoints.length >= 3 && (
                    <polygon
                      points={polyPoints(draftPoints)}
                      fill="hsl(var(--primary) / 0.15)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  )}
                  {draftPoints.length < 3 && draftPoints.length > 1 && (
                    <polyline
                      points={polyPoints(draftPoints)}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  )}
                  {draftPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x * 100}
                      cy={p.y * 100}
                      r={i === 0 ? 1.5 : 1}
                      vectorEffect="non-scaling-stroke"
                      fill={i === 0 ? "hsl(var(--primary-glow))" : "hsl(var(--primary))"}
                      stroke="hsl(var(--background))"
                      strokeWidth={0.2}
                    />
                  ))}
                </>
              )}
            </svg>

            {drawMode && (
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-background/85 backdrop-blur text-xs font-medium border border-primary/40 text-primary animate-fade-in">
                Click to add points • Click first point to close
              </div>
            )}
            {locked && (
              <div className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-warning/15 text-warning text-xs font-medium border border-warning/30">
                Locked — processing
              </div>
            )}
          </div>

          {/* Play overlay */}
          {sourceUrl && !locked && (
            <button
              onClick={togglePlay}
              className={cn(
                "absolute bottom-3 left-3 z-10 h-9 w-9 rounded-full grid place-items-center",
                "bg-background/80 backdrop-blur border border-border hover:bg-background transition"
              )}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          )}
        </div>

        {/* Zone controls */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={drawMode ? "default" : "secondary"}
            onClick={startDrawing}
            disabled={!activeVideo || locked}
            className={cn(drawMode && "bg-gradient-primary text-primary-foreground")}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {drawMode ? "Drawing…" : "Draw Zone"}
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handleSaveZone}
            disabled={!activeVideo || locked || (draftPoints.length < 3 && !currentZone?.points?.length)}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Zone
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetZone}
            disabled={!activeVideo || locked}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Zone
          </Button>
          <div className="ml-auto text-xs text-muted-foreground self-center">
            {draftPoints.length > 0
              ? `${draftPoints.length} point${draftPoints.length !== 1 ? "s" : ""}`
              : currentZone?.saved
              ? `${currentZone.points.length} pts saved`
              : "No zone"}
          </div>
        </div>
      </div>
    </section>
  );
}
