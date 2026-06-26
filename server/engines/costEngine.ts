export interface CostInput {
  issueType: string;
  affectedAsset?: string;
  estimatedRepairType?: string;
  technicalSeverity: number;
  priorityScore?: number;
  priorityLevel?: string;
  responseSLA?: string;
  perceptionData?: {
    damageExtent?: string;
    estimatedAffectedArea?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface CostOfInactionResult {
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
}

export function computeCostOfInaction(issue: CostInput): CostOfInactionResult {
  console.log("\n💰 --------------------------------------------------");
  console.log("💰 [COST ENGINE] Evaluating Cost of Inaction...");

  const type = (issue.issueType || "").toLowerCase();
  const asset = (issue.affectedAsset || "").toLowerCase();
  const severity = issue.technicalSeverity || issue.severity || 5;

  // 1. Identify repair category & base cost ranges
  let category = "road";
  let minCost = 3000;
  let maxCost = 8000;

  if (type.includes("streetlight") || asset.includes("streetlight")) {
    category = "streetlight";
    minCost = 4000;
    maxCost = 6000;
  } else if (type.includes("electrical") || asset.includes("electrical") || type.includes("hazard") && (asset.includes("wire") || asset.includes("power"))) {
    category = "electrical";
    minCost = 8000;
    maxCost = 20000;
  } else if (type.includes("pothole") || asset.includes("pavement") || type === "pothole") {
    category = "road"; // Pothole
    minCost = 3000;
    maxCost = 8000;
  } else if (type.includes("collapse") || type.includes("sinkhole")) {
    category = "road"; // Road Collapse
    minCost = 30000;
    maxCost = 80000;
  } else if (type.includes("footpath") || type.includes("sidewalk") || asset.includes("footpath")) {
    category = "footpath";
    minCost = 10000;
    maxCost = 20000;
  } else if (type.includes("water") || type.includes("leak") || asset.includes("water")) {
    category = "water_pipe";
    minCost = 12000;
    maxCost = 30000;
  } else if (type.includes("waste") || type.includes("garbage") || type.includes("dumping") || asset.includes("waste") || asset.includes("bin")) {
    category = "waste_bin";
    minCost = 4000;
    maxCost = 12000;
  } else if (type.includes("drain") || type.includes("sewer") || asset.includes("drain")) {
    category = "drainage";
    minCost = 15000;
    maxCost = 35000;
  } else {
    // Default fallback
    category = "road";
    minCost = 5000;
    maxCost = 15000;
  }

  // 2. Interpolate base cost using severity score (1-10)
  const severityFactor = Math.min(1.0, Math.max(0.0, (severity - 1) / 9));
  const baseCost = minCost + (maxCost - minCost) * severityFactor;

  // 3. Apply Damage Extent Multiplier
  const extent = (issue.perceptionData?.damageExtent || issue.damageExtent || "moderate").toLowerCase();
  let damageMultiplier = 1.5;
  if (extent.includes("minor")) {
    damageMultiplier = 1.0;
  } else if (extent.includes("severe")) {
    damageMultiplier = 2.2;
  }

  const rawCostNow = baseCost * damageMultiplier;
  const repairCostNow = Math.round(rawCostNow / 100) * 100;

  // 4. Asset Decay Multipliers (30 days and 90 days)
  let decay30 = 2.1;
  let decay90 = 5.8;

  if (category === "streetlight") {
    decay30 = 1.3;
    decay90 = 2.8;
  } else if (category === "electrical") {
    decay30 = 1.8;
    decay90 = 4.2;
  } else if (category === "road") {
    decay30 = 2.1;
    decay90 = 5.8;
  } else if (category === "water_pipe") {
    decay30 = 3.2;
    decay90 = 9.1;
  } else if (category === "footpath") {
    decay30 = 1.9;
    decay90 = 4.6;
  } else if (category === "waste_bin") {
    decay30 = 2.8;
    decay90 = 6.5;
  } else if (category === "drainage") {
    decay30 = 2.6;
    decay90 = 7.2;
  }

  const repairCost30Days = Math.round((rawCostNow * decay30) / 100) * 100;
  const repairCost90Days = Math.round((rawCostNow * decay90) / 100) * 100;

  // Calculate percentage increases
  const costIncrease30 = Math.round(((repairCost30Days - repairCostNow) / repairCostNow) * 100);
  const costIncrease90 = Math.round(((repairCost90Days - repairCostNow) / repairCostNow) * 100);

  // 5. Risk Escalation
  let riskEscalation: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
  if (severity >= 9) {
    riskEscalation = "CRITICAL";
  } else if (severity >= 7) {
    riskEscalation = "HIGH";
  } else if (severity >= 4) {
    riskEscalation = "MEDIUM";
  } else {
    riskEscalation = "LOW";
  }

  // 6. Estimated Citizens Affected
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

  const rawCitizens = minCitizens + (maxCitizens - minCitizens) * severityFactor;
  const estimatedCitizensAffected = Math.round(rawCitizens / 10) * 10;

  // 7. Environmental Impact
  let environmentalImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (category === "waste_bin" || category === "water_pipe" || category === "drainage") {
    environmentalImpact = severity >= 8 ? "CRITICAL" : "HIGH";
  } else if (category === "road" || category === "electrical") {
    environmentalImpact = severity >= 8 ? "HIGH" : "MEDIUM";
  } else {
    environmentalImpact = severity >= 8 ? "MEDIUM" : "LOW";
  }

  // 8. Recommended Action
  let recommendedAction = "";
  if (riskEscalation === "CRITICAL") {
    recommendedAction = "Immediate emergency dispatch required.";
  } else if (riskEscalation === "HIGH") {
    recommendedAction = "Schedule within 24 hours to prevent rapid cost escalation.";
  } else if (riskEscalation === "MEDIUM") {
    recommendedAction = "Schedule within 72 hours.";
  } else {
    recommendedAction = "Include in routine maintenance cycle.";
  }

  // 9. Rationale
  let rationale = "Progressive deterioration significantly increases future repair costs.";
  if (category === "waste_bin") {
    rationale = "Delayed waste removal increases environmental and public health risks.";
  } else if (category === "streetlight" || category === "electrical") {
    rationale = "Replacing the damaged fixture promptly prevents complete electrical replacement.";
  } else if (category === "road") {
    rationale = "Progressive pavement deterioration significantly increases future repair costs.";
  } else if (category === "water_pipe") {
    rationale = "Unchecked water leakage leads to progressive structural undermining and heavy resource loss.";
  } else if (category === "drainage") {
    rationale = "Drainage delays trigger severe urban flooding risk and structural roadway damage.";
  } else if (category === "footpath") {
    rationale = "Delayed sidewalk repairs increase pedestrian accident risk and municipality liability.";
  }

  console.log(`- Category: ${category}`);
  console.log(`- Base Repair Cost (Severity interpolated): ₹${Math.round(baseCost)}`);
  console.log(`- Damage Multiplier applied: x${damageMultiplier} -> Repair Cost Now: ₹${repairCostNow}`);
  console.log(`- Projected 30 days: ₹${repairCost30Days} (+${costIncrease30}%)`);
  console.log(`- Projected 90 days: ₹${repairCost90Days} (+${costIncrease90}%)`);
  console.log(`- Risk Escalation: ${riskEscalation}`);
  console.log(`- Environmental Impact: ${environmentalImpact}`);
  console.log(`- Citizens Affected: ~${estimatedCitizensAffected}/day`);
  console.log("💰 --------------------------------------------------\n");

  return {
    repairCostNow,
    repairCost30Days,
    repairCost90Days,
    costIncrease30,
    costIncrease90,
    riskEscalation,
    estimatedCitizensAffected,
    environmentalImpact,
    recommendedAction,
    rationale
  };
}
