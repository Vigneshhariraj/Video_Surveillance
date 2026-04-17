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
 
        {/* Unified Dashboard Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* CONTINUOUS SIDBAR: Setup, Configuration & Actions */}
          <div className="xl:col-span-3 space-y-6">
            <VideoUpload />
            <ConfigPanel />
            <ControlsPanel />
          </div>
 
          {/* MAIN MONITORING AREA */}
          <div className="xl:col-span-9 space-y-6">
            {/* Upper Content: Monitoring and Live Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
               <div className="lg:col-span-8 flex flex-col">
                  <VideoPlayer className="h-full" />
               </div>
               <div className="lg:col-span-4 flex flex-col">
                  <EventPanel className="h-full" />
               </div>
            </div>
 
            {/* Lower Content: Detailed Data History */}
            <div className="w-full">
              <LogsTable />
            </div>
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
