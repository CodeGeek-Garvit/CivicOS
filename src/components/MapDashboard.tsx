import React, { useState, useMemo, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from "@vis.gl/react-google-maps";
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
  isLiveMode: boolean;
  userLocation: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
    locationSource: "GPS" | "ReverseGeocoded" | "DemoSeed";
  } | null;
  onPromptGPS: () => void;
  gpsStatus: "idle" | "requesting" | "success" | "denied" | "error";
  newlyUploadedIssueId?: string | null;
  onClearNewlyUploaded?: () => void;
}

// Pune coordinates center
const defaultCenter = { lat: 18.5204, lng: 73.8567 };

const WARD_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Shivajinagar": { lat: 18.525, lng: 73.845 },
  "Kothrud": { lat: 18.505, lng: 73.815 },
  "Viman Nagar": { lat: 18.562, lng: 73.912 },
  "Hadapsar": { lat: 18.502, lng: 73.928 }
};

function MapDashboardContent({
  issues,
  onSelectIssue,
  onRefresh,
  isLoading,
  isLiveMode,
  userLocation,
  onPromptGPS,
  gpsStatus,
  newlyUploadedIssueId,
  onClearNewlyUploaded
}: MapDashboardProps) {
  const map = useMap();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeWardFilter, setActiveWardFilter] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string | null>(null); // "all" | "critical" | "high" | "low"
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Center map on live location or default center on load or toggle
  useEffect(() => {
    if (!map) return;
    if (isLiveMode && userLocation) {
      map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude });
      map.setZoom(13);
    } else {
      map.setCenter(defaultCenter);
      map.setZoom(12);
    }
  }, [map, isLiveMode, userLocation]);

  // Live Issue Highlight: Detect newly uploaded issue, pan map, zoom, and select/highlight it
  useEffect(() => {
    if (!newlyUploadedIssueId || !map) return;

    const targetIssue = issues.find(i => i.id === newlyUploadedIssueId);
    if (targetIssue && targetIssue.location) {
      const lat = targetIssue.location.latitude;
      const lng = targetIssue.location.longitude;

      map.setCenter({ lat, lng });
      map.setZoom(15);
      setSelectedIssueId(newlyUploadedIssueId);

      const timer = setTimeout(() => {
        if (onClearNewlyUploaded) {
          onClearNewlyUploaded();
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [newlyUploadedIssueId, map, issues, onClearNewlyUploaded]);

  // Google Places Autocomplete Fetcher
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    if (typeof google === "undefined" || !google.maps || !google.maps.places) {
      return;
    }

    const autocompleteService = new google.maps.places.AutocompleteService();
    const delayDebounceFn = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        { input: searchQuery },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
          } else {
            setSuggestions([]);
          }
        }
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle outside click to hide suggestions
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowSuggestions(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // 1. Separate Live and Demo issues
  const liveIssues = useMemo(() => {
    return issues.filter(i => i.isDemoMode !== true && !i.id.startsWith("issue_mock_"));
  }, [issues]);

  const demoIssues = useMemo(() => {
    return issues.filter(i => i.isDemoMode === true || i.id.startsWith("issue_mock_"));
  }, [issues]);

  // 2. Active issues list based on current Mode with robust deduplication by ID
  const activeIssuesList = useMemo(() => {
    const rawList = isLiveMode ? liveIssues : demoIssues;
    const seen = new Set<string>();
    return rawList.filter(item => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [isLiveMode, liveIssues, demoIssues]);

  // 3. Stats based on current Mode
  const stats = useMemo(() => {
    const total = activeIssuesList.length;
    const critical = activeIssuesList.filter(i => i.severity >= 8).length;
    const high = activeIssuesList.filter(i => i.severity >= 5 && i.severity <= 7).length;
    const low = activeIssuesList.filter(i => i.severity >= 1 && i.severity <= 4).length;
    
    // Ward/Region stats
    const wardMap: Record<string, number> = {};
    activeIssuesList.forEach(i => {
      const w = i.ward || i.city || "Unassigned";
      wardMap[w] = (wardMap[w] || 0) + 1;
    });

    return { total, critical, high, low, wardMap };
  }, [activeIssuesList]);

  // Dynamic Wards/Regions list based on current Mode
  const activeWardsList = useMemo(() => {
    if (!isLiveMode) {
      return ["Shivajinagar", "Kothrud", "Viman Nagar", "Hadapsar"];
    }
    const uniqueWards = new Set<string>();
    liveIssues.forEach(issue => {
      if (issue.ward) uniqueWards.add(issue.ward);
      else if (issue.city) uniqueWards.add(issue.city);
    });
    const list = Array.from(uniqueWards);
    return list.length > 0 ? list : [];
  }, [isLiveMode, liveIssues]);

  // 4. Filter issues based on UI selections and deduplicate
  const filteredIssues = useMemo(() => {
    const seenIds = new Set<string>();
    return activeIssuesList.filter(issue => {
      if (!issue.id || seenIds.has(issue.id)) return false;

      // Ward/Region Filter
      if (activeWardFilter) {
        const matchesWard = issue.ward === activeWardFilter || issue.city === activeWardFilter;
        if (!matchesWard) return false;
      }

      // Category Type Filter
      if (activeTypeFilter && issue.issueType !== activeTypeFilter) return false;

      // Severity Filter
      if (activeSeverityFilter) {
        if (activeSeverityFilter === "critical" && issue.severity < 8) return false;
        if (activeSeverityFilter === "high" && (issue.severity < 5 || issue.severity > 7)) return false;
        if (activeSeverityFilter === "low" && issue.severity > 4) return false;
      }

      seenIds.add(issue.id);
      return true;
    });
  }, [activeIssuesList, activeWardFilter, activeTypeFilter, activeSeverityFilter]);

  // Find the selected issue to show in InfoWindow/Sidebar Detail
  const selectedIssue = useMemo(() => {
    return activeIssuesList.find(i => i.id === selectedIssueId) || null;
  }, [activeIssuesList, selectedIssueId]);

  // Google Places Suggestion selection handler
  const handleSuggestionSelect = (suggestion: google.maps.places.AutocompletePrediction) => {
    if (typeof google === "undefined" || !google.maps) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        if (map) {
          map.setCenter({ lat, lng });
          map.setZoom(14);
        }
        
        setSearchQuery(suggestion.description);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  // Google Geocoder query search submit handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    if (typeof google === "undefined" || !google.maps) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        if (map) {
          map.setCenter({ lat, lng });
          map.setZoom(14);
        }
        setSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  const handleWardFilterClick = (ward: string) => {
    if (activeWardFilter === ward) {
      setActiveWardFilter(null);
    } else {
      setActiveWardFilter(ward);
      // Center map on the ward if in Demo Mode and has center defined
      if (!isLiveMode && WARD_CENTERS[ward] && map) {
        map.setCenter(WARD_CENTERS[ward]);
        map.setZoom(14);
      }
    }
  };

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[82vh] overflow-hidden" id="map-dashboard-viewport">
      
      {/* LEFT COLUMN: Map Intelligence sidebar & controls (4 cols) */}
      <div className="xl:col-span-4 flex flex-col gap-5 h-full overflow-y-auto pr-1" id="map-dashboard-sidebar">
        
        {/* Civic Operations Command Stats */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isLiveMode ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                {isLiveMode ? "Operations Live Feed" : "Simulated Operations Demo"}
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
            <h3 className="text-lg font-black tracking-tight text-white mb-1">
              {isLiveMode ? "Live Intelligence Ledger" : "Pune Intelligence Ledger"}
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-4">
              {isLiveMode 
                ? "Realtime spatial index of reported municipal anomalies in your jurisdiction." 
                : "Realtime spatial index of pre-seeded municipal anomalies in Pune."}
            </p>
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

        {/* GIS Location Status Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <MapPin className="h-4 w-4 text-indigo-600" />
            GIS Spatial Reference
          </h4>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Platform Mode:</span>
              <span className={`font-bold uppercase text-[10px] ${isLiveMode ? "text-emerald-600" : "text-amber-600"}`}>
                {isLiveMode ? "Live Mode Active" : "Demo Mode Active"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Jurisdiction:</span>
              <span className="font-bold text-slate-800 truncate max-w-[180px]">
                {isLiveMode && userLocation ? `${userLocation.city}, ${userLocation.state}` : "Pune, Maharashtra"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Coordinates:</span>
              <span className="font-mono text-[10px] text-slate-600">
                {isLiveMode && userLocation 
                  ? `${userLocation.latitude.toFixed(4)}°, ${userLocation.longitude.toFixed(4)}°` 
                  : "18.5204°, 73.8567°"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Location Source:</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase">
                {isLiveMode && userLocation ? userLocation.locationSource : "DemoSeed"}
              </span>
            </div>
          </div>
        </div>

        {/* GPS Permission Warning / Retry Alert */}
        {!isLiveMode && (gpsStatus === "denied" || gpsStatus === "error") && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="text-xs">
              <h5 className="font-extrabold uppercase tracking-wide text-amber-900">GPS Permission Requested</h5>
              <p className="mt-1 font-medium leading-relaxed">
                Browser GPS is currently disabled or blocked. Please enable location access to automatically log newly reported anomalies in your local city.
              </p>
              <button
                onClick={onPromptGPS}
                className="mt-2 text-[10px] font-bold text-indigo-600 hover:underline uppercase block"
              >
                Retry Geolocation Connect
              </button>
            </div>
          </div>
        )}

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

          {/* Proper Google Places Autocomplete Search Box */}
          <div className="relative">
            <form onSubmit={handleSearchSubmit}>
              <input 
                type="text"
                placeholder="Search cities, roads, states..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 outline-none rounded-xl py-2.5 pl-9 pr-10 transition-all font-medium"
              />
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSuggestions([]);
                  }}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-sm"
                >
                  ×
                </button>
              )}
            </form>

            {/* Suggestions list */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => handleSuggestionSelect(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs text-slate-700 font-medium transition-colors truncate block"
                  >
                    📍 {s.description}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ward Filters (Administrative Boundaries) */}
          {activeWardsList.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {isLiveMode ? "Active Regions" : "Pune Ward Boundaries"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeWardsList.map(ward => (
                  <button
                    key={ward}
                    onClick={() => handleWardFilterClick(ward)}
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
          )}

          {/* Severity filter tabs */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Severity Profile</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: null, label: "All" },
                { id: "critical", label: "Critical (8-10)" },
                { id: "high", label: "High (5-7)" },
                { id: "low", label: "Low (1-4)" }
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
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-xs font-extrabold">Geographic Centrifuge Panel</p>
                <p className="text-[9px] text-slate-400 font-medium">Displaying {filteredIssues.length} active markers of {issues.length} total</p>
              </div>
            </div>
            
            {/* Live vs Demo Visual Status Badge */}
            <div className="flex items-center gap-2">
              {isLiveMode ? (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live GIS Active
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    Demo Active
                  </span>
                  <button
                    onClick={onPromptGPS}
                    disabled={gpsStatus === "requesting"}
                    className="text-[8px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded transition-all uppercase tracking-wide"
                  >
                    {gpsStatus === "requesting" ? "Connecting..." : "Enable GPS"}
                  </button>
                </div>
              )}
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
              const isNewlyUploaded = issue.id === newlyUploadedIssueId;

              return (
                <AdvancedMarker
                  key={issue.id}
                  position={{ lat, lng }}
                  onClick={() => setSelectedIssueId(issue.id === selectedIssueId ? null : issue.id)}
                >
                  <div className={isNewlyUploaded ? "animate-bounce scale-125 transition-all duration-300 relative z-50" : ""}>
                    <Pin 
                      background={colorConfig.background} 
                      borderColor="#ffffff" 
                      glyphColor={colorConfig.glyphColor} 
                      scale={isNewlyUploaded ? 1.25 : 1.05}
                    />
                    {isNewlyUploaded && (
                      <span className="absolute -inset-2 rounded-full bg-indigo-500/30 animate-ping -z-10"></span>
                    )}
                  </div>
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
                      <span>Location Source:</span>
                      <span className="uppercase text-indigo-600">{selectedIssue.locationSource || "GPS"}</span>
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

export default function MapDashboard(props: MapDashboardProps) {
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
    <APIProvider apiKey={API_KEY} version="weekly" libraries={["places"]}>
      <MapDashboardContent {...props} />
    </APIProvider>
  );
}
