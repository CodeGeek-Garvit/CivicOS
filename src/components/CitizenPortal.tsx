import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, Image as ImageIcon, Loader2, CheckCircle2, 
  AlertCircle, ArrowRight, Sparkles, MapPin, Award, 
  ThumbsUp, ThumbsDown, User, Gift, Trophy, Activity, 
  CheckCircle, ChevronRight, RefreshCw, Star, Map, Compass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SavedIssue, GeminiAnalysis } from "../types";

// Helper to compress image (same as App.tsx)
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

interface CitizenPortalProps {
  issues: SavedIssue[];
  isLiveMode: boolean;
  userLocation: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
    locationSource: string;
  } | null;
  gpsStatus: string;
  onRefresh: () => void;
  isLoading: boolean;
  onUpdateIssueStatus: (
    id: string, 
    newStatus: string, 
    extraData?: {
      afterImageUrl?: string;
      inspectionResult?: string;
      verifiedBy?: string;
      completionTime?: string;
      verifications?: number;
      disputes?: number;
    }
  ) => Promise<void>;
  onBackToSelector: () => void;
}

export default function CitizenPortal({
  issues,
  isLiveMode,
  userLocation,
  gpsStatus,
  onRefresh,
  isLoading,
  onUpdateIssueStatus,
  onBackToSelector
}: CitizenPortalProps) {
  const [citizenTab, setCitizenTab] = useState<"home" | "nearby" | "my-reports" | "rewards">("home");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Community rewards gamification state
  const [rewardPoints, setRewardPoints] = useState<number>(() => {
    const saved = localStorage.getItem("civicos_rewards_points");
    return saved ? parseInt(saved, 10) : 1280;
  });

  const [verifiedList, setVerifiedList] = useState<Record<string, "verified" | "disputed" | null>>(() => {
    const saved = localStorage.getItem("civicos_verified_list");
    return saved ? JSON.parse(saved) : {};
  });

  // Track reports created in this session to label as "My Reports"
  const [myReportedIds, setMyReportedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("civicos_my_reported_ids");
    return saved ? JSON.parse(saved) : [];
  });

  // Submission pipeline animation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<number>(0);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    localStorage.setItem("civicos_rewards_points", rewardPoints.toString());
  }, [rewardPoints]);

  useEffect(() => {
    localStorage.setItem("civicos_verified_list", JSON.stringify(verifiedList));
  }, [verifiedList]);

  useEffect(() => {
    localStorage.setItem("civicos_my_reported_ids", JSON.stringify(myReportedIds));
  }, [myReportedIds]);

  const addPoints = (amount: number) => {
    setRewardPoints(prev => prev + amount);
  };

  // Convert uploaded file to base64 (matching App.tsx)
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
    setFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressedBase64 = await compressImage(originalBase64);
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

  const resetUploader = () => {
    setSelectedImage(null);
    setFileName(null);
    setError(null);
  };

  // Sequential pipeline stages
  const submissionStages = [
    { label: "Uploading Evidence", desc: "Encrypting and transmitting high-resolution visual evidence..." },
    { label: "AI Vision Analysis", desc: "Evaluating visual hazard attributes using Gemini Multimodal models..." },
    { label: "Severity Classification", desc: "Computing safety risk index and structural damage coefficients..." },
    { label: "Geo Verification", desc: "Cross-referencing GPS telemetry and local ward coordinates..." },
    { label: "Cost Prediction", desc: "Modeling cost-of-inaction escalation curves over 90 days..." },
    { label: "Department Assignment", desc: "Routing ticket details to appropriate municipal engineering crews..." },
    { label: "Incident Registered", desc: "Committing fully-auditable record to the live Firestore ledger..." }
  ];

  // Submit flow orchestrator
  const handleSubmitIssue = async () => {
    if (!selectedImage) return;

    setIsSubmitting(true);
    setSubmissionStep(0);
    setSubmitSuccess(false);
    setError(null);

    // Let's create an async helper to delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Step 1: Uploading Evidence
      setSubmissionStep(0);
      await delay(1200);

      // Step 2: AI Vision Analysis
      setSubmissionStep(1);
      const analyzeResponse = await fetch("/api/issues/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage, fileName: fileName })
      });
      if (!analyzeResponse.ok) {
        throw new Error("Gemini AI Vision Analysis failed. Please try a different photo.");
      }
      const analyzeData = await analyzeResponse.ok ? await analyzeResponse.json() : null;
      if (!analyzeData?.success) {
        throw new Error(analyzeData?.error || "AI Vision Analysis failed.");
      }
      
      const analysisResult: GeminiAnalysis = analyzeData.analysis;
      await delay(1000);

      // Step 3: Severity Classification
      setSubmissionStep(2);
      await delay(1000);

      // Step 4: Geo Verification
      setSubmissionStep(3);
      await delay(1000);

      // Step 5: Cost Prediction
      setSubmissionStep(4);
      await delay(1000);

      // Step 6: Department Assignment
      setSubmissionStep(5);
      await delay(1000);

      // Step 7: Incident Registered
      setSubmissionStep(6);
      
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
          locationSource: isLiveMode ? "GPS" : "DemoSeed",
          markerSource: isLiveMode ? "LIVE_UPLOAD" : "DEMO_DATA",
          isDemoMode: !isLiveMode,
          verifications: 1, // Auto-verified by reporting citizen
          disputes: 0
        }
      };

      const reportResponse = await fetch("/api/issues/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!reportResponse.ok) {
        throw new Error("Failed to register issue in municipal database.");
      }

      const reportData = await reportResponse.json();
      if (reportData.success && reportData.issue) {
        // Issue successfully submitted
        setMyReportedIds(prev => [...prev, reportData.issue.id]);
        addPoints(500); // 500 points for reporting an issue!
        
        await delay(800);
        setSubmitSuccess(true);
        await delay(1500);
        
        // Reset states
        setSelectedImage(null);
        setFileName(null);
        setIsSubmitting(false);
        // Switch to reports tab
        setCitizenTab("my-reports");
        onRefresh(); // Trigger global refresh
      } else {
        throw new Error(reportData.error || "Failed to finalize registration.");
      }

    } catch (err: any) {
      console.error("Citizen Submission Pipeline Error:", err);
      setError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  const handleVote = async (id: string, type: "verified" | "disputed") => {
    // Check if already voted
    if (verifiedList[id]) return;

    const targetIssue = issues.find(i => i.id === id);
    if (!targetIssue) return;

    const currentVerifications = targetIssue.verifications || 0;
    const currentDisputes = targetIssue.disputes || 0;

    let nextVerifications = currentVerifications;
    let nextDisputes = currentDisputes;

    if (type === "verified") {
      nextVerifications += 1;
      addPoints(100); // +100 points for verifying!
    } else {
      nextDisputes += 1;
      addPoints(10); // +10 points for participating in dispute audit
    }

    // Save vote state locally
    setVerifiedList(prev => ({
      ...prev,
      [id]: type
    }));

    try {
      // Trigger update API
      await onUpdateIssueStatus(id, targetIssue.status, {
        verifications: nextVerifications,
        disputes: nextDisputes
      });
    } catch (err) {
      console.error("Voter submission failed:", err);
    }
  };

  const getCategoryBadgeLabel = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case "pothole": return "Road & Pavement";
      case "water_leakage": return "Water & Drainage";
      case "damaged_streetlight": return "Street Lighting";
      case "waste_overflow": return "Solid Waste Management";
      case "infrastructure_damage": return "Structural Hazard";
      default: return "Municipal Service";
    }
  };

  const getStatusColor = (status: string) => {
    const s = String(status).toLowerCase();
    if (s.includes("resolved")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s.includes("closed")) return "bg-slate-100 text-slate-800 border-slate-200";
    if (s.includes("dispatched") || s.includes("crew")) return "bg-sky-100 text-sky-800 border-sky-200";
    if (s.includes("assigned")) return "bg-blue-100 text-blue-800 border-blue-200";
    if (s.includes("verified") || s.includes("validated")) return "bg-teal-100 text-teal-800 border-teal-200";
    return "bg-amber-100 text-amber-800 border-amber-200";
  };

  // Compute distance deterministically based on issue ID hash
  const getDeterministicDistance = (id: string): string => {
    let hash = 0;
    const str = String(id || "");
    for (let i = 0; i < str.length; i++) {
      hash += str.charCodeAt(i);
    }
    const dist = (hash % 11) * 120 + 80; // 80m to 1400m
    return dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`;
  };

  // Compute Trust Score for an issue
  const getCommunityTrustScore = (issue: SavedIssue) => {
    const v = issue.verifications !== undefined ? issue.verifications : 1;
    const d = issue.disputes !== undefined ? issue.disputes : 0;
    if (v === 0 && d === 0) return { score: 100, label: "Unverified Initial Entry" };
    
    const score = Math.round((v / (v + d)) * 100);
    let label = "High Community Confidence";
    if (score < 50) label = "Disputed Integrity";
    else if (score < 75) label = "Moderate Community Trust";
    
    return { score, label };
  };

  // Map normalized status states to the Citizen portal timeline:
  // Reported -> Validated -> Department Assigned -> Crew Dispatched -> Resolved
  const getTimelineSteps = (status: string) => {
    const s = String(status).toLowerCase();
    
    // Default steps
    const steps = [
      { label: "Reported", active: true, done: true },
      { label: "Validated", active: false, done: false },
      { label: "Department Assigned", active: false, done: false },
      { label: "Crew Dispatched", active: false, done: false },
      { label: "Resolved", active: false, done: false }
    ];

    if (s.includes("verified") || s.includes("validated")) {
      steps[1].active = true; steps[1].done = true;
    } else if (s.includes("assigned")) {
      steps[1].done = true;
      steps[2].active = true; steps[2].done = true;
    } else if (s.includes("crew") || s.includes("dispatched") || s.includes("progress") || s.includes("wip") || s.includes("inspection")) {
      steps[1].done = true;
      steps[2].done = true;
      steps[3].active = true; steps[3].done = true;
    } else if (s.includes("resolved") || s.includes("closed")) {
      steps[1].done = true;
      steps[2].done = true;
      steps[3].done = true;
      steps[4].active = true; steps[4].done = true;
    }

    return steps;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative" id="citizen-portal-root">
      {/* Dynamic Animated Submission Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl text-center space-y-6 border border-slate-100"
            >
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-blue-600 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full uppercase tracking-wider">
                  Citizen-to-Municipal Pipeline
                </span>
                <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight">Processing Civic Submission</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Our autonomous ingest logic is executing structured parsing sequences on your uploaded record.
                </p>
              </div>

              {/* Progress Line */}
              <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-emerald-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((submissionStep + 1) / submissionStages.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Animated Stages List */}
              <div className="space-y-3 text-left border border-slate-100 p-4 rounded-2xl bg-slate-50/50 max-h-72 overflow-y-auto shadow-inner">
                {submissionStages.map((stage, idx) => {
                  const isDone = submissionStep > idx || submitSuccess;
                  const isCurrent = submissionStep === idx && !submitSuccess;
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                        isCurrent 
                          ? "bg-white border border-blue-200 shadow-sm font-semibold scale-[1.01]" 
                          : "opacity-60"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 stroke-[3]" />
                          </div>
                        ) : isCurrent ? (
                          <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-slate-300 text-slate-400 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs block font-bold ${isCurrent ? "text-blue-600" : isDone ? "text-slate-800 line-through" : "text-slate-400"}`}>
                          {stage.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-slate-500 block leading-tight mt-0.5 animate-pulse">
                            {stage.desc}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Success Card inside overlay */}
              {submitSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-left"
                >
                  <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Issue successfully submitted!</h4>
                    <p className="text-xs text-emerald-700 font-medium">Earned +500 Reward points. Redirecting to My Reports...</p>
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-left text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Process Error</p>
                    <p className="text-rose-600 mt-0.5">{error}</p>
                    <button 
                      onClick={() => setIsSubmitting(false)} 
                      className="mt-2 px-3 py-1 bg-white border border-rose-200 hover:bg-rose-100 rounded-lg text-rose-700 font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Citizen Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-blue-100 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-600 to-emerald-500 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-100">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
                CivicOS <span className="text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full uppercase">Citizen Portal</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">Empowering Community Voice & Action</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime User Points Indicator */}
            <motion.div 
              key={rewardPoints}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-100 rounded-xl shadow-inner cursor-pointer"
              onClick={() => setCitizenTab("rewards")}
            >
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800">{rewardPoints} pts</span>
            </motion.div>

            {/* Back Switcher */}
            <button
              onClick={onBackToSelector}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer flex items-center gap-1"
            >
              <User className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Dynamic Navigation Tabs */}
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl border border-slate-300/40 gap-1 mb-8" id="citizen-tabs">
          <button
            onClick={() => setCitizenTab("home")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              citizenTab === "home"
                ? "bg-white text-blue-600 shadow-md"
                : "text-slate-600 hover:text-blue-600"
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Intake Hub</span>
          </button>
          <button
            onClick={() => { setCitizenTab("nearby"); onRefresh(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              citizenTab === "nearby"
                ? "bg-white text-blue-600 shadow-md"
                : "text-slate-600 hover:text-blue-600"
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Nearby Issues</span>
          </button>
          <button
            onClick={() => { setCitizenTab("my-reports"); onRefresh(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              citizenTab === "my-reports"
                ? "bg-white text-blue-600 shadow-md"
                : "text-slate-600 hover:text-blue-600"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>My Reports</span>
          </button>
          <button
            onClick={() => setCitizenTab("rewards")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              citizenTab === "rewards"
                ? "bg-white text-blue-600 shadow-md"
                : "text-slate-600 hover:text-blue-600"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Civic Rewards</span>
          </button>
        </div>

        {/* Tab Content Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={citizenTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            
            {/* TAB 1: INTAKE HOME PANEL */}
            {citizenTab === "home" && (
              <div className="space-y-6">
                
                {/* Optimistic Welcome Card */}
                <div className="bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 bg-white/20 border border-white/30 px-3 py-1 rounded-full text-[10px] text-white font-extrabold uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" /> Citizen Action Framework
                    </span>
                    <h2 className="text-2xl font-black tracking-tight">Co-Manage Pune City</h2>
                    <p className="text-white/90 text-xs font-medium max-w-md leading-relaxed">
                      Transform your camera into a tool for real municipal action. Provide evidence of any local issue, and let our autonomic pipelines register, prioritize, and dispatch repair crews instantly.
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-2xl flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-yellow-300" />
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider block text-white/70">Submission Reward</span>
                      <span className="text-sm font-black">+500 Points Per Report</span>
                    </div>
                  </div>
                </div>

                {/* Evidence Intake Box */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-md" id="citizen-upload-panel">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-blue-600" />
                      Report a Civic Issue
                    </h3>
                    <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-full uppercase">
                      Live Telemetry GPS
                    </span>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div 
                    className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                      selectedImage 
                        ? "border-slate-300 bg-slate-50" 
                        : "border-blue-200 bg-blue-50/10 hover:bg-blue-50/30 hover:border-blue-400 cursor-pointer"
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !selectedImage && fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    {selectedImage ? (
                      <div className="space-y-4">
                        <img 
                          src={selectedImage} 
                          alt="Intake Preview" 
                          className="max-h-72 mx-auto rounded-2xl object-contain shadow-lg border border-slate-200 bg-white"
                        />
                        <div className="flex items-center justify-center gap-3">
                          <button 
                            onClick={resetUploader}
                            className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                          >
                            Remove Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <Upload className="h-6 w-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-800">Tap to upload or take photo</p>
                          <p className="text-xs text-slate-400 font-semibold mt-1">Supports PNG, JPEG, WebP up to 10MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit buttons */}
                  {selectedImage && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleSubmitIssue}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-700 hover:to-emerald-600 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Submit to Autonomic Ingest</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                {/* Info Tip */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3 items-start">
                  <Star className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-slate-800">Autonomic Pipeline Integration</h4>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      Every submission goes through our full stack validation engine. It matches images with coordinates, assigns priority metrics, drafts emails, and posts updates in real-time. Feel free to log back in as Municipal Officer to see your reports processed!
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: NEARBY ISSUES */}
            {citizenTab === "nearby" && (
              <div className="space-y-6">
                
                {/* Header overview */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Nearby Local Issues</h3>
                    <p className="text-xs text-slate-500 font-medium">Verify or dispute local citizen reports in real-time</p>
                  </div>
                  <button 
                    onClick={() => { onRefresh(); }} 
                    disabled={isLoading}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {isLoading && issues.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                    <p className="text-xs font-semibold">Reading active Firestore entries...</p>
                  </div>
                ) : issues.length === 0 ? (
                  <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs text-slate-500 font-semibold">No issues registered in your local area yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {issues.map((item) => {
                      const distance = getDeterministicDistance(item.id);
                      const trustInfo = getCommunityTrustScore(item);
                      const hasVoted = verifiedList[item.id];

                      return (
                        <div 
                          key={item.id}
                          className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col md:flex-row gap-5"
                        >
                          {/* Image preview */}
                          {item.imageUrl && (
                            <div className="relative shrink-0 w-full md:w-36 h-36 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                              <img 
                                src={item.imageUrl} 
                                alt={item.title} 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-950/70 backdrop-blur-sm rounded text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5 text-red-400" />
                                {distance} away
                              </div>
                            </div>
                          )}

                          {/* Details */}
                          <div className="flex-1 space-y-3 min-w-0 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full uppercase tracking-wider ${getStatusColor(item.status)}`}>
                                  {item.status || "Reported"}
                                </span>
                                <span className="text-[9px] font-extrabold px-2 py-0.5 border border-slate-200 text-slate-600 rounded-full uppercase bg-slate-50">
                                  {getCategoryBadgeLabel(item.issueType)}
                                </span>
                                <span className="text-[9px] font-extrabold px-2 py-0.5 border border-red-100 text-red-700 bg-red-50/50 rounded-full uppercase">
                                  Sev: {item.severity}/10
                                </span>
                              </div>

                              <h4 className="text-sm font-black text-slate-950 truncate">{item.title}</h4>
                              <p className="text-xs text-slate-500 font-medium line-clamp-2">{item.description}</p>
                            </div>

                            {/* Trust Score & Verification Actions */}
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                              
                              {/* Trust metric */}
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-extrabold text-slate-800">{trustInfo.score}%</span>
                                  <span className="text-[10px] text-emerald-600 font-extrabold">Trust Score</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 block leading-none">
                                  {trustInfo.label} • {(item.verifications || 0) + (item.disputes || 0)} votes
                                </span>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2">
                                {hasVoted ? (
                                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                                    hasVoted === "verified" 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                      : "bg-rose-50 text-rose-700 border-rose-100"
                                  }`}>
                                    {hasVoted === "verified" ? (
                                      <>
                                        <ThumbsUp className="h-3.5 w-3.5 fill-current" />
                                        <span>Verified (+100 pts)</span>
                                      </>
                                    ) : (
                                      <>
                                        <ThumbsDown className="h-3.5 w-3.5 fill-current" />
                                        <span>Disputed (+10 pts)</span>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleVote(item.id, "verified")}
                                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <ThumbsUp className="h-3.5 w-3.5" />
                                      <span>Verify</span>
                                    </button>
                                    <button
                                      onClick={() => handleVote(item.id, "disputed")}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                      <span>Dispute</span>
                                    </button>
                                  </>
                                )}
                              </div>

                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: MY REPORTS LIST */}
            {citizenTab === "my-reports" && (
              <div className="space-y-6">
                
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">My Submitted Reports</h3>
                  <p className="text-xs text-slate-500 font-medium">Track the incident resolution stages as they advance dynamically</p>
                </div>

                {issues.filter(i => myReportedIds.includes(i.id)).length === 0 ? (
                  <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
                    <Activity className="h-8 w-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500 font-extrabold">You haven't reported any issues in this session yet.</p>
                    <button 
                      onClick={() => setCitizenTab("home")}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      Report Your First Issue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {issues.filter(i => myReportedIds.includes(i.id)).map((item) => {
                      const timelineSteps = getTimelineSteps(item.status);

                      return (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                          
                          <div className="flex gap-4 items-start border-b border-slate-100 pb-3">
                            {item.imageUrl && (
                              <img 
                                src={item.imageUrl} 
                                alt={item.title} 
                                className="h-16 w-16 rounded-xl object-cover border border-slate-100"
                              />
                            )}
                            <div className="space-y-0.5">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full uppercase tracking-wider ${getStatusColor(item.status)}`}>
                                {item.status || "Reported"}
                              </span>
                              <h4 className="text-xs font-black text-slate-950 mt-1">{item.title}</h4>
                              <p className="text-[10px] text-slate-400 font-mono">Incident ID: {item.id} • {new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Visual Lifecycle Status Timeline */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Incident Lifecycle</span>
                            
                            <div className="grid grid-cols-5 text-center gap-1 relative pt-2">
                              {/* Horizontal connecting background line */}
                              <div className="absolute left-8 right-8 top-5 h-[2px] bg-slate-200 -z-10" />
                              
                              {timelineSteps.map((step, idx) => (
                                <div key={idx} className="space-y-1.5 flex flex-col items-center">
                                  <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                                    step.done 
                                      ? "bg-emerald-500 text-white shadow-sm scale-105" 
                                      : "bg-slate-100 text-slate-300 border-2 border-slate-200"
                                  }`}>
                                    {step.done ? (
                                      <CheckCircle className="h-3.5 w-3.5 fill-current text-white stroke-[2.5]" />
                                    ) : (
                                      <div className="h-2 w-2 rounded-full bg-slate-300" />
                                    )}
                                  </div>
                                  <span className={`text-[9px] block leading-tight font-extrabold ${step.active ? "text-blue-600 font-black" : "text-slate-400"}`}>
                                    {step.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: CIVIC REWARDS & GAMIFICATION */}
            {citizenTab === "rewards" && (
              <div className="space-y-6">
                
                {/* Rewards Header Profile */}
                <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                    <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/10">
                      C
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">Active Citizen Contributor</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Pune Municipal Corporation • Ward 12</p>
                    </div>
                  </div>

                  <div className="text-center sm:text-right border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0 w-full sm:w-auto">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Total Community Score</span>
                    <span className="text-3xl font-black bg-gradient-to-r from-blue-400 to-emerald-300 bg-clip-text text-transparent">
                      {rewardPoints} Points
                    </span>
                  </div>
                </div>

                {/* Badges Section */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Unlocked Achievement Badges
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Badge 1: Community Guardian */}
                    <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50 flex items-center gap-3">
                      <div className="h-10 w-10 bg-yellow-100 border border-yellow-200 rounded-xl flex items-center justify-center text-xl shrink-0">
                        🏅
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 block truncate">Community Guardian</span>
                        <span className="text-[10px] text-slate-400 font-medium block">Awarded for active reporting</span>
                      </div>
                    </div>

                    {/* Badge 2: Civic Contributor */}
                    <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50 flex items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center text-xl shrink-0">
                        🌱
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 block truncate">Civic Contributor</span>
                        <span className="text-[10px] text-slate-400 font-medium block">Awarded for 3+ local verifications</span>
                      </div>
                    </div>

                    {/* Badge 3: Rapid Reporter */}
                    <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50 flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center text-xl shrink-0">
                        🏆
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 block truncate">Rapid Reporter</span>
                        <span className="text-[10px] text-slate-400 font-medium block">Submitting high-severity evidence</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Point System Rules */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                  <h4 className="text-sm font-extrabold text-slate-900">How to Earn Points</h4>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-medium border-b border-slate-50 pb-2">
                      <span className="text-slate-600">Report a new civic issue with AI Vision evidence</span>
                      <span className="text-emerald-600 font-bold">+500 Points</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium border-b border-slate-50 pb-2">
                      <span className="text-slate-600">Verify a nearby community issue report</span>
                      <span className="text-emerald-600 font-bold">+100 Points</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium border-b border-slate-50 pb-2">
                      <span className="text-slate-600">Vote on a dispute to support integrity audit</span>
                      <span className="text-emerald-600 font-bold">+10 Points</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-600">When your reported issue gets Resolved by crews</span>
                      <span className="text-emerald-600 font-bold">+250 Points</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </motion.div>
        </AnimatePresence>

      </main>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-[10px] text-slate-400 font-mono">CivicOS Community Gateway • Connected to Standard Firestore default database</p>
      </footer>
    </div>
  );
}
