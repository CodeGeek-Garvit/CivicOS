import React, { useState, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { SavedIssue } from "../types";
import { 
  Layers, MapPin, AlertTriangle, ShieldCheck, HelpCircle, Sparkles, Clock, 
  Search, ShieldAlert, Cpu, Eye, BarChart3, Users, ChevronRight, Lock, Map as MapIcon, RefreshCw, AppWindow
} from "lucide-react";

// Google Maps Platform API Key setup
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface MapDashboardProps {
  issues: SavedIssue[];
  onSelectIssue?: (issue: SavedIssue) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function MapDashboard({ issues, onSelectIssue, onRefresh, isLoading }: MapDashboardProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeWardFilter, setActiveWardFilter] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string | null>(null); // "all" | "critical" | "high" | "low"
  const [searchQuery, setSearchQuery] = useState("");

  // Temporary Diagnostics Logging for Environment Variables
  React.useEffect(() => {
    console.log("=== GOOGLE MAPS ENV DIAGNOSTICS ===");
    console.log("process.env.GOOGLE_MAPS_PLATFORM_KEY:", typeof process.env !== "undefined" ? process.env.GOOGLE_MAPS_PLATFORM_KEY : "undefined (process.env is undefined)");
    console.log("import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY:", (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY);
    console.log("globalThis.GOOGLE_MAPS_PLATFORM_KEY:", (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY);
    console.log("Final API_KEY selected:", API_KEY);
    console.log("====================================");
  }, []);

  // Simulated layout style selection: dark-silver Map styling
  const mapStyle = useMemo(() => [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
  ], []);

  // Pune coordinates center
  const defaultCenter = { lat: 18.5204, lng: 73.8567 };

  // Calculate stats
  const stats = useMemo(() => {
    const total = issues.length;
    const critical = issues.filter(i => i.severity >= 8).length;
    const high = issues.filter(i => i.severity >= 5 && i.severity <= 7).length;
    const low = issues.filter(i => i.severity >= 1 && i.severity <= 4).length;
    
    // Ward stats
    const wardMap: Record<string, number> = {};
    issues.forEach(i => {
      const w = i.ward || "Unassigned";
      wardMap[w] = (wardMap[w] || 0) + 1;
    });

    return { total, critical, high, low, wardMap };
  }, [issues]);

  // Filter issues based on UI selections
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = issue.title?.toLowerCase().includes(query);
        const matchesDesc = issue.description?.toLowerCase().includes(query);
        const matchesId = issue.id?.toLowerCase().includes(query);
        const matchesType = issue.issueType?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesId && !matchesType) return false;
      }

      // Ward Filter
      if (activeWardFilter && issue.ward !== activeWardFilter) return false;

      // Category Type Filter
      if (activeTypeFilter && issue.issueType !== activeTypeFilter) return false;

      // Severity Filter
      if (activeSeverityFilter) {
        if (activeSeverityFilter === "critical" && issue.severity < 8) return false;
        if (activeSeverityFilter === "high" && (issue.severity < 5 || issue.severity > 7)) return false;
        if (activeSeverityFilter === "low" && issue.severity > 4) return false;
      }

      return true;
    });
  }, [issues, searchQuery, activeWardFilter, activeTypeFilter, activeSeverityFilter]);

  // Find the selected issue to show in InfoWindow/Sidebar Detail
  const selectedIssue = useMemo(() => {
    return issues.find(i => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  // Helper for category-specific styling
  const getCategoryTheme = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case "pothole":
        return { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Roads" };
      case "water_leakage":
        return { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Water" };
      case "damaged_streetlight":
        return { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Lighting" };
      case "waste_overflow":
        return { color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "Sanitation" };
      case "infrastructure_damage":
        return { color: "bg-rose-500/10 text-rose-500 border-rose-500/20", label: "Structural" };
      default:
        return { color: "bg-slate-500/10 text-slate-500 border-slate-500/20", label: "General" };
    }
  };

  // Helper for marker colors based on severity
  const getMarkerColors = (score: number) => {
    if (score >= 8) {
      return { background: "#EF4444", glyphColor: "#FFFFFF", text: "text-rose-500", label: "Critical" };
    }
    if (score >= 5) {
      return { background: "#F59E0B", glyphColor: "#FFFFFF", text: "text-amber-500", label: "High" };
    }
    return { background: "#10B981", glyphColor: "#FFFFFF", text: "text-emerald-500", label: "Low" };
  };

  // Mandatory splash screen if key is invalid
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] font-sans px-6 bg-slate-900 text-white rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="max-w-lg text-center p-8 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <MapIcon className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Google Maps SDK Connection Required</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              To power the real-time geographic dispatch layer, please provide your Google Maps API Key in AI Studio Secrets.
            </p>
          </div>
          
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-left text-xs space-y-3">
            <p className="font-bold text-slate-300 flex items-center gap-1.5"><Sparkles className="h-4.5 w-4.5 text-indigo-400" /> Key Setup Sequence:</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-400 font-medium">
              <li>Open <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">Google Maps Console</a> and generate an API key.</li>
              <li>Click the <strong>Settings</strong> (⚙️ gear icon, top-right corner) of AI Studio.</li>
              <li>Select <strong>Secrets</strong>, add a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code>, paste your key, and save.</li>
            </ol>
          </div>
          
          <p className="text-xs text-slate-500 italic">
            * Note: The platform will automatically rebuild the bundle upon secret entry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[82vh] overflow-hidden" id="map-dashboard-viewport">
      
      {/* LEFT COLUMN: Map Intelligence sidebar & controls (4 cols) */}
      <div className="xl:col-span-4 flex flex-col gap-5 h-full overflow-y-auto pr-1" id="map-dashboard-sidebar">
        
        {/* Civic Operations Command Stats */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Operations Live Feed
              </span>
              <button 
                onClick={onRefresh} 
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all disabled:opacity-50"
                title="Force Refresh Data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white mb-1">Pune Intelligence Ledger</h3>
            <p className="text-xs text-slate-400 font-medium mb-4">Realtime spatial index of reported municipal anomalies.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Critical</p>
              <p className="text-xl font-black text-rose-500 mt-1">{stats.critical}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">High</p>
              <p className="text-xl font-black text-amber-500 mt-1">{stats.high}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Low</p>
              <p className="text-xl font-black text-emerald-500 mt-1">{stats.low}</p>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Dynamic Map Filters
            </h4>
            {(activeWardFilter || activeTypeFilter || activeSeverityFilter || searchQuery) && (
              <button 
                onClick={() => {
                  setActiveWardFilter(null);
                  setActiveTypeFilter(null);
                  setActiveSeverityFilter(null);
                  setSearchQuery("");
                }}
                className="text-[10px] text-indigo-600 hover:underline font-bold uppercase"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <input 
              type="text"
              placeholder="Search by ID, keyword, or ward..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 outline-none rounded-xl py-2.5 pl-9 pr-4 transition-all"
            />
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
          </div>

          {/* Ward Filters */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Pune Ward Boundaries</p>
            <div className="flex flex-wrap gap-1.5">
              {["Shivajinagar", "Kothrud", "Viman Nagar", "Hadapsar"].map(ward => (
                <button
                  key={ward}
                  onClick={() => setActiveWardFilter(activeWardFilter === ward ? null : ward)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                    activeWardFilter === ward
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {ward} ({stats.wardMap[ward] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Severity filter tabs */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Severity Profile</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: null, label: "All" },
                { id: "critical", label: "Critical (8-10)", color: "text-rose-500 border-rose-200" },
                { id: "high", label: "High (5-7)", color: "text-amber-500 border-amber-200" },
                { id: "low", label: "Low (1-4)", color: "text-emerald-500 border-emerald-200" }
              ].map(sev => (
                <button
                  key={sev.id || "all"}
                  onClick={() => setActiveSeverityFilter(sev.id)}
                  className={`text-[10px] px-1 py-2 rounded-lg border font-bold transition-all text-center leading-tight ${
                    activeSeverityFilter === sev.id
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ARCHITECTURE PREPARATION FOR SPRINT 2 (Locked Modules) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4.5 w-4.5 text-indigo-600" />
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Sprint 2 Architecture</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            The core routing schema and type signatures have been compiled. Ready for deployment in subsequent sprints.
          </p>

          <div className="space-y-2 text-xs">
            {/* Heatmaps */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">D3/deck.gl Spatial Heatmaps</span>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 border border-indigo-100 rounded-full flex items-center gap-1">
                <Lock className="h-2 w-2" /> STRUCT READY
              </span>
            </div>

            {/* Duplicate Detection */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">Text & Proximity Duplicate Check</span>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 border border-indigo-100 rounded-full flex items-center gap-1">
                <Lock className="h-2 w-2" /> STRUCT READY
              </span>
            </div>

            {/* Shadow Problems */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">Under-reported Shadow Problems</span>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 border border-indigo-100 rounded-full flex items-center gap-1">
                <Lock className="h-2 w-2" /> STRUCT READY
              </span>
            </div>

            {/* Priority Engine */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">Priority Dispatch Engine</span>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 border border-indigo-100 rounded-full flex items-center gap-1">
                <Lock className="h-2 w-2" /> STRUCT READY
              </span>
            </div>

            {/* Authority Dashboard */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">Authority Dispatch Console</span>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 border border-indigo-100 rounded-full flex items-center gap-1">
                <Lock className="h-2 w-2" /> STRUCT READY
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Map Frame (8 cols) */}
      <div className="xl:col-span-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative flex flex-col h-full" id="map-dashboard-canvas">
        
        {/* Floating Top Stats / Legend Bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-2 items-center justify-between bg-slate-950/90 backdrop-blur border border-slate-800 rounded-2xl p-3 shadow-lg" id="map-canvas-controls">
          <div className="flex items-center gap-2 text-white">
            <MapIcon className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-xs font-extrabold">Geographic Centrifuge Panel</p>
              <p className="text-[9px] text-slate-400 font-medium">Displaying {filteredIssues.length} active markers of {issues.length} total</p>
            </div>
          </div>

          {/* Pin color legend */}
          <div className="flex items-center gap-3.5 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-[10px] font-bold text-slate-300">
            <span className="text-[9px] text-slate-500 uppercase">PRIORITY LEGEND:</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-rose-400"></span>
              <span>Critical (8-10)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 border border-amber-400"></span>
              <span>High (5-7)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-400"></span>
              <span>Low (1-4)</span>
            </div>
          </div>
        </div>

        {/* Map Core Canvas */}
        <div className="flex-1 w-full h-full min-h-[300px]">
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={12}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              disableDefaultUI={false}
              options={{ styles: mapStyle }}
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              style={{ width: "100%", height: "100%" }}
            >
              {filteredIssues.map((issue) => {
                const lat = issue.location?.latitude || defaultCenter.lat;
                const lng = issue.location?.longitude || defaultCenter.lng;
                const colorConfig = getMarkerColors(issue.severity);

                return (
                  <AdvancedMarker
                    key={issue.id}
                    position={{ lat, lng }}
                    onClick={() => setSelectedIssueId(issue.id === selectedIssueId ? null : issue.id)}
                  >
                    <Pin 
                      background={colorConfig.background} 
                      borderColor="#ffffff" 
                      glyphColor={colorConfig.glyphColor} 
                      scale={1.05}
                    />
                  </AdvancedMarker>
                );
              })}

              {/* Realtime Click Marker Popup */}
              {selectedIssue && (
                <InfoWindow
                  position={{
                    lat: selectedIssue.location?.latitude || defaultCenter.lat,
                    lng: selectedIssue.location?.longitude || defaultCenter.lng
                  }}
                  onCloseClick={() => setSelectedIssueId(null)}
                  maxWidth={320}
                >
                  <div className="p-2 font-sans space-y-3 text-slate-900 max-h-96 overflow-y-auto" id={`info-popup-${selectedIssue.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 border rounded uppercase tracking-wider ${getCategoryTheme(selectedIssue.issueType).color}`}>
                          {getCategoryTheme(selectedIssue.issueType).label}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          getMarkerColors(selectedIssue.severity).background === "#EF4444" 
                            ? "bg-rose-50 border-rose-200 text-rose-700" 
                            : getMarkerColors(selectedIssue.severity).background === "#F59E0B"
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        }`}>
                          Sev: {selectedIssue.severity}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{selectedIssue.title}</h4>
                    </div>

                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed leading-snug">
                      {selectedIssue.description}
                    </p>

                    {selectedIssue.imageUrl && (
                      <img 
                        src={selectedIssue.imageUrl} 
                        alt="Evidence evidence" 
                        className="h-28 w-full object-cover rounded-lg border border-slate-200 bg-white shadow-sm"
                      />
                    )}

                    <div className="space-y-1.5 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                      <div className="flex justify-between">
                        <span>Confidence Threshold:</span>
                        <span className="text-slate-800">{(selectedIssue.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status Dispatch:</span>
                        <span className="uppercase text-indigo-600">{selectedIssue.status || "reported"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Report Time:</span>
                        <span className="text-slate-800">{new Date(selectedIssue.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {selectedIssue.reasoning && selectedIssue.reasoning.length > 0 && (
                      <div className="border-t border-slate-100 pt-2 space-y-1">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">AI Reasoning:</p>
                        <ul className="list-disc list-inside space-y-1 text-[10px] text-slate-600 font-medium leading-relaxed">
                          {selectedIssue.reasoning.slice(0, 2).map((item, index) => (
                            <li key={index} className="truncate">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>

        {/* Floating Bottom Card: Detailed focus view of active marker */}
        {selectedIssue && (
          <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-2xl p-4 text-white shadow-xl flex gap-4 max-h-[160px] overflow-hidden" id="focus-issue-panel">
            {selectedIssue.imageUrl && (
              <img 
                src={selectedIssue.imageUrl} 
                alt="Selected issue" 
                className="h-20 w-20 object-cover rounded-xl bg-slate-900 border border-slate-800 shrink-0 self-center"
              />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 border rounded uppercase ${getCategoryTheme(selectedIssue.issueType).color}`}>
                  {getCategoryTheme(selectedIssue.issueType).label}
                </span>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 border rounded uppercase text-rose-500 bg-rose-500/10 border-rose-500/20`}>
                  Sev: {selectedIssue.severity}/10
                </span>
                <span className="text-[8px] font-mono text-slate-400">ID: {selectedIssue.id}</span>
              </div>
              <h4 className="text-xs font-black truncate">{selectedIssue.title}</h4>
              <p className="text-[10px] text-slate-300 font-medium line-clamp-2 leading-relaxed">{selectedIssue.description}</p>
              <p className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                <Clock className="h-3 w-3" /> Reported: {new Date(selectedIssue.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
