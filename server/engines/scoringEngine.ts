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
  estimatedScale?: string;
  obstructionLevel?: string;
  repairComplexity?: string;
  publicExposure?: string;
  hazardDurationEstimate?: string;
  objectStability?: string;
  visibility?: string;
}

export function computeTechnicalSeverity(perceptionData: ScoringInput): number {
  console.log("\n📐 --------------------------------------------------");
  console.log("📐 [SCORING ENGINE] Beginning Technical Severity Evaluation...");
  console.log(`- Issue Type: ${perceptionData.issueType}`);

  // Initialize scoring dimensions (each on a 1.0 to 10.0 scale)
  
  // 1. Safety Risk Dimension (Base on issue type + visual hazards)
  let safetyBase = 3.0;
  const typeLower = (perceptionData.issueType || "").toLowerCase();
  if (typeLower.includes("electrical") || typeLower === "electrical_hazard") {
    safetyBase = 5.0;
  } else if (typeLower.includes("collapse") || typeLower === "road_collapse") {
    safetyBase = 5.0;
  } else if (typeLower.includes("fallen_tree")) {
    safetyBase = 4.5;
  } else if (typeLower.includes("water_main") || typeLower === "water_main_burst" || typeLower.includes("leakage")) {
    safetyBase = 3.5;
  } else if (typeLower === "pothole" || typeLower.includes("pothole")) {
    safetyBase = 3.0;
  } else if (typeLower === "waste_overflow" || typeLower.includes("waste") || typeLower.includes("dumping") || typeLower === "illegal_dumping") {
    safetyBase = 2.0;
  } else if (typeLower === "damaged_streetlight" || typeLower === "broken_streetlight" || typeLower.includes("streetlight")) {
    safetyBase = 2.0;
  } else if (typeLower === "graffiti") {
    safetyBase = 1.0;
  }

  let safetyRisk = safetyBase;
  const safetyMods: string[] = [];
  if (perceptionData.electricalHazard) {
    safetyRisk += 5.0;
    safetyMods.push("+5.0 Active Electrical Hazard");
  }
  if (perceptionData.vehicleHazard) {
    safetyRisk += 2.5;
    safetyMods.push("+2.5 Vehicle Hazard");
  }
  if (perceptionData.pedestrianHazard) {
    safetyRisk += 2.0;
    safetyMods.push("+2.0 Pedestrian Hazard");
  }
  if (perceptionData.objectStability === "actively failing") {
    safetyRisk += 3.0;
    safetyMods.push("+3.0 Actively Failing Object");
  } else if (perceptionData.objectStability === "deteriorating") {
    safetyRisk += 1.5;
    safetyMods.push("+1.5 Deteriorating Object");
  }
  if (perceptionData.standingWater) {
    safetyRisk += 1.0;
    safetyMods.push("+1.0 Standing Water Slip Risk");
  }
  safetyRisk = Math.min(10.0, Math.max(1.0, safetyRisk));

  // 2. Accessibility Impact Dimension
  let accessibilityBase = 1.0;
  let accessibilityRisk = accessibilityBase;
  const accessMods: string[] = [];
  if (perceptionData.roadBlocked) {
    accessibilityRisk += 5.0;
    accessMods.push("+5.0 Road Blocked");
  }
  if (perceptionData.obstructionLevel === "complete") {
    accessibilityRisk += 5.0;
    accessMods.push("+5.0 Complete Obstruction");
  } else if (perceptionData.obstructionLevel === "major") {
    accessibilityRisk += 3.5;
    accessMods.push("+3.5 Major Obstruction");
  } else if (perceptionData.obstructionLevel === "partial") {
    accessibilityRisk += 1.5;
    accessMods.push("+1.5 Partial Obstruction");
  }
  if (perceptionData.pedestrianHazard) {
    accessibilityRisk += 1.5;
    accessMods.push("+1.5 Pedestrian Access Threat");
  }
  accessibilityRisk = Math.min(10.0, Math.max(1.0, accessibilityRisk));

  // 3. Infrastructure Damage Dimension
  let infraBase = 2.0;
  if (typeLower.includes("infrastructure_damage")) {
    infraBase = 5.0;
  } else if (typeLower.includes("road_damage") || typeLower.includes("collapse")) {
    infraBase = 4.5;
  } else if (typeLower === "pothole" || typeLower.includes("pothole")) {
    infraBase = 3.0;
  } else if (typeLower === "damaged_streetlight" || typeLower.includes("streetlight")) {
    infraBase = 3.0;
  } else if (typeLower.includes("leakage") || typeLower.includes("water_pipe")) {
    infraBase = 3.0;
  }
  let infraDamage = infraBase;
  const infraMods: string[] = [];
  if (perceptionData.structuralDamage) {
    infraDamage += 5.0;
    infraMods.push("+5.0 Structural Damage");
  }
  if (perceptionData.damageExtent === "severe") {
    infraDamage += 4.0;
    infraMods.push("+4.0 Severe Damage Extent");
  } else if (perceptionData.damageExtent === "moderate") {
    infraDamage += 2.0;
    infraMods.push("+2.0 Moderate Damage Extent");
  }
  if (perceptionData.objectStability === "actively failing") {
    infraDamage += 2.0;
    infraMods.push("+2.0 Active Mechanical Degradation");
  }
  infraDamage = Math.min(10.0, Math.max(1.0, infraDamage));

  // 4. Traffic Impact Dimension
  let trafficBase = 1.0;
  let trafficImpact = trafficBase;
  const trafficMods: string[] = [];
  if (perceptionData.roadBlocked) {
    trafficImpact += 5.0;
    trafficMods.push("+5.0 Road Blockage");
  }
  if (perceptionData.vehicleHazard) {
    trafficImpact += 3.0;
    trafficMods.push("+3.0 Active Vehicle Hazard");
  }
  if (perceptionData.publicExposure === "intersection") {
    trafficImpact += 4.0;
    trafficMods.push("+4.0 Intersection Clutter");
  } else if (perceptionData.publicExposure === "busy road") {
    trafficImpact += 3.0;
    trafficMods.push("+3.0 Busy Road Clutter");
  } else if (perceptionData.publicExposure === "commercial") {
    trafficImpact += 1.5;
    trafficMods.push("+1.5 Commercial Zone Congestion");
  }
  if (perceptionData.obstructionLevel === "complete") {
    trafficImpact += 3.0;
    trafficMods.push("+3.0 Complete Choke Point");
  } else if (perceptionData.obstructionLevel === "major") {
    trafficImpact += 1.5;
    trafficMods.push("+1.5 Major Lane Squeeze");
  }
  trafficImpact = Math.min(10.0, Math.max(1.0, trafficImpact));

  // 5. Environmental Impact Dimension
  let envBase = 1.0;
  if (typeLower === "waste_overflow" || typeLower.includes("waste") || typeLower.includes("dumping") || typeLower === "illegal_dumping") {
    envBase = 4.0;
  } else if (typeLower.includes("leakage") || typeLower.includes("water_pipe") || typeLower.includes("drainage")) {
    envBase = 3.0;
  }
  let envImpact = envBase;
  const envMods: string[] = [];
  if (perceptionData.activeLeak) {
    envImpact += 4.0;
    envMods.push("+4.0 Active Non-Revenue Leakage");
  }
  if (perceptionData.standingWater) {
    envImpact += 2.0;
    envMods.push("+2.0 Water Stagnation");
  }
  if (perceptionData.estimatedScale === "massive") {
    envImpact += 4.0;
    envMods.push("+4.0 Massive Environmental Footprint");
  } else if (perceptionData.estimatedScale === "large") {
    envImpact += 2.5;
    envMods.push("+2.5 Large Environmental Footprint");
  } else if (perceptionData.estimatedScale === "medium") {
    envImpact += 1.0;
    envMods.push("+1.0 Medium Environmental Footprint");
  }
  envImpact = Math.min(10.0, Math.max(1.0, envImpact));

  // 6. Repair Complexity Dimension
  let repairComplexityScore = 4.0;
  const complex = (perceptionData.repairComplexity || "").toLowerCase();
  if (complex === "emergency") {
    repairComplexityScore = 10.0;
  } else if (complex === "major") {
    repairComplexityScore = 8.0;
  } else if (complex === "moderate") {
    repairComplexityScore = 5.5;
  } else if (complex === "routine") {
    repairComplexityScore = 3.0;
  } else if (complex === "cosmetic") {
    repairComplexityScore = 1.5;
  }

  // 7. Public Exposure Dimension
  let publicExposureScore = 4.0;
  const exposure = (perceptionData.publicExposure || "").toLowerCase();
  if (exposure === "intersection") {
    publicExposureScore = 10.0;
  } else if (exposure === "busy road") {
    publicExposureScore = 8.5;
  } else if (exposure === "commercial") {
    publicExposureScore = 6.5;
  } else if (exposure === "residential") {
    publicExposureScore = 4.5;
  } else if (exposure === "isolated") {
    publicExposureScore = 2.0;
  }

  // 8. Issue Scale Dimension
  let scaleScore = 4.0;
  const scale = (perceptionData.estimatedScale || perceptionData.estimatedAffectedArea || "").toLowerCase();
  if (scale === "massive") {
    scaleScore = 10.0;
  } else if (scale === "large") {
    scaleScore = 8.0;
  } else if (scale === "medium") {
    scaleScore = 5.0;
  } else if (scale === "small") {
    scaleScore = 3.0;
  } else if (scale === "tiny") {
    scaleScore = 1.5;
  }

  // Combine dimensions using structured weighted formula
  // Safety Risk has highest weight, followed by Infrastructure Damage, Accessibility, etc.
  const rawWeightedScore = (
    (safetyRisk * 0.35) + 
    (infraDamage * 0.15) + 
    (accessibilityRisk * 0.10) + 
    (trafficImpact * 0.10) + 
    (envImpact * 0.10) + 
    (repairComplexityScore * 0.08) + 
    (publicExposureScore * 0.06) + 
    (scaleScore * 0.06)
  );

  const maxCriticalDimension = Math.max(safetyRisk, infraDamage, accessibilityRisk);
  
  let finalSeverity = rawWeightedScore;
  let calculationMethod = "Weighted Average Only";

  // Override/Booster: Prevent dilution of high-priority critical issues
  if (maxCriticalDimension >= 8.0) {
    finalSeverity = (0.5 * rawWeightedScore) + (0.5 * maxCriticalDimension);
    calculationMethod = `Co-weighted with Critical Dimension Baseline (${maxCriticalDimension})`;
  }

  // Round to nearest integer and constrain to 1-10
  const roundedSeverity = Math.min(10, Math.max(1, Math.round(finalSeverity)));

  // PRINT EXTENSIVE DEVELOPER LOGS (Step 6)
  console.log("\n--- SCORING DIMENSIONS BREAKDOWN ---");
  console.log(`1. Safety Risk Score:          ${safetyRisk.toFixed(1)}/10.0 (Base: ${safetyBase}, Mods: [${safetyMods.join(", ") || "none"}])`);
  console.log(`2. Accessibility Impact Score:  ${accessibilityRisk.toFixed(1)}/10.0 (Base: ${accessibilityBase}, Mods: [${accessMods.join(", ") || "none"}])`);
  console.log(`3. Infrastructure Damage Score: ${infraDamage.toFixed(1)}/10.0 (Base: ${infraBase}, Mods: [${infraMods.join(", ") || "none"}])`);
  console.log(`4. Traffic Impact Score:        ${trafficImpact.toFixed(1)}/10.0 (Base: ${trafficBase}, Mods: [${trafficMods.join(", ") || "none"}])`);
  console.log(`5. Environmental Impact Score:  ${envImpact.toFixed(1)}/10.0 (Base: ${envBase}, Mods: [${envMods.join(", ") || "none"}])`);
  console.log(`6. Repair Complexity Score:    ${repairComplexityScore.toFixed(1)}/10.0 (Profile: ${perceptionData.repairComplexity || "default"})`);
  console.log(`7. Public Exposure Score:       ${publicExposureScore.toFixed(1)}/10.0 (Profile: ${perceptionData.publicExposure || "default"})`);
  console.log(`8. Issue Scale Score:           ${scaleScore.toFixed(1)}/10.0 (Profile: ${perceptionData.estimatedScale || perceptionData.estimatedAffectedArea || "default"})`);
  console.log("------------------------------------");
  console.log(`- Raw Weighted Average:         ${rawWeightedScore.toFixed(2)}`);
  console.log(`- Calculation Protocol:         ${calculationMethod}`);
  console.log(`- Unrounded Severity Score:     ${finalSeverity.toFixed(2)}`);
  console.log(`- Final Severity Rating (1-10): ${roundedSeverity}`);
  console.log("📐 --------------------------------------------------\n");

  return roundedSeverity;
}

export interface ConfidenceInput {
  imageQuality?: string;
  multipleIssuesDetected?: boolean;
  geminiConfidenceRaw?: number;
  damageExtent?: string;
  lightingCondition?: string;
  cameraAngle?: string;
  motionBlur?: boolean;
  complexScene?: boolean;
  estimatedScale?: string;
  visibility?: string;
}

export function computeDeterministicConfidence(perceptionData: ConfidenceInput): number {
  console.log("\n🔒 --------------------------------------------------");
  console.log("🔒 [CONFIDENCE ENGINE] Calibrating Analysis Confidence...");

  const rawConf = perceptionData.geminiConfidenceRaw !== undefined ? perceptionData.geminiConfidenceRaw : 0.85;

  // Compute a continuous, natural variation factor (from 0.0 to 1.0) based on all visual parameters
  let score = 0;
  let maxScore = 0;

  if (perceptionData.imageQuality === "high") { score += 3; }
  else if (perceptionData.imageQuality === "medium") { score += 2; }
  else { score += 1.5; } // Default / low
  maxScore += 3;

  if (perceptionData.lightingCondition === "good") { score += 3; }
  else if (perceptionData.lightingCondition === "poor_lighting") { score += 1.5; }
  else { score += 1; }
  maxScore += 3;

  if (perceptionData.visibility === "fully_visible") { score += 3; }
  else if (perceptionData.visibility === "partially_occluded") { score += 2; }
  else { score += 1; }
  maxScore += 3;

  if (perceptionData.motionBlur !== true) { score += 2; }
  maxScore += 2;

  if (perceptionData.complexScene !== true) { score += 2; }
  maxScore += 2;

  if (perceptionData.multipleIssuesDetected !== true) { score += 2; }
  maxScore += 2;

  if (perceptionData.cameraAngle === "optimal") { score += 3; }
  else if (perceptionData.cameraAngle === "wide_angle") { score += 2.5; }
  else if (perceptionData.cameraAngle === "steep_angle") { score += 2; }
  else { score += 1; }
  maxScore += 3;

  if (perceptionData.estimatedScale === "massive" || perceptionData.estimatedScale === "large" || perceptionData.estimatedScale === "medium") {
    score += 2;
  } else if (perceptionData.estimatedScale === "small") {
    score += 1.5;
  } else {
    score += 1;
  }
  maxScore += 2;

  score += rawConf * 5;
  maxScore += 5;

  const variationFactor = score / maxScore; // continuous value roughly between 0.1 and 1.0

  // Classify into specific confidence target ranges
  let category = "";
  let minRange = 0.55;
  let maxRange = 0.70;

  const isPoorLightingOrBlurOrPartialVisibility =
    perceptionData.lightingCondition === "poor_lighting" ||
    perceptionData.lightingCondition === "night" ||
    perceptionData.motionBlur === true ||
    perceptionData.visibility === "poor_visibility" ||
    perceptionData.visibility === "partially_occluded" ||
    perceptionData.imageQuality === "low";

  const isModerateAmbiguity =
    perceptionData.complexScene === true ||
    perceptionData.multipleIssuesDetected === true ||
    perceptionData.cameraAngle === "obstructed_angle" ||
    perceptionData.cameraAngle === "steep_angle" ||
    perceptionData.estimatedScale === "tiny" ||
    rawConf < 0.75;

  const isExceptionallyClearCloseUpUnambiguous =
    perceptionData.imageQuality === "high" &&
    perceptionData.visibility === "fully_visible" &&
    perceptionData.lightingCondition === "good" &&
    perceptionData.cameraAngle === "optimal" &&
    perceptionData.motionBlur !== true &&
    perceptionData.complexScene !== true &&
    perceptionData.multipleIssuesDetected !== true &&
    perceptionData.estimatedScale !== "tiny" &&
    rawConf >= 0.94;

  const isClearButOrdinary =
    perceptionData.imageQuality === "medium" ||
    rawConf < 0.88;

  if (isPoorLightingOrBlurOrPartialVisibility) {
    category = "Poor lighting / blur / partial visibility (55-70%)";
    minRange = 0.55;
    maxRange = 0.70;
  } else if (isModerateAmbiguity) {
    category = "Moderate ambiguity (65-80%)";
    minRange = 0.65;
    maxRange = 0.80;
  } else if (isExceptionallyClearCloseUpUnambiguous) {
    category = "Exceptionally clear, close-up, unambiguous (91-95%)";
    minRange = 0.91;
    maxRange = 0.95;
  } else if (isClearButOrdinary) {
    category = "Clear but ordinary image (75-85%)";
    minRange = 0.75;
    maxRange = 0.85;
  } else {
    // Very clear image (80-90%)
    category = "Very clear image (80-90%)";
    minRange = 0.80;
    maxRange = 0.90;
  }

  // Calculate final interpolated confidence score
  const finalConfidence = minRange + (maxRange - minRange) * variationFactor;

  // Round to 2 decimal places (so e.g. 0.84)
  const roundedConfidence = Number(finalConfidence.toFixed(2));

  console.log(`- Detected Category: ${category}`);
  console.log(`- Computed Variation Factor: ${variationFactor.toFixed(3)}`);
  console.log(`- Raw Gemini Confidence: ${rawConf.toFixed(2)}`);
  console.log(`- Final Calibrated Confidence: ${roundedConfidence}`);
  console.log("🔒 --------------------------------------------------\n");

  return roundedConfidence;
}
