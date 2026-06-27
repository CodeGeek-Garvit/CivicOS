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
