import { Header } from "@/components/dashboard/Header";
import { VideoUpload } from "@/components/dashboard/VideoUpload";
import { VideoPlayer } from "@/components/dashboard/VideoPlayer";
import { EventPanel } from "@/components/dashboard/EventPanel";
import { StatsPanel } from "@/components/dashboard/StatsPanel";
import { LogsTable } from "@/components/dashboard/LogsTable";
import { ConfigPanel } from "@/components/dashboard/ConfigPanel";
import { ControlsPanel } from "@/components/dashboard/ControlsPanel";
import { usePolling } from "@/hooks/usePolling";

const Index = () => {
  // Centralised polling — starts/stops based on processing state in the store
  usePolling(1500);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
 
      <main className="container py-6 space-y-6 flex-1">
        {/* Stats — full width */}
        <StatsPanel />
 
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* ROW 1: Setup, Player, and Live Alerts */}
          <div className="xl:col-span-3 space-y-6">
            <VideoUpload />
          </div>
          
          <div className="xl:col-span-6">
            <VideoPlayer />
          </div>
          
          <div className="xl:col-span-3">
            <EventPanel />
          </div>
 
          {/* ROW 2: Configuration, Controls, and Detailed Logs */}
          <div className="xl:col-span-3 space-y-6">
            <ConfigPanel />
            <ControlsPanel />
          </div>
 
          <div className="xl:col-span-9">
            <LogsTable />
          </div>
        </div>
      </main>

      <footer className="container py-6 text-center text-xs text-muted-foreground">
        Surveillance Dashboard · Real-time monitoring dashboard
      </footer>
    </div>
  );
};

export default Index;
