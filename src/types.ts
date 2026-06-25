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
  scores?: {
    safetyRisk: number;
    infrastructureDamage: number;
    publicImpact: number;
    urgency: number;
  };
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
