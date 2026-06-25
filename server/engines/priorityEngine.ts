export interface PriorityInput {
  technicalSeverity: number;
  duplicateCount?: number;
  verificationCount?: number;
  timeOpenHours?: number;
  locationRisk?: number;
  criticalZone?: boolean;
}

export function computeOperationalPriority(input: PriorityInput): {
  priorityScore: number;
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
} {
  const technicalSeverity = input.technicalSeverity;
  const duplicateCount = input.duplicateCount || 0;
  const verificationCount = input.verificationCount || 0;
  const timeOpenHours = input.timeOpenHours || 0;
  const locationRisk = input.locationRisk || 0;
  const criticalZone = input.criticalZone || false;

  // For Sprint 2: Only technicalSeverity is used
  const priorityScore = technicalSeverity;

  let priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (priorityScore >= 8) {
    priorityLevel = "CRITICAL";
  } else if (priorityScore >= 5) {
    priorityLevel = "HIGH";
  } else if (priorityScore >= 3) {
    priorityLevel = "MEDIUM";
  } else {
    priorityLevel = "LOW";
  }

  return {
    priorityScore,
    priorityLevel
  };
}
