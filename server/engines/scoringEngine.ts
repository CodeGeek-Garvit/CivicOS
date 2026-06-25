export interface ScoringInput {
  issueType: string;
  roadBlocked?: boolean;
  pedestrianHazard?: boolean;
  vehicleHazard?: boolean;
  standingWater?: boolean;
  activeLeak?: boolean;
  electricalHazard?: boolean;
  structuralDamage?: boolean;
  estimatedAffectedArea?: string;
  damageExtent?: string;
}

export function computeTechnicalSeverity(perceptionData: ScoringInput): number {
  let baseSeverity = 3; // default

  const type = (perceptionData.issueType || "").toLowerCase();

  if (type.includes("electrical") || type === "electrical_hazard") {
    baseSeverity = 5;
  } else if (type.includes("collapse") || type === "road_collapse") {
    baseSeverity = 5;
  } else if (type.includes("water_main") || type === "water_main_burst" || type.includes("leakage")) {
    baseSeverity = 4;
  } else if (type === "pothole" || type.includes("pothole")) {
    baseSeverity = 3;
  } else if (type === "waste_overflow" || type.includes("waste") || type.includes("dumping") || type === "illegal_dumping") {
    baseSeverity = 3;
  } else if (type === "damaged_streetlight" || type === "broken_streetlight" || type.includes("streetlight") || type.includes("street_light")) {
    baseSeverity = 2;
  } else if (type === "graffiti") {
    baseSeverity = 1;
  } else {
    baseSeverity = 3; // default
  }

  let severity = baseSeverity;

  // Apply modifiers
  if (perceptionData.electricalHazard) severity += 3;
  if (perceptionData.roadBlocked) severity += 2;
  if (perceptionData.activeLeak) severity += 2;
  if (perceptionData.structuralDamage) severity += 2;
  if (perceptionData.pedestrianHazard) severity += 1;
  if (perceptionData.vehicleHazard) severity += 1;
  if (perceptionData.standingWater) severity += 1;
  if (perceptionData.estimatedAffectedArea === "large") severity += 1;
  if (perceptionData.damageExtent === "severe") severity += 1;

  // Cap at 10
  if (severity > 10) {
    severity = 10;
  }
  // Ensure minimum is 1
  if (severity < 1) {
    severity = 1;
  }

  return severity;
}

export interface ConfidenceInput {
  imageQuality?: string;
  multipleIssuesDetected?: boolean;
  geminiConfidenceRaw?: number;
  damageExtent?: string;
}

export function computeDeterministicConfidence(perceptionData: ConfidenceInput): number {
  let confidence = 1.0;

  if (perceptionData.imageQuality === "low") {
    confidence -= 0.15;
  }
  if (perceptionData.multipleIssuesDetected) {
    confidence -= 0.10;
  }
  if (perceptionData.geminiConfidenceRaw !== undefined && perceptionData.geminiConfidenceRaw < 0.70) {
    confidence -= 0.10;
  }
  if (perceptionData.damageExtent === "minor") {
    confidence -= 0.05;
  }

  if (confidence < 0.55) {
    confidence = 0.55;
  }

  return Number(confidence.toFixed(2));
}
