export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface GeminiAnalysis {
  issueType: string;
  title: string;
  description: string;
  severity: number;
  confidence: number;
  reasoning: string[];
  isFallback?: boolean;
  affectedAsset?: string;
  estimatedRepairType?: string;
  perceptionData?: {
    issueType?: string;
    affectedAsset?: string;
    damageExtent?: string;
    estimatedAffectedArea?: string;
    wasteSubtype?: "none" | "litter_single" | "litter_scattered" | "waste_bin_overflow" | "illegal_dumping_small" | "illegal_dumping_large" | "hazardous_waste";
    roadSubtype?: "none" | "pothole_minor" | "pothole_major" | "road_surface_damage" | "road_collapse" | "footpath_crack_minor" | "footpath_crack_major" | "footpath_collapsed";
    waterSubtype?: "none" | "water_leakage_minor" | "water_leakage_major" | "water_main_burst" | "drainage_blocked";
    electricalSubtype?: "none" | "streetlight_outage" | "streetlight_damaged" | "electrical_hazard" | "electrical_exposed";
    structuralSubtype?: "none" | "wall_crack_minor" | "wall_crack_major" | "building_hazard";
    [key: string]: any;
  };
  costOfInaction?: {
    repairCostNow: number;
    repairCost30Days: number;
    repairCost90Days: number;
    costIncrease30: number;
    costIncrease90: number;
    riskEscalation: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    estimatedCitizensAffected: number;
    environmentalImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    recommendedAction: string;
    rationale: string;
    // Methodology metadata
    subtype?: string;
    baseCost?: number;
    damageMultiplier?: number;
    decay30?: number;
    decay90?: number;
    minCost?: number;
    maxCost?: number;
    assetLabel?: string;
    extentLabel?: string;
    isCapped?: boolean;
    capValue?: number;
  };
  scores?: {
    safetyRisk: number;
    infrastructureDamage: number;
    publicImpact: number;
    urgency: number;
  };
}

export interface DispatchPackage {
  dispatchId: string;
  issueId: string;
  createdAt: string;
  department: string;
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  technicalSeverity: number;
  responseSLA: string;
  repairCostToday: number;
  repairCost30Days: number;
  repairCost90Days: number;
  citizensAffected: number;
  recommendedAction: string;
  responsibleOfficer: string;
  dispatchStatus: "READY" | string;
  emailStatus: "PENDING" | "READY" | "SENT" | string;
  sheetStatus: "PENDING" | "READY" | "LOGGED" | string;
  workflowStage: "PACKAGE_GENERATED" | "EMAIL_GENERATED" | "EMAIL_SENT" | "SHEET_LOGGED" | "DISPATCH_COMPLETE";
  
  // Sprint 5 Communication Fields
  emailGeneratedAt?: string;
  emailSubject?: string;
  emailBody?: string;
  sheetPayload?: any;
  sheetGeneratedAt?: string;
}

export interface SavedIssue extends GeminiAnalysis {
  id: string;
  imageUrl: string;
  status: string;
  createdAt: string;
  location: Coordinate;
  ward?: string;
  isFallback?: boolean;
  isDemoMode?: boolean;
  city?: string;
  state?: string;
  country?: string;
  locationSource?: "GPS" | "ReverseGeocoded" | "DemoSeed";
  markerSource?: "LIVE_UPLOAD" | "DEMO_DATA" | "FIRESTORE";
  dispatch?: DispatchPackage;

  // Sprint 9 Execution and Photo Verification Fields
  afterImageUrl?: string;
  inspectionResult?: string;
  verifiedBy?: string;
  completionTime?: string;
  verifications?: number;
  disputes?: number;
  manualReviewReason?: string;
  manualReviewNote?: string;
}

// Sprint 9: Incident Lifecycle State Definitions & Reusable State Machine
export type IncidentStatus = 
  | "Reported"
  | "Verified"
  | "Assigned"
  | "Crew Dispatched"
  | "Work In Progress"
  | "Quality Inspection"
  | "Resolved"
  | "Closed";

export const LIFECYCLE_STATES: IncidentStatus[] = [
  "Reported",
  "Verified",
  "Assigned",
  "Crew Dispatched",
  "Work In Progress",
  "Quality Inspection",
  "Resolved",
  "Closed"
];

export const STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  "Reported": ["Verified"],
  "Verified": ["Assigned"],
  "Assigned": ["Crew Dispatched"],
  "Crew Dispatched": ["Work In Progress"],
  "Work In Progress": ["Quality Inspection"],
  "Quality Inspection": ["Resolved"],
  "Resolved": ["Closed"],
  "Closed": []
};

export function normalizeStatus(status: any): IncidentStatus {
  if (!status) return "Reported";
  const s = String(status).toLowerCase().replace(/_/g, " ").trim();
  if (s === "reported" || s === "approved") return "Reported";
  if (s === "verified") return "Verified";
  if (s === "assigned") return "Assigned";
  if (s === "crew dispatched" || s === "dispatched" || s === "en route" || s === "crew_dispatched") return "Crew Dispatched";
  if (s === "work in progress" || s === "in progress" || s === "repairing" || s === "wip" || s === "in_progress") return "Work In Progress";
  if (s === "quality inspection" || s === "inspection" || s === "quality_inspection") return "Quality Inspection";
  if (s === "resolved") return "Resolved";
  if (s === "closed") return "Closed";
  return "Reported";
}

export interface TimelineStep {
  time: string;
  title: string;
  description: string;
  status: IncidentStatus;
}

/**
 * Deterministically generates timeline steps from createdAt up to the current status
 */
export function getDeterministicTimeline(createdAt: string, currentStatus: IncidentStatus, department: string): TimelineStep[] {
  const createdDate = new Date(createdAt);
  
  // Format to HH:MM Local
  const formatTimeOffset = (mins: number): string => {
    const d = new Date(createdDate.getTime() + mins * 60 * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const allSteps: Array<{ offset: number; title: string; description: string; status: IncidentStatus }> = [
    {
      offset: 0,
      title: "Citizen Submitted Report",
      description: "Incident successfully logged into CivicOS via autonomous AI intake.",
      status: "Reported"
    },
    {
      offset: 3,
      title: "AI Verification Complete",
      description: "Spatial duplicate audit passed. Technical severity index established.",
      status: "Verified"
    },
    {
      offset: 8,
      title: "Department Assigned",
      description: `Routed automatically to the ${department || "Municipal General"} department.`,
      status: "Assigned"
    },
    {
      offset: 15,
      title: "Crew Dispatched",
      description: `Emergency dispatch package generated; repair crew en route to site.`,
      status: "Crew Dispatched"
    },
    {
      offset: 45,
      title: "Repair Works Started",
      description: "Crew arrived on-site. Safety perimeter deployed and asphalt core prepping.",
      status: "Work In Progress"
    },
    {
      offset: 105,
      title: "Repair Completed & Logged",
      description: "Physical remediation complete. Before/After photo evidence uploaded to ledger.",
      status: "Quality Inspection"
    },
    {
      offset: 120,
      title: "Quality Audit Approved",
      description: "Field engineer verified the repair integrity. Compliance with structural SLA verified.",
      status: "Resolved"
    },
    {
      offset: 125,
      title: "Case Closed",
      description: "Citizen notified of completion. Incident resolved in municipal ledger.",
      status: "Closed"
    }
  ];

  const currentIdx = LIFECYCLE_STATES.indexOf(currentStatus);
  return allSteps
    .filter((_, idx) => idx <= currentIdx)
    .map(step => ({
      time: formatTimeOffset(step.offset),
      title: step.title,
      description: step.description,
      status: step.status
    }));
}

export interface SLACompliance {
  targetHours: number;
  elapsedHours: number;
  onTrack: boolean;
  difference: number;
  statusText: string;
}

/**
 * Computes deterministic SLA compliance using actual createdAt timestamp
 */
export function getSLAStatus(createdAt: string, responseSLA: any, completionTime?: string, customNow?: Date): SLACompliance {
  const createdDate = new Date(createdAt);
  const endDate = completionTime ? new Date(completionTime) : (customNow || new Date("2026-06-27T12:24:04-07:00"));
  const elapsedMs = Math.max(0, endDate.getTime() - createdDate.getTime());
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  let targetHours = 24;
  const slaStr = String(responseSLA || "24 Hours").toLowerCase();
  if (slaStr.includes("24 hours") || slaStr.includes("critical")) targetHours = 24;
  else if (slaStr.includes("72 hours") || slaStr.includes("high")) targetHours = 72;
  else if (slaStr.includes("7 days") || slaStr.includes("medium")) targetHours = 168;
  else if (slaStr.includes("14 days") || slaStr.includes("low")) targetHours = 336;

  const onTrack = elapsedHours <= targetHours;
  const difference = Math.abs(targetHours - elapsedHours);

  let statusText = "";
  if (completionTime) {
    statusText = onTrack ? "COMPLIANT (SLA Met)" : `BREACHED (SLA Failed by ${Math.round(elapsedHours - targetHours)} hrs)`;
  } else if (onTrack) {
    statusText = `On Track (${Math.round(targetHours - elapsedHours)} hrs remaining)`;
  } else {
    statusText = `Exceeded by ${Math.round(elapsedHours - targetHours)} hours`;
  }

  return {
    targetHours,
    elapsedHours,
    onTrack,
    difference,
    statusText
  };
}

// ==========================================
// ARCHITECTURE PREPARATION FOR SPRINT 2
// (Interfaces & Type Definitions Only - No Business Logic)
// ==========================================

export interface IDuplicateDetector {
  thresholdDistanceMeters: number;
  similarityThreshold: number;
  detectDuplicates(targetIssue: SavedIssue, existingIssues: SavedIssue[]): Promise<{
    isDuplicate: boolean;
    parentIssueId?: string;
    confidenceScore: number;
  }>;
}

export interface IHeatmapProcessor {
  intensityRadius: number;
  weightProperty: "severity" | "confidence";
  generateHeatmapData(issues: SavedIssue[]): Array<{
    location: Coordinate;
    weight: number;
  }>;
}

export interface IShadowProblemAnalyzer {
  minimumUnreportedPeriodDays: number;
  identifyShadowRegions(issues: SavedIssue[]): Promise<Array<{
    ward: string;
    unreportedHotspot: Coordinate;
    estimatedRiskIndex: number;
    description: string;
  }>>;
}

export interface IPriorityEngine {
  alphaSeverityWeight: number;
  betaPopulationWeight: number;
  gammaTimeWeight: number;
  calculatePriorityScore(issue: SavedIssue): number;
  getDispatchQueue(issues: SavedIssue[]): SavedIssue[];
}

export interface IAuthorityDashboardConfig {
  authorizedWardAccess: string[];
  role: "operator" | "engineer" | "administrator";
  enableSystemOverrides: boolean;
  getSummaryStats(issues: SavedIssue[]): {
    totalActive: number;
    criticalCount: number;
    averageResolutionTimeHours: number;
    wardDistribution: Record<string, number>;
  };
}

export function clientComputeDeterministicConfidence(category: string, severity: number, hasLowQuality: boolean = false, isNightOrPoorLighting: boolean = false): number {
  let conf = 0.90; // Base baseline

  const cat = String(category || "").toLowerCase();
  if (cat.includes("road") || cat.includes("pothole")) {
    conf += 0.02;
  } else if (cat.includes("waste") || cat.includes("garbage") || cat.includes("litter")) {
    conf += 0.02;
  } else if (cat.includes("light") || cat.includes("electrical")) {
    conf += 0.01;
  }

  if (severity >= 8) {
    conf += 0.01;
  } else if (severity <= 3) {
    conf -= 0.02;
  }

  if (hasLowQuality) {
    conf -= 0.02;
  }

  if (isNightOrPoorLighting) {
    conf -= 0.025;
  }

  // Clamped tightly between 85% and 96%
  return Math.min(0.96, Math.max(0.85, Number(conf.toFixed(2))));
}

export function clientComputeCostOfInaction(
  issueType: string,
  affectedAsset: string,
  damageExtent: string,
  severity: number,
  title?: string,
  description?: string
) {
  const type = String(issueType || "").toLowerCase();
  const asset = String(affectedAsset || "").toLowerCase();
  const extent = String(damageExtent || "moderate").toLowerCase();

  let subtype = "default_fallback";

  // Match the exact same subtype selection logic as server/engines/costEngine.ts
  if (type.includes("pothole") || type.includes("hole") || type.includes("asphalt") || type.includes("road") || asset.includes("road") || asset.includes("pothole")) {
    if (severity <= 4) {
      subtype = "pothole_minor";
    } else if (severity <= 7) {
      subtype = "pothole_major";
    } else if (severity <= 9) {
      subtype = "road_surface_damage";
    } else {
      subtype = "road_collapse";
    }
  } else if (type.includes("footpath") || type.includes("sidewalk") || asset.includes("footpath") || asset.includes("sidewalk") || asset.includes("pavement")) {
    if (severity <= 4) {
      subtype = "footpath_crack_minor";
    } else if (severity <= 7) {
      subtype = "footpath_crack_major";
    } else {
      subtype = "footpath_collapsed";
    }
  } else if (type.includes("waste") || type.includes("garbage") || type.includes("litter") || type.includes("bin") || type.includes("overflow") || type.includes("dump") || asset.includes("waste") || asset.includes("bin")) {
    if (type.includes("litter") || type.includes("single")) {
      subtype = "litter_single";
    } else if (type.includes("scattered") || type.includes("litter_scattered")) {
      subtype = "litter_scattered";
    } else if (type.includes("overflow") || type.includes("bin_overflow")) {
      subtype = "waste_bin_overflow";
    } else if (type.includes("hazardous") || type.includes("hazard")) {
      subtype = "hazardous_waste";
    } else if (severity >= 7) {
      subtype = "illegal_dumping_large";
    } else {
      subtype = "illegal_dumping_small";
    }
  } else if (type.includes("water") || type.includes("leak") || type.includes("pipe") || type.includes("burst") || type.includes("flow") || type.includes("drain") || type.includes("clog") || asset.includes("water") || asset.includes("pipe") || asset.includes("drain") || asset.includes("sewer")) {
    if (type.includes("drain") || type.includes("clog") || type.includes("drainage") || asset.includes("drain") || asset.includes("sewer")) {
      subtype = "drainage_blocked";
    } else if (type.includes("burst") || type.includes("main") || severity >= 9) {
      subtype = "water_main_burst";
    } else if (severity >= 5 || extent === "severe") {
      subtype = "water_leakage_major";
    } else {
      subtype = "water_leakage_minor";
    }
  } else if (type.includes("light") || type.includes("lamp") || type.includes("street_light") || type.includes("streetlight") || type.includes("bulb") || type.includes("electrical") || type.includes("wire") || type.includes("exposed") || asset.includes("light") || asset.includes("electrical") || asset.includes("wire") || asset.includes("pole")) {
    if (type.includes("light") || type.includes("lamp") || asset.includes("light") || asset.includes("pole")) {
      if (severity <= 4) {
        subtype = "streetlight_outage";
      } else {
        subtype = "streetlight_damaged";
      }
    } else {
      if (severity >= 7) {
        subtype = "electrical_exposed";
      } else {
        subtype = "electrical_hazard";
      }
    }
  } else if (type.includes("wall") || type.includes("building") || asset.includes("wall") || asset.includes("building") || type.includes("structure") || asset.includes("structure") || type.includes("crack")) {
    if (severity >= 8 || type.includes("hazard") || type.includes("building")) {
      subtype = "building_hazard";
    } else if (severity <= 4) {
      subtype = "wall_crack_minor";
    } else {
      subtype = "wall_crack_major";
    }
  }

  const SUBTYPE_RANGES_CLIENT: Record<string, { min: number, max: number, category: string }> = {
    litter_single: { min: 400, max: 1000, category: "waste_bin" },
    litter_scattered: { min: 1000, max: 2000, category: "waste_bin" },
    waste_bin_overflow: { min: 1500, max: 2500, category: "waste_bin" },
    illegal_dumping_small: { min: 2500, max: 4000, category: "waste_bin" },
    illegal_dumping_large: { min: 4000, max: 6000, category: "waste_bin" },
    hazardous_waste: { min: 6000, max: 12000, category: "waste_bin" },
    pothole_minor: { min: 5000, max: 7000, category: "road" },
    pothole_major: { min: 7000, max: 10000, category: "road" },
    road_surface_damage: { min: 8000, max: 15000, category: "road" },
    road_collapse: { min: 20000, max: 45000, category: "road" },
    footpath_crack_minor: { min: 2000, max: 3500, category: "footpath" },
    footpath_crack_major: { min: 3500, max: 5000, category: "footpath" },
    footpath_collapsed: { min: 5000, max: 8000, category: "footpath" },
    water_leakage_minor: { min: 4000, max: 6000, category: "water_pipe" },
    water_leakage_major: { min: 6000, max: 9000, category: "water_pipe" },
    water_main_burst: { min: 10000, max: 25000, category: "water_pipe" },
    drainage_blocked: { min: 3000, max: 8000, category: "drainage" },
    streetlight_outage: { min: 2000, max: 3500, category: "streetlight" },
    streetlight_damaged: { min: 3500, max: 5000, category: "streetlight" },
    electrical_hazard: { min: 6000, max: 12000, category: "electrical" },
    electrical_exposed: { min: 10000, max: 20000, category: "electrical" },
    wall_crack_minor: { min: 4000, max: 8000, category: "structural" },
    wall_crack_major: { min: 8000, max: 18000, category: "structural" },
    building_hazard: { min: 20000, max: 50000, category: "structural" },
    default_fallback: { min: 4000, max: 8000, category: "road" }
  };

  const range = SUBTYPE_RANGES_CLIENT[subtype] || SUBTYPE_RANGES_CLIENT.default_fallback;
  const category = range.category;

  const interpolationFactor = Math.min(1.0, Math.max(0.0, severity / 10));
  const baseCost = range.min + (range.max - range.min) * interpolationFactor;
  const repairCostNow = Math.round(baseCost / 100) * 100;

  let decay30 = 1.20;
  let decay90 = 1.45;

  if (category === "streetlight") {
    decay30 = 1.15;
    decay90 = 1.30;
  } else if (category === "electrical") {
    decay30 = 1.20;
    decay90 = 1.45;
  } else if (category === "road") {
    decay30 = 1.25;
    decay90 = 1.55;
  } else if (category === "water_pipe") {
    decay30 = 1.20;
    decay90 = 1.50;
  } else if (category === "footpath") {
    decay30 = 1.15;
    decay90 = 1.40;
  } else if (category === "waste_bin") {
    decay30 = 1.15;
    decay90 = 1.35;
  } else if (category === "drainage") {
    decay30 = 1.25;
    decay90 = 1.60;
  }

  const repairCost30Days = Math.round((repairCostNow * decay30) / 100) * 100;
  const repairCost90Days = Math.round((repairCostNow * decay90) / 100) * 100;

  const costIncrease30 = Math.round(((repairCost30Days - repairCostNow) / repairCostNow) * 100) || 0;
  const costIncrease90 = Math.round(((repairCost90Days - repairCostNow) / repairCostNow) * 100) || 0;

  let riskEscalation: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
  if (severity >= 9) riskEscalation = "CRITICAL";
  else if (severity >= 7) riskEscalation = "HIGH";
  else if (severity >= 4) riskEscalation = "MEDIUM";
  else riskEscalation = "LOW";

  let minCitizens = 100;
  let maxCitizens = 800;
  if (category === "streetlight") {
    minCitizens = 40; maxCitizens = 120;
  } else if (category === "road") {
    minCitizens = 300; maxCitizens = 2000;
  } else if (category === "footpath") {
    minCitizens = 120; maxCitizens = 500;
  } else if (category === "waste_bin") {
    minCitizens = 150; maxCitizens = 600;
  } else if (category === "water_pipe") {
    minCitizens = 250; maxCitizens = 1200;
  } else if (category === "drainage") {
    minCitizens = 300; maxCitizens = 1500;
  }

  const severityFactor = Math.min(1.0, Math.max(0.0, (severity - 1) / 9));
  const rawCitizens = minCitizens + (maxCitizens - minCitizens) * severityFactor;
  const estimatedCitizensAffected = Math.round(rawCitizens / 10) * 10;

  let environmentalImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (category === "waste_bin" || category === "drainage") {
    environmentalImpact = severity >= 8 ? "CRITICAL" : severity >= 5 ? "HIGH" : "MEDIUM";
  } else if (category === "water_pipe") {
    environmentalImpact = severity >= 8 ? "HIGH" : "MEDIUM";
  } else {
    environmentalImpact = severity >= 8 ? "MEDIUM" : "LOW";
  }

  return {
    repairCostNow,
    repairCost30Days,
    repairCost90Days,
    costIncrease30,
    costIncrease90,
    riskEscalation,
    estimatedCitizensAffected,
    environmentalImpact,
    recommendedAction: `Schedule rehabilitation work order immediately within SLA timeline to mitigate progressive civil deterioration.`,
    rationale: `Sub-base water saturation or progressive structural/material cracking represents an escalating financial liability.`
  };
}

export function enrichIssue(issue: SavedIssue): SavedIssue {
  if (!issue) return issue;

  const category = issue.affectedAsset || issue.issueType || "other";
  const severity = Number(issue.severity || 5);

  const isNightOrPoorLighting = String(issue.description || "").toLowerCase().includes("night") || String(issue.description || "").toLowerCase().includes("dark");
  const hasLowQuality = String(issue.description || "").toLowerCase().includes("blur") || String(issue.description || "").toLowerCase().includes("grainy");
  const confidence = clientComputeDeterministicConfidence(category, severity, hasLowQuality, isNightOrPoorLighting);

  const extentLabel = severity >= 8 ? "Severe" : severity >= 5 ? "Moderate" : "Minor";
  const costOfInactionData = clientComputeCostOfInaction(
    issue.issueType || "",
    issue.affectedAsset || "",
    extentLabel,
    severity,
    issue.title,
    issue.description
  );

  return {
    ...issue,
    confidence: confidence,
    costOfInaction: {
      ...costOfInactionData,
      assetLabel: issue.affectedAsset || "Municipal Asset",
      extentLabel: extentLabel,
      baseCost: costOfInactionData.repairCostNow,
    }
  };
}
