import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, Image as ImageIcon, Loader2, CheckCircle, 
  AlertCircle, ArrowRight, ShieldAlert, Sparkles, 
  Activity, FileText, Database, Layers, Check, RefreshCw, Cpu,
  MapPin, HelpCircle, TriangleAlert, Thermometer, Gauge, Map as MapIcon, AppWindow,
  Info, ChevronDown, Mail, FileSpreadsheet, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MapDashboard from "./components/MapDashboard";
import { GeminiAnalysis, SavedIssue } from "./types";

const compressImage = (base64Str: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedIssuesList, setSavedIssuesList] = useState<SavedIssue[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "reporter">("map");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location / GIS Spatial States
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
    locationSource: "GPS" | "ReverseGeocoded" | "DemoSeed";
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "success" | "denied" | "error">("idle");
  const [newlyUploadedIssueId, setNewlyUploadedIssueId] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);
  const [showEmailPreview, setShowEmailPreview] = useState<boolean>(false);
  const [showSheetsPreview, setShowSheetsPreview] = useState<boolean>(false);

  const GOOGLE_MAPS_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    "";

  // Reverse Geocoding with Google Maps HTTP Geocode service
  const runReverseGeocoding = async (lat: number, lng: number) => {
    let city = "Unavailable";
    let state = "Unavailable";
    let country = "Unavailable";
    let isGeocoded = false;

    try {
      if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== "YOUR_API_KEY") {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
        );
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          const addressComponents = data.results[0].address_components;
          for (const comp of addressComponents) {
            if (comp.types.includes("locality")) {
              city = comp.long_name;
            } else if (comp.types.includes("administrative_area_level_1")) {
              state = comp.long_name;
            } else if (comp.types.includes("country")) {
              country = comp.long_name;
            }
          }
          if (!city || city === "Unavailable") {
            const subLoc = addressComponents.find((c: any) =>
              c.types.includes("sublocality") || c.types.includes("administrative_area_level_2")
            );
            if (subLoc) city = subLoc.long_name;
          }
          isGeocoded = true;
          console.log(`[CIVICOS GIS LOG] ✓ Reverse geocoding successful: ${city}, ${state}, ${country}`);
        } else {
          console.warn(`[CIVICOS GIS LOG] Reverse geocoding unavailable: status ${data.status}`);
        }
      } else {
        console.warn("[CIVICOS GIS LOG] Reverse geocoding unavailable: No Google Maps API Key available.");
      }
    } catch (err) {
      console.error("[CIVICOS GIS LOG] Reverse geocoding unavailable:", err);
    }

    if (!isGeocoded) {
      console.log("[CIVICOS GIS LOG] ✓ GPS acquired");
      console.log("[CIVICOS GIS LOG] ✓ Reverse geocoding unavailable");
      console.log("[CIVICOS GIS LOG] ✓ Using GPS coordinates only");
    }

    setUserLocation({
      latitude: lat,
      longitude: lng,
      city: city || "Unavailable",
      state: state || "Unavailable",
      country: country || "Unavailable",
      locationSource: isGeocoded ? "ReverseGeocoded" : "GPS"
    });
  };

  // Browser navigator geolocation connector
  const requestGPS = () => {
    setGpsStatus("requesting");
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setIsLiveMode(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        console.log(`[CIVICOS GIS LOG] GPS acquired: Latitude ${lat}, Longitude ${lng}`);
        setGpsStatus("success");
        setIsLiveMode(true);
        await runReverseGeocoding(lat, lng);
      },
      (err) => {
        setGpsStatus("denied");
        setIsLiveMode(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    requestGPS();
  }, []);

  // Load existing reports on mount and set up Realtime Firestore Sync
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupRealtimeSync = async () => {
      try {
        const response = await fetch("/api/firebase-config");
        if (!response.ok) {
          throw new Error("Failed to fetch client Firebase configuration.");
        }
        const data = await response.json();
        if (data.success && data.config) {
          const { initializeApp, getApps, getApp } = await import("firebase/app");
          const { getFirestore, collection, onSnapshot, query, orderBy } = await import("firebase/firestore");

          let clientApp;
          const apps = getApps();
          const existingApp = apps.find(app => app.name === "civicos-client");
          if (existingApp) {
            clientApp = existingApp;
          } else {
            clientApp = initializeApp(data.config, "civicos-client");
          }

          const clientDb = getFirestore(clientApp, data.config.databaseId);
          const q = query(collection(clientDb, "issues"), orderBy("createdAt", "desc"));

          unsubscribe = onSnapshot(q, (snapshot) => {
            const list: SavedIssue[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...(doc.data() as any) });
            });
            console.log("[CIVICOS GIS LOG] Realtime update");
            setSavedIssuesList(list);
          }, (err) => {
            console.error("🔗 [CIVICOS REALTIME] Firestore sync failed, falling back to HTTP polling:", err);
            fetchIssues();
          });
        } else {
          fetchIssues();
        }
      } catch (err) {
        console.warn("🔗 [CIVICOS REALTIME] Realtime initialization failed, relying on ledger API polling:", err);
        fetchIssues();
      }
    };

    setupRealtimeSync();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const fetchIssues = async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/issues");
      const data = await response.json();
      if (data.success) {
        setSavedIssuesList(data.issues || []);
      }
    } catch (err) {
      console.error("Failed to load issues ledger:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Convert uploaded file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPEG, WebP).");
      return;
    }
    setError(null);
    setAnalysisResult(null);
    setSaveSuccess(false);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressedBase64 = await compressImage(originalBase64);
        console.log(`[IMAGE COMPRESSION] Original size: ${(originalBase64.length / 1024).toFixed(1)} KB, Compressed size: ${(compressedBase64.length / 1024).toFixed(1)} KB`);
        setSelectedImage(compressedBase64);
      } catch (err) {
        console.error("Image compression error, falling back:", err);
        setSelectedImage(originalBase64);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Trigger Gemini Vision pipeline
  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setAnalyzing(true);
    setError(null);
    setAnalysisStep("Uploading image payload...");

    try {
      // Step 2: Simulate visual analysis steps for enhanced feedback
      setTimeout(() => setAnalysisStep("Initializing Gemini Vision Client..."), 800);
      setTimeout(() => setAnalysisStep("Decompressing visual features..."), 1600);
      setTimeout(() => setAnalysisStep("Running multimodal neural inference..."), 2400);

      const response = await fetch("/api/issues/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage, fileName: fileName })
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAnalysisResult(data.analysis);
      } else {
        throw new Error(data.error || "Vision analysis failed.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong during analysis.");
      setAnalysisResult(null);
    } finally {
      setAnalyzing(false);
      setAnalysisStep("");
    }
  };

  // Save validated result to Firestore
  const handleReportIssue = async () => {
    if (saving || !analysisResult || !selectedImage) return;

    setSaving(true);
    setError(null);

    const issueCoords = isLiveMode && userLocation ? {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude
    } : undefined;

    const payload = {
      issue: {
        ...analysisResult,
        imageUrl: selectedImage,
        location: issueCoords,
        city: isLiveMode && userLocation ? userLocation.city : "Pune",
        state: isLiveMode && userLocation ? userLocation.state : "Maharashtra",
        country: isLiveMode && userLocation ? userLocation.country : "India",
        locationSource: isLiveMode ? (GOOGLE_MAPS_KEY ? "ReverseGeocoded" : "GPS") : "DemoSeed",
        markerSource: isLiveMode ? "LIVE_UPLOAD" : "DEMO_DATA",
        isDemoMode: !isLiveMode
      }
    };

    try {
      const response = await fetch("/api/issues/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let responseData: any = null;
      try {
        responseData = await response.json();
      } catch (e) {
        // Ignore JSON parse error if body is not JSON
      }

      if (!response.ok) {
        throw new Error(responseData?.error || `Failed to save. Status: ${response.status}`);
      }

      if (responseData && responseData.success) {
        console.log("[CIVICOS GIS LOG] Upload complete");
        setSaveSuccess(true);
        if (responseData.issue?.id) {
          setNewlyUploadedIssueId(responseData.issue.id);
        }
        if (responseData.issue) {
          setAnalysisResult(responseData.issue);
        }
        // Refresh the ledger
        fetchIssues();
        // Switch tab to map and reset input elements after a brief duration
        setTimeout(() => {
          setActiveTab("map");
          setSelectedImage(null);
          setAnalysisResult(null);
          setSaveSuccess(false);
        }, 1500);
      } else {
        throw new Error(responseData?.error || "Save operation failed.");
      }
    } catch (err: any) {
      console.error("[CIVICOS GIS LOG] Save failed:", err.message || err);
      setError(err.message || "Failed to persist issue to Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const resetUploader = () => {
    setSelectedImage(null);
    setFileName(null);
    setAnalysisResult(null);
    setError(null);
    setSaveSuccess(false);
  };

  // Helper for category-specific colors and badges
  const getCategoryDetails = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case "pothole":
        return { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Road & Pavement" };
      case "water_leakage":
        return { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Water & Sanitation" };
      case "damaged_streetlight":
        return { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Electrical / Lighting" };
      case "waste_overflow":
        return { color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "Waste Management" };
      case "infrastructure_damage":
        return { color: "bg-rose-500/10 text-rose-500 border-rose-500/20", label: "Structural Hazard" };
      default:
        return { color: "bg-slate-500/10 text-slate-500 border-slate-500/20", label: "General Municipal" };
    }
  };

  // Severity color formatting
  const getSeverityStyle = (score: number) => {
    if (score >= 8) return { text: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30", label: "Critical Priority" };
    if (score >= 5) return { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Medium Severity" };
    return { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Minor Issue" };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" id="civicos-root">
      {/* Sleek Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4" id="header-container">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3" id="brand-logo-container">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-200">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
                CivicOS <span className="text-indigo-600 text-xs font-semibold px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full">Sprint 2 Ready</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">Autonomous Civic Intelligence Platform</p>
            </div>
          </div>

          {/* Segmented Tab Navigation Controls */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50" id="view-tabs-container">
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
                activeTab === "map"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-indigo-600"
              }`}
            >
              <MapIcon className="h-4 w-4" />
              <span>Geographic Intelligence Map</span>
            </button>
            <button
              onClick={() => setActiveTab("reporter")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
                activeTab === "reporter"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-indigo-600"
              }`}
            >
              <AppWindow className="h-4 w-4" />
              <span>AI Autonomous Intake Hub</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2" id="system-status-container">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono font-medium text-slate-500">SYSTEM STABLE</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {activeTab === "map" ? (
          /* SPRINT 2 CENTERPIECE: Map Dashboard view */
          <MapDashboard 
            issues={savedIssuesList} 
            onRefresh={fetchIssues} 
            isLoading={loadingList} 
            isLiveMode={isLiveMode}
            userLocation={userLocation}
            onPromptGPS={requestGPS}
            gpsStatus={gpsStatus}
            newlyUploadedIssueId={newlyUploadedIssueId}
            onClearNewlyUploaded={() => setNewlyUploadedIssueId(null)}
          />
        ) : (
          /* SPRINT 1: AI Autonomous Intake Hub view (Completely Preserved) */
          <>
            {/* Sprint Overview Card */}
            <div className="mb-8 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 rounded-2xl p-6 text-white shadow-xl shadow-slate-200" id="sprint-overview">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs text-indigo-300 font-semibold mb-4">
                  <Sparkles className="h-3 w.5" /> Core Pipeline Activated
                </div>
                <h2 className="text-2xl font-bold mb-2 tracking-tight">AI-Powered Multimodal Citizen Reporter</h2>
                <p className="text-indigo-200 text-sm leading-relaxed">
                  Upload photographic evidence of any public safety hazard or damaged local infrastructure. Our Gemini Vision Engine will instantly classify the problem category, assign an objective severity rating, compile rational reasoning points, and prepare a secure audit ledger record.
                </p>
              </div>
            </div>

            {/* Workspace Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" id="pipeline-workspace">
          
          {/* LEFT SIDE: Media Intake & Trigger Engine */}
          <div className="lg:col-span-5 space-y-6" id="left-workspace-column">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="upload-panel">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">1</span>
                Evidence Acquisition
              </h3>

              {/* Drag-and-Drop Area */}
              <div 
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  selectedImage 
                    ? "border-slate-300 bg-slate-50" 
                    : "border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-400 cursor-pointer"
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !selectedImage && fileInputRef.current?.click()}
                id="uploader-drop-zone"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />

                {selectedImage ? (
                  <div className="space-y-4" id="preview-container">
                    <img 
                      src={selectedImage} 
                      alt="Uploaded civic evidence" 
                      className="max-h-64 mx-auto rounded-lg object-contain shadow-md border border-slate-200 bg-white"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={resetUploader}
                        className="px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                        id="btn-remove-photo"
                      >
                        Remove Photo
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                        id="btn-change-photo"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-6" id="upload-prompt-container">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Drag & drop your issue image here</p>
                      <p className="text-xs text-slate-500 mt-1">or click to browse local files</p>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">Supports PNG, JPG, JPEG, and WebP (Max 10MB)</div>
                  </div>
                )}
              </div>

              {/* Action Buttons & Process Feedback */}
              {selectedImage && !analysisResult && (
                <div className="mt-6" id="analyze-actions">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-75 transition-all"
                    id="btn-trigger-analysis"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Run Gemini Vision Diagnostic</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Error Box */}
              {error && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700" id="error-container">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-rose-800">Pipeline Fault Detected</h4>
                    <p className="text-sm mt-1 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Active Loading Feedback Steps */}
              {analyzing && (
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" id="loading-steps-indicator">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analysis Stream</span>
                    <span className="text-xs font-mono text-indigo-600 font-semibold animate-pulse">Running Diagnostic</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: "70%" }}></div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                    <span>{analysisStep}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline State Status */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="process-log-panel">
              <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Diagnostic Log</h4>
              <div className="space-y-3" id="diagnostic-log-steps">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-600">
                  <div className="h-5 w-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px]">1</div>
                  <span>Client-Side Payload Prepared</span>
                </div>
                <div className={`flex items-center gap-2.5 text-xs font-semibold ${analyzing ? "text-indigo-600" : analysisResult ? "text-emerald-600" : "text-slate-400"}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${analyzing ? "bg-indigo-50 border border-indigo-200 text-indigo-600" : analysisResult ? "bg-emerald-50 border border-emerald-200 text-emerald-600" : "bg-slate-50 border border-slate-200"}`}>2</div>
                  <span>Gemini Vision Inference Call</span>
                </div>
                <div className={`flex items-center gap-2.5 text-xs font-semibold ${analysisResult ? "text-emerald-600" : "text-slate-400"}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${analysisResult ? "bg-emerald-50 border border-emerald-200 text-emerald-600" : "bg-slate-50 border border-slate-200"}`}>3</div>
                  <span>JSON Payload Struct Validation</span>
                </div>
                <div className={`flex items-center gap-2.5 text-xs font-semibold ${saveSuccess ? "text-emerald-600" : "text-slate-400"}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${saveSuccess ? "bg-emerald-50 border border-emerald-200 text-emerald-600" : "bg-slate-50 border border-slate-200"}`}>4</div>
                  <span>Firestore Transaction Committed</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Structured AI Diagnostic Results & Verification Ledger */}
          <div className="lg:col-span-7 space-y-8" id="right-workspace-column">
            
            <AnimatePresence mode="wait">
              {analysisResult ? (
                <motion.div 
                  key="analysis-workspace-container"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                  id="analysis-workspace-container"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" id="analysis-result-card">
                    {/* Status Banner */}
                    <div className={`px-6 py-4 flex items-center justify-between text-white ${analysisResult.isFallback ? "bg-rose-950" : "bg-indigo-900"}`} id="analysis-banner-header">
                      <div className="flex items-center space-x-2">
                        <Sparkles className={`h-5 w-5 ${analysisResult.isFallback ? "text-rose-400" : "text-indigo-300"}`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-200">
                          {analysisResult.isFallback ? "Local Diagnostic Backup" : "Gemini Structured Analysis"}
                        </span>
                      </div>
                      {analysisResult.isFallback ? (
                        <span className="text-[11px] font-extrabold bg-rose-500 text-white border border-rose-400 px-3 py-1 rounded-full flex items-center gap-1.5 uppercase font-sans shadow-sm animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-white"></span>
                          Fallback Analysis
                        </span>
                      ) : (
                        <span className="text-[11px] font-extrabold bg-emerald-600 text-white border border-emerald-500 px-3 py-1 rounded-full flex items-center gap-1.5 uppercase font-sans shadow-sm">
                          <span className="h-2 w-2 rounded-full bg-emerald-200 animate-ping"></span>
                          Gemini Analysis
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Header Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                          <span className={`text-xs font-bold px-3 py-1 border rounded-full uppercase tracking-wider ${getCategoryDetails(analysisResult.issueType).color}`}>
                            {getCategoryDetails(analysisResult.issueType).label}
                          </span>
                          <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full uppercase">
                            Type: {analysisResult.issueType}
                          </span>
                          {analysisResult.isFallback ? (
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full uppercase">
                              Fallback Analysis
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase">
                              Gemini Analysis
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-950 leading-tight">
                          {analysisResult.title}
                        </h3>
                        <p className="text-slate-600 text-sm mt-3 leading-relaxed font-medium">
                          {analysisResult.description}
                        </p>
                      </div>

                      {/* Multi-Factor KPI Widgets */}
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                        {/* Severity Scale */}
                        <div className={`p-4 rounded-xl border flex flex-col justify-between ${getSeverityStyle(analysisResult.severity).border} ${getSeverityStyle(analysisResult.severity).bg}`}>
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider">Severity Rating</span>
                            <TriangleAlert className={`h-4 w-4 ${getSeverityStyle(analysisResult.severity).text}`} />
                          </div>
                          <div>
                            <span className={`text-3xl font-black tracking-tighter ${getSeverityStyle(analysisResult.severity).text}`}>
                              {analysisResult.severity}
                            </span>
                            <span className="text-xs text-slate-500 font-bold"> / 10</span>
                          </div>
                          <p className={`text-[10px] font-extrabold uppercase mt-1 ${getSeverityStyle(analysisResult.severity).text}`}>
                            {getSeverityStyle(analysisResult.severity).label}
                          </p>
                        </div>

                        {/* Confidence Level */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider">Confidence Coefficient</span>
                            <Gauge className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <span className="text-3xl font-black text-slate-900 tracking-tighter">
                              {(analysisResult.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-extrabold uppercase mt-1">
                            Precision Threshold Match
                          </p>
                        </div>
                      </div>

                      {/* Rationale Bullet Points */}
                      <div className="border-t border-slate-100 pt-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">AI Diagnostic Evidence & Rationale</h4>
                        <ul className="space-y-2.5">
                          {analysisResult.reasoning.map((reason, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <Check className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Save Submission Action */}
                      <div className="border-t border-slate-100 pt-5">
                        {saveSuccess ? (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-sm font-bold">Issue Saved to Secure Ledger</p>
                              <p className="text-xs mt-0.5 text-emerald-600">Committed to Firestore collection `/issues` successfully.</p>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleReportIssue}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold text-sm py-4 px-4 rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-75 transition-all"
                            id="btn-report-issue"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Writing transaction to Firestore...</span>
                              </>
                            ) : (
                              <>
                                <Database className="h-4 w-4" />
                                <span>Commit & Register Issue to Firestore</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                               {/* COST OF INACTION CARD (Sprint 3) */}
                  {(() => {
                    const costOfInaction = analysisResult?.costOfInaction || {};
                    const baseCost = costOfInaction.baseCost !== undefined ? costOfInaction.baseCost : 3000;
                    const minCost = costOfInaction.minCost !== undefined ? costOfInaction.minCost : 3000;
                    const maxCost = costOfInaction.maxCost !== undefined ? costOfInaction.maxCost : 8000;
                    const assetLabel = costOfInaction.assetLabel || "Municipal Infrastructure";
                    const extentLabel = costOfInaction.extentLabel || "Moderate";
                    const damageMultiplier = costOfInaction.damageMultiplier !== undefined ? costOfInaction.damageMultiplier : 1.5;
                    const decay30 = costOfInaction.decay30 !== undefined ? costOfInaction.decay30 : 2.1;
                    const decay90 = costOfInaction.decay90 !== undefined ? costOfInaction.decay90 : 5.8;

                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6" id="cost-of-inaction-card">
                        <div className="pb-4 border-b border-slate-100 space-y-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="bg-amber-50 text-amber-600 p-2 rounded-xl border border-amber-200/50">
                              <TriangleAlert className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-black tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                                ⚠ Cost of Inaction
                              </h3>
                              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Municipal Financial & Safety Risk Audit</p>
                            </div>
                          </div>
                          
                          <div className="pt-1 pl-10">
                            <button
                              onClick={() => setShowMethodology(!showMethodology)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
                              id="btn-toggle-methodology"
                              type="button"
                            >
                              <span>ⓘ How is this calculated?</span>
                              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showMethodology ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Methodology Panel */}
                        <AnimatePresence initial={false}>
                          {showMethodology && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                              id="methodology-panel-container"
                            >
                              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-4 text-xs font-medium text-slate-700 leading-normal mb-2">
                                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Cost Estimation Methodology</span>
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">
                                    Rule Engine V1.0
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Base Repair Cost</span>
                                    <span className="font-black text-slate-900 text-xs">₹{baseCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                                    <span className="text-[9px] text-slate-500 block leading-tight">(range: ₹{minCost.toLocaleString("en-IN")} - ₹{maxCost.toLocaleString("en-IN")})</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Asset Type</span>
                                    <span className="font-bold text-slate-900 text-xs block">{assetLabel}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Damage Extent</span>
                                    <span className="font-bold text-slate-900 text-xs block">{extentLabel}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Severity Rating</span>
                                    <span className="font-black text-slate-900 text-xs block">{analysisResult.severity} / 10</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Repair Multiplier</span>
                                    <span className="font-bold text-slate-900 text-xs block">×{damageMultiplier.toFixed(1)}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">30-Day Deterioration Profile</span>
                                    <span className="font-bold text-slate-900 text-xs block">×{decay30.toFixed(1)}</span>
                                  </div>

                                  <div className="col-span-2">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">90-Day Deterioration Profile</span>
                                    <span className="font-bold text-slate-900 text-xs block">×{decay90.toFixed(1)}</span>
                                  </div>
                                </div>

                                <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                                  <span>Estimated Using</span>
                                  <span className="font-bold text-slate-800">Deterministic municipal models</span>
                                </div>

                                <div className="bg-white border border-slate-100 p-2.5 rounded-lg text-[10px] font-medium text-slate-500 leading-relaxed shadow-xs">
                                  These estimates are generated using deterministic engineering models designed for municipal prioritization. They are intended to support planning and resource allocation rather than exact procurement quotations.
                                </div>

                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50/50 p-2 rounded-md border border-indigo-100/50">
                                  <ShieldAlert className="h-3 w-3 shrink-0" />
                                  <span>Confidence Level: High (Deterministic Rule Engine)</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* The Cost Projection Timeline */}
                        <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4" id="cost-trajectory-panel">
                          <div className="text-center space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block leading-tight">Repair Today</span>
                            <div className="text-lg font-black text-slate-900 leading-none">
                              ₹{analysisResult.costOfInaction?.repairCostNow?.toLocaleString("en-IN") || "4,500"}
                            </div>
                            <span className="text-[9px] font-semibold text-emerald-600 uppercase bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded-full inline-block mt-1">Base Cost</span>
                          </div>

                          <div className="text-center space-y-1 border-l border-slate-200">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block leading-tight">After 30 Days</span>
                            <div className="text-lg font-black text-amber-600 leading-none">
                              ₹{analysisResult.costOfInaction?.repairCost30Days?.toLocaleString("en-IN") || "9,400"}
                            </div>
                            <span className="text-[9px] font-extrabold text-amber-700 uppercase bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full inline-block mt-1">
                              +{analysisResult.costOfInaction?.costIncrease30 || "109"}%
                            </span>
                          </div>

                          <div className="text-center space-y-1 border-l border-slate-200">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block leading-tight">After 90 Days</span>
                            <div className="text-lg font-black text-rose-600 leading-none">
                              ₹{analysisResult.costOfInaction?.repairCost90Days?.toLocaleString("en-IN") || "24,800"}
                            </div>
                            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-full inline-block mt-1 animate-pulse">
                              +{analysisResult.costOfInaction?.costIncrease90 || "451"}%
                            </span>
                          </div>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                              <ShieldAlert className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Risk Escalation</span>
                              <span className={`text-xs font-black uppercase tracking-wider ${
                                analysisResult.costOfInaction?.riskEscalation === "CRITICAL" ? "text-red-600" :
                                analysisResult.costOfInaction?.riskEscalation === "HIGH" ? "text-amber-600" :
                                "text-slate-700"
                              }`}>
                                {analysisResult.costOfInaction?.riskEscalation || "HIGH"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Citizens Affected</span>
                              <span className="text-xs font-black text-slate-700 uppercase">
                                ~{analysisResult.costOfInaction?.estimatedCitizensAffected || "380"}/day
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                              <Gauge className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Environmental Impact</span>
                              <span className={`text-xs font-black uppercase tracking-wider ${
                                analysisResult.costOfInaction?.environmentalImpact === "CRITICAL" ? "text-red-600" :
                                analysisResult.costOfInaction?.environmentalImpact === "HIGH" ? "text-emerald-600" :
                                "text-slate-700"
                              }`}>
                                {analysisResult.costOfInaction?.environmentalImpact || "HIGH"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Recommended Response</span>
                              <span className="text-xs font-black text-slate-700 truncate block">
                                {formatSLADisplay(analysisResult.responseSLA || "Schedule within 24 hours")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-medium text-slate-700 leading-normal">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1 leading-none">Recommended Action</span>
                          {analysisResult.costOfInaction?.recommendedAction || "Schedule within 24 hours to prevent rapid cost escalation."}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Why?</span>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            {analysisResult.costOfInaction?.rationale || "Progressive pavement deterioration significantly increases future repair costs."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🤖 AUTONOMOUS DISPATCH AGENT */}
                  {(() => {
                    function getFrontendDepartment(affectedAsset: string): string {
                      const asset = (affectedAsset || "").toLowerCase();
                      switch (asset) {
                        case "road":
                          return "Roads & Infrastructure Department";
                        case "streetlight":
                          return "Electrical Maintenance Department";
                        case "footpath":
                          return "Urban Development Department";
                        case "water_pipe":
                        case "drainage":
                          return "Water & Drainage Department";
                        case "waste_bin":
                          return "Solid Waste Management Department";
                        case "electrical":
                          return "Electrical Maintenance Department";
                        default:
                          return "Municipal General Department";
                      }
                    }

                    function getOfficerForDepartment(dept: string): string {
                      const d = (dept || "").toLowerCase();
                      if (d.includes("road")) return "Road Maintenance Supervisor";
                      if (d.includes("electrical")) return "Electrical Maintenance Officer";
                      if (d.includes("water") || d.includes("drainage")) return "Water Network Supervisor";
                      if (d.includes("waste")) return "Solid Waste Inspector";
                      if (d.includes("urban") || d.includes("development") || d.includes("footpath")) return "Civil Works Engineer";
                      return "Municipal Operations Officer";
                    }

                    function getFrontendSLA(priority: string): string {
                      switch ((priority || "").toUpperCase()) {
                        case "CRITICAL": return "Dispatch within 2 hours. Resolve within 12 hours.";
                        case "HIGH": return "Dispatch within 6 hours. Resolve within 24 hours.";
                        case "MEDIUM": return "Dispatch within 12 hours. Resolve within 48 hours.";
                        case "LOW": return "Dispatch within 24 hours. Resolve within 72 hours.";
                        default: return "Inspect within 24 hours. Resolve within 72 hours.";
                      }
                    }

                    const isRegistered = !!(analysisResult as any).dispatch;
                    
                    let dispatch = (analysisResult as any).dispatch;
                    if (!dispatch) {
                      const tempDept = getFrontendDepartment(analysisResult.affectedAsset || "");
                      const tempOfficer = getOfficerForDepartment(tempDept);
                      const tempSLA = getFrontendSLA(analysisResult.priorityLevel || "MEDIUM");
                      
                      const draftDispatch = {
                        dispatchId: "CIV-DSP-DRAFT",
                        issueId: analysisResult.id || "DRAFT-ID",
                        createdAt: new Date().toISOString(),
                        department: tempDept,
                        priorityLevel: analysisResult.priorityLevel || "MEDIUM",
                        technicalSeverity: Number(analysisResult.technicalSeverity || analysisResult.severity || 5),
                        responseSLA: tempSLA,
                        repairCostToday: analysisResult.costOfInaction?.repairCostNow || 4500,
                        repairCost30Days: analysisResult.costOfInaction?.repairCost30Days || 9400,
                        repairCost90Days: analysisResult.costOfInaction?.repairCost90Days || 24800,
                        citizensAffected: analysisResult.costOfInaction?.estimatedCitizensAffected || 380,
                        recommendedAction: analysisResult.costOfInaction?.recommendedAction || "Schedule pavement restoration within 24 hours.",
                        responsibleOfficer: tempOfficer,
                        dispatchStatus: "READY",
                        emailStatus: "PENDING",
                        sheetStatus: "PENDING",
                        workflowStage: "PACKAGE_GENERATED"
                      };

                      const priorityLevelStr = String(draftDispatch.priorityLevel || "MEDIUM").toUpperCase();
                      const draftSubject = `[CivicOS Dispatch] ${draftDispatch.dispatchId} | ${analysisResult.title || analysisResult.issueType || "Municipal Issue"} | Priority ${priorityLevelStr}`;
                      const coords = analysisResult.location 
                        ? `${analysisResult.location.latitude.toFixed(6)}, ${analysisResult.location.longitude.toFixed(6)}`
                        : "73.8567, 18.5204";
                      const confidenceScore = analysisResult.confidence !== undefined 
                        ? `${(analysisResult.confidence * 100).toFixed(0)}%` 
                        : "85%";
                      const costTodayStr = draftDispatch.repairCostToday.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
                      const cost30Str = draftDispatch.repairCost30Days.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
                      const cost90Str = draftDispatch.repairCost90Days.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
                      const costDiff30 = (draftDispatch.repairCost30Days - draftDispatch.repairCostToday).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
                      const costDiff90 = (draftDispatch.repairCost90Days - draftDispatch.repairCostToday).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
                      const aiSummary = analysisResult.rationale || (analysisResult.reasoning && Array.isArray(analysisResult.reasoning) ? analysisResult.reasoning.join(". ") : "Progressive physical and structural deterioration identified requiring immediate intervention.");
                      const evidenceImage = analysisResult.imageUrl || "No evidence image link provided";

                      const draftBody = `
======================================================================
MUNICIPAL OPERATIONS & DISPATCH DIVISION - WORK ORDER
======================================================================
Dispatch ID:          ${draftDispatch.dispatchId}
Incident ID:          ${draftDispatch.issueId}
Generated On:         ${draftDispatch.createdAt}
Workflow Stage:       ${draftDispatch.workflowStage}
----------------------------------------------------------------------
DEPARTMENTAL ASSIGNMENT
----------------------------------------------------------------------
Responsible Dept:     ${draftDispatch.department}
Responsible Officer:  ${draftDispatch.responsibleOfficer}
Response SLA:         ${draftDispatch.responseSLA}
----------------------------------------------------------------------
INCIDENT SPECIFICATIONS
----------------------------------------------------------------------
Issue Title:          ${analysisResult.title || "Untitled Incident"}
Issue Type:           ${analysisResult.issueType || "Other"}
Priority Level:       ${draftDispatch.priorityLevel}
Technical Severity:   ${draftDispatch.technicalSeverity}/10
Confidence Score:     ${confidenceScore}
Citizens Affected:    ~${draftDispatch.citizensAffected} per day
Location:             City: ${analysisResult.city || "Pune"}, State: ${analysisResult.state || "Maharashtra"}, Country: India
Coordinates:          ${coords}
Evidence Image Link:  ${evidenceImage}
Description:          ${analysisResult.description || "No description provided."}
----------------------------------------------------------------------
AI ENGINEERING SUMMARY
----------------------------------------------------------------------
${aiSummary}
----------------------------------------------------------------------
OPERATIONAL DIRECTION & ACTION
----------------------------------------------------------------------
Recommended Action:   ${draftDispatch.recommendedAction}
----------------------------------------------------------------------
FINANCIAL REPAIR & DELAY SUMMARY (COST OF INACTION)
----------------------------------------------------------------------
Estimated Repair Cost Today:  ${costTodayStr}
Projected Cost in 30 Days:    ${cost30Str} (Delay Penalty: +${costDiff30})
Projected Cost in 90 Days:    ${cost90Str} (Delay Penalty: +${costDiff90})
Risk Escalation Level:        ${analysisResult.costOfInaction?.riskEscalation || "MEDIUM"}
----------------------------------------------------------------------
CONFIDENTIALITY NOTICE: This is an official municipal dispatch transmittal.
It is intended solely for authorized contractors and departmental officers.
======================================================================
`;

                      const draftSheetPayload = {
                        "Dispatch ID": draftDispatch.dispatchId,
                        "Issue ID": draftDispatch.issueId,
                        "Issue Type": analysisResult.issueType || "Other",
                        "Department": draftDispatch.department,
                        "Officer": draftDispatch.responsibleOfficer,
                        "Priority": draftDispatch.priorityLevel,
                        "Severity": draftDispatch.technicalSeverity,
                        "Confidence": confidenceScore,
                        "Location": `${analysisResult.city || "Pune"}, ${analysisResult.state || "Maharashtra"} (Coords: ${coords})`,
                        "Status": draftDispatch.dispatchStatus,
                        "Response SLA": draftDispatch.responseSLA,
                        "Repair Cost": draftDispatch.repairCostToday,
                        "30 Day Cost": draftDispatch.repairCost30Days,
                        "90 Day Cost": draftDispatch.repairCost90Days,
                        "Created Time": draftDispatch.createdAt,
                        "Recommended Action": draftDispatch.recommendedAction,
                        "Workflow Stage": draftDispatch.workflowStage,
                        "Email Status": draftDispatch.emailStatus
                      };

                      dispatch = {
                        ...draftDispatch,
                        emailSubject: draftSubject,
                        emailBody: draftBody,
                        sheetPayload: draftSheetPayload,
                        emailStatus: "READY",
                        sheetStatus: "READY",
                        workflowStage: "EMAIL_GENERATED"
                      };
                    }

                    const workflow = dispatch.workflowStage;
                    const isEmailGenerated = ["EMAIL_GENERATED", "EMAIL_SENT", "SHEET_LOGGED", "DISPATCH_COMPLETE"].includes(workflow);
                    const isEmailSent = ["EMAIL_SENT", "SHEET_LOGGED", "DISPATCH_COMPLETE"].includes(workflow);
                    const isSheetLogged = ["SHEET_LOGGED", "DISPATCH_COMPLETE"].includes(workflow);
                    const isDispatchComplete = workflow === "DISPATCH_COMPLETE";

                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 mt-6 animate-fade-in" id="autonomous-dispatch-card">
                        <div className="pb-4 border-b border-slate-100 space-y-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-200/50">
                              <Cpu className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                              <h3 className="text-sm font-black tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
                                🤖 Autonomous Dispatch Agent
                              </h3>
                              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Municipal Operations & Dispatch Routing</p>
                            </div>
                          </div>
                        </div>

                        {/* Status section (Driven by workflow state) */}
                        <div className="space-y-3">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Autonomous Communication Pipeline</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* 1. Dispatch Package Generated */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>✓ Dispatch Package Generated</span>
                            </div>

                            {/* 2. Department Assigned */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>✓ Department Assigned</span>
                            </div>

                            {/* 3. Officer Assigned */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>✓ Officer Assigned</span>
                            </div>

                            {/* 4. Email Generated */}
                            <div className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-xl border ${
                              isEmailGenerated 
                                ? "text-emerald-600 bg-emerald-50/50 border-emerald-100/50" 
                                : "text-slate-500 bg-slate-50 border-slate-200"
                            }`}>
                              {isEmailGenerated ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black shrink-0">○</div>
                              )}
                              <span>{isEmailGenerated ? "✓ Email Generated" : "○ Email Pending"}</span>
                            </div>

                            {/* 5. Email Sent */}
                            <div className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-xl border ${
                              isEmailSent 
                                ? "text-emerald-600 bg-emerald-50/50 border-emerald-100/50" 
                                : "text-slate-500 bg-slate-50 border-slate-200"
                            }`}>
                              {isEmailSent ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black shrink-0">○</div>
                              )}
                              <span>{isEmailSent ? "✓ Email Sent" : "○ Email Sent"}</span>
                            </div>

                            {/* 6. Google Sheets Logged */}
                            <div className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-xl border ${
                              isSheetLogged 
                                ? "text-emerald-600 bg-emerald-50/50 border-emerald-100/50" 
                                : "text-slate-500 bg-slate-50 border-slate-200"
                            }`}>
                              {isSheetLogged ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black shrink-0">○</div>
                              )}
                              <span>{isSheetLogged ? "✓ Google Sheets Logged" : "○ Google Sheets Logged"}</span>
                            </div>

                            {/* 7. Dispatch Complete */}
                            <div className={`col-span-1 md:col-span-2 flex items-center gap-2 text-xs font-semibold p-2.5 rounded-xl border ${
                              isDispatchComplete 
                                ? "text-emerald-600 bg-emerald-50/50 border-emerald-100/50" 
                                : "text-slate-500 bg-slate-50 border-slate-200"
                            }`}>
                              {isDispatchComplete ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black shrink-0">○</div>
                              )}
                              <span>{isDispatchComplete ? "✓ Dispatch Complete" : "○ Dispatch Complete"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Key Fields Grid */}
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Workflow Stage</span>
                            <span className="text-xs font-black text-slate-700 uppercase mt-1 block truncate">
                              {dispatch.workflowStage}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Dispatch ID</span>
                            <span className="text-xs font-mono font-black text-indigo-600 uppercase mt-1 block truncate">
                              {isRegistered ? dispatch.dispatchId : "DRAFT_PREVIEW"}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Officer Assigned</span>
                            <span className="text-xs font-black text-slate-700 uppercase mt-1 block truncate">
                              {dispatch.responsibleOfficer}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Department Assigned</span>
                            <span className="text-xs font-black text-slate-700 uppercase mt-1 block truncate">
                              {dispatch.department}
                            </span>
                          </div>
                          <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Response SLA</span>
                            <span className="text-xs font-black text-slate-700 uppercase mt-1 block">
                              {dispatch.responseSLA}
                            </span>
                          </div>
                        </div>

                        {/* PART 5 — EMAIL PREVIEW PANEL (COLLAPSIBLE) */}
                        <div className="border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => setShowEmailPreview(!showEmailPreview)}
                            className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/30 border border-slate-200 transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-indigo-500 group-hover:animate-bounce" />
                              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                Generated Municipal Work Order
                              </span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showEmailPreview ? "rotate-180" : ""}`} />
                          </button>

                          {showEmailPreview && (
                            <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-4 animate-fade-in font-sans">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pb-3 border-b border-slate-200/60">
                                <div>
                                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Recipient Department</span>
                                  <span className="font-semibold text-slate-700">{dispatch.department}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Assigned Officer</span>
                                  <span className="font-semibold text-slate-700">{dispatch.responsibleOfficer}</span>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Subject Line</span>
                                  <span className="font-mono font-bold text-indigo-700">{dispatch.emailSubject || "Draft Work Order Subject"}</span>
                                </div>
                              </div>
                              
                              <div>
                                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-1.5">Professional Email Preview</span>
                                <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-700 bg-white p-4 border border-slate-200 rounded-xl max-h-96 overflow-y-auto leading-relaxed shadow-inner">
                                  {dispatch.emailBody || "Generating professional work order email template..."}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PART 6 — GOOGLE SHEETS PREVIEW (COLLAPSIBLE) */}
                        <div className="border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowSheetsPreview(!showSheetsPreview)}
                            className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/30 border border-slate-200 transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                Municipal Registry Preview
                              </span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showSheetsPreview ? "rotate-180" : ""}`} />
                          </button>

                          {showSheetsPreview && (
                            <div className="mt-3 space-y-2 animate-fade-in">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Google Sheets Column Map</span>
                              {dispatch.sheetPayload ? (
                                <div className="overflow-x-auto border border-emerald-200 rounded-xl bg-emerald-50/20 font-mono text-xs shadow-inner">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-emerald-50 text-emerald-800 border-b border-emerald-200">
                                        <th className="p-2 border-r border-emerald-200 text-center w-8 bg-slate-100 text-slate-500 font-sans text-[10px] select-none">Row</th>
                                        {Object.keys(dispatch.sheetPayload).map((col, idx) => (
                                          <th key={idx} className="p-2 border-r border-emerald-200 font-bold text-left select-none whitespace-nowrap text-[10px] uppercase tracking-wider text-emerald-900 bg-emerald-100/50">
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="bg-white hover:bg-emerald-50/10 border-b border-emerald-100">
                                        <td className="p-2 border-r border-emerald-200 text-center bg-slate-50 text-slate-400 font-sans text-[10px] select-none font-semibold">2</td>
                                        {Object.entries(dispatch.sheetPayload).map(([col, val], idx) => (
                                          <td key={idx} className="p-2 border-r border-emerald-200 text-slate-700 whitespace-nowrap truncate max-w-[220px]" title={String(val)}>
                                            {typeof val === "number" ? val.toLocaleString("en-IN") : String(val)}
                                          </td>
                                        ))}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                                  Generating spreadsheet registry row payload...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm" id="empty-analysis-container">
                  <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Awaiting Image Intake</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                    Provide an evidence photo in the left panel and trigger the diagnostic to generate structured classification parameters.
                  </p>
                </div>
              )}
            </AnimatePresence>

            {/* SECURE DATABASE LEDGER PREVIEW */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="recent-ledger-panel">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <Database className="h-4 w-4 text-indigo-600" />
                    Firestore Registry Audit
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Live issues list committed to the database</p>
                </div>
                <button 
                  onClick={fetchIssues} 
                  disabled={loadingList}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                  id="btn-refresh-ledger"
                  title="Refresh Audit"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingList && savedIssuesList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-2" id="ledger-loading">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                  <p className="text-xs font-semibold">Reading Firestore collection index...</p>
                </div>
              ) : savedIssuesList.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl" id="ledger-empty">
                  <p className="text-xs text-slate-500 font-semibold">No issues currently committed in database registry.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1" id="ledger-list">
                  {savedIssuesList.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => {
                        setAnalysisResult(item);
                        setSelectedImage(item.imageUrl);
                      }}
                      className="p-4 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all flex gap-4 items-start cursor-pointer hover:shadow-sm"
                      id={`ledger-item-${item.id}`}
                    >
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt="Evidence preview" 
                          className="h-16 w-16 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full uppercase tracking-wider ${getCategoryDetails(item.issueType).color}`}>
                            {getCategoryDetails(item.issueType).label}
                          </span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full uppercase tracking-wider ${getSeverityStyle(item.severity).bg} ${getSeverityStyle(item.severity).text} ${getSeverityStyle(item.severity).border}`}>
                            Sev: {item.severity}
                          </span>
                          {item.isFallback ? (
                            <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded uppercase font-sans">
                              Fallback Analysis
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded uppercase font-sans">
                              Gemini Analysis
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                        <p className="text-[11px] text-slate-600 font-medium line-clamp-1">{item.description}</p>
                        <p className="text-[10px] text-slate-400 font-mono font-medium">ID: {item.id} • {new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
        </>
        )}

      </main>

      {/* Styled Footer */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-8 text-center" id="civicos-footer">
        <p className="text-xs text-slate-400 font-mono">CivicOS System Core • v2.0.0 (Sprint 2 Realtime) • Connected to Firebase Firestore</p>
      </footer>
    </div>
  );
}

// Helper function to format SLA displays nicely for municipal officers
function formatSLADisplay(sla: string): string {
  if (!sla) return "Within 24 Hours";
  if (/^within/i.test(sla)) {
    return sla.charAt(0).toUpperCase() + sla.slice(1);
  }
  if (/hours|days/i.test(sla)) {
    const capitalized = sla.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return `Within ${capitalized}`;
  }
  return sla;
}


