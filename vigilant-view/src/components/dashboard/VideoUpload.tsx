import { useCallback, useRef, useState } from "react";
import { Upload, X, FileVideo, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/dashboardStore";
import { api } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VideoUpload({ className }: { className?: string }) {
  const videos = useDashboardStore((s) => s.videos);
  const addVideos = useDashboardStore((s) => s.addVideos);
  const removeVideo = useDashboardStore((s) => s.removeVideo);
  const processing = useDashboardStore((s) => s.processing);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const locked = processing === "processing";

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (locked) {
        toast.error("Cannot upload while processing is active");
        return;
      }
      const valid = files.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name));
      if (!valid.length) {
        toast.error("Please select valid video files");
        return;
      }
      setUploading(true);
      // Optimistic local previews
      const localEntries = valid.map((f) => ({
        name: f.name,
        localUrl: URL.createObjectURL(f),
        uploaded: false,
      }));
      addVideos(localEntries);

      try {
        const res = await api.uploadVideos(valid);
        const uploaded = res?.filenames ?? valid.map((f) => f.name);
        // Mark uploaded
        useDashboardStore.setState((s) => ({
          videos: s.videos.map((v) =>
            uploaded.includes(v.name) ? { ...v, uploaded: true } : v
          ),
        }));
        toast.success(`${uploaded.length} video${uploaded.length > 1 ? "s" : ""} uploaded`);
      } catch (e: any) {
        toast.error(e?.message ?? "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [addVideos, locked]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (locked) return;
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  return (
    <section className="panel animate-fade-in">
      <div className="panel-header">
        <h2 className="panel-title">
          <Upload className="h-3.5 w-3.5" /> Video Upload
        </h2>
        <span className="text-xs text-muted-foreground">
          {videos.length} file{videos.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-200",
            "p-8 text-center cursor-pointer group",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50",
            locked && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
          onClick={() => !locked && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            disabled={locked}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) handleFiles(files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center group-hover:scale-110 transition-transform">
              {uploading ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Drop videos here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports MP4, MOV, AVI, MKV, WEBM
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={locked || uploading}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Select Files
            </Button>
          </div>
        </div>

        {videos.length > 0 && (
          <ul className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
            {videos.map((v) => (
              <li
                key={v.name}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/60 animate-slide-in"
              >
                <div className="h-8 w-8 rounded-md bg-primary/10 grid place-items-center shrink-0">
                  <FileVideo className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {v.uploaded ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" /> Uploaded
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                      </>
                    )}
                  </p>
                </div>
                <button
                  className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => removeVideo(v.name)}
                  disabled={locked}
                  aria-label={`Remove ${v.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
