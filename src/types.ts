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
