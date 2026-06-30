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
  // Methodology metadata for frontend alignment
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
}

interface Range {
  min: number;
  max: number;
  category: string;
}

const SUBTYPE_RANGES: Record<string, Range> = {
  // WASTE
  litter_single: { min: 400, max: 1000, category: "waste_bin" },
  litter_scattered: { min: 1000, max: 2000, category: "waste_bin" },
  waste_bin_overflow: { min: 1500, max: 2500, category: "waste_bin" },
  illegal_dumping_small: { min: 2500, max: 4000, category: "waste_bin" },
  illegal_dumping_large: { min: 4000, max: 6000, category: "waste_bin" },
  hazardous_waste: { min: 6000, max: 12000, category: "waste_bin" },

  // ROAD
  pothole_minor: { min: 5000, max: 7000, category: "road" },
  pothole_major: { min: 7000, max: 10000, category: "road" },
  road_surface_damage: { min: 8000, max: 15000, category: "road" },
  road_collapse: { min: 20000, max: 45000, category: "road" },

  // FOOTPATH
  footpath_crack_minor: { min: 2000, max: 3500, category: "footpath" },
  footpath_crack_major: { min: 3500, max: 5000, category: "footpath" },
  footpath_collapsed: { min: 5000, max: 8000, category: "footpath" },

  // WATER
  water_leakage_minor: { min: 4000, max: 6000, category: "water_pipe" },
  water_leakage_major: { min: 6000, max: 9000, category: "water_pipe" },
  water_main_burst: { min: 10000, max: 25000, category: "water_pipe" },
  drainage_blocked: { min: 3000, max: 8000, category: "drainage" },

  // ELECTRICAL
  streetlight_outage: { min: 2000, max: 3500, category: "streetlight" },
  streetlight_damaged: { min: 3500, max: 5000, category: "streetlight" },
  electrical_hazard: { min: 6000, max: 12000, category: "electrical" },
  electrical_exposed: { min: 10000, max: 20000, category: "electrical" },

  // STRUCTURAL
  wall_crack_minor: { min: 4000, max: 8000, category: "structural" },
  wall_crack_major: { min: 8000, max: 18000, category: "structural" },
  building_hazard: { min: 20000, max: 50000, category: "structural" },

  // DEFAULT FALLBACK
  default_fallback: { min: 4000, max: 8000, category: "road" }
};

export function computeCostOfInaction(issue: CostInput): CostOfInactionResult {
  console.log("\n💰 --------------------------------------------------");
  console.log("💰 [COST ENGINE] Evaluating Cost of Inaction...");

  const type = (issue.issueType || "").toLowerCase();
  const asset = (issue.affectedAsset || "").toLowerCase();
  const severity = Math.min(10, Math.max(1, issue.technicalSeverity || issue.severity || 5));

  // Get perceptionData fields safely
  const pData = issue.perceptionData || {};
  const extent = (pData.damageExtent || issue.damageExtent || "moderate").toLowerCase();
  const affectedArea = (pData.estimatedAffectedArea || issue.estimatedAffectedArea || "medium").toLowerCase();
  const scale = (pData.estimatedScale || issue.estimatedScale || "medium").toLowerCase();
  
  const electricalHazard = pData.electricalHazard || issue.electricalHazard || false;
  const activeLeak = pData.activeLeak || issue.activeLeak || false;
  const structuralDamage = pData.structuralDamage || issue.structuralDamage || false;
  const multipleIssuesDetected = pData.multipleIssuesDetected || issue.multipleIssuesDetected || false;

  let subtype = "default_fallback";

  // 1. Direct explicit subtype lookup from Gemini Vision (architecture directive)
  const wasteSubtypeInput = (issue.wasteSubtype || pData.wasteSubtype || "").toLowerCase().trim();
  const roadSubtypeInput = (issue.roadSubtype || pData.roadSubtype || "").toLowerCase().trim();
  const waterSubtypeInput = (issue.waterSubtype || pData.waterSubtype || "").toLowerCase().trim();
  const electricalSubtypeInput = (issue.electricalSubtype || pData.electricalSubtype || "").toLowerCase().trim();
  const structuralSubtypeInput = (issue.structuralSubtype || pData.structuralSubtype || "").toLowerCase().trim();

  let explicitSubtype = "";
  if (wasteSubtypeInput && wasteSubtypeInput !== "none" && SUBTYPE_RANGES[wasteSubtypeInput]) {
    explicitSubtype = wasteSubtypeInput;
  } else if (roadSubtypeInput && roadSubtypeInput !== "none" && SUBTYPE_RANGES[roadSubtypeInput]) {
    explicitSubtype = roadSubtypeInput;
  } else if (waterSubtypeInput && waterSubtypeInput !== "none" && SUBTYPE_RANGES[waterSubtypeInput]) {
    explicitSubtype = waterSubtypeInput;
  } else if (electricalSubtypeInput && electricalSubtypeInput !== "none" && SUBTYPE_RANGES[electricalSubtypeInput]) {
    explicitSubtype = electricalSubtypeInput;
  } else if (structuralSubtypeInput && structuralSubtypeInput !== "none" && SUBTYPE_RANGES[structuralSubtypeInput]) {
    explicitSubtype = structuralSubtypeInput;
  }

  if (explicitSubtype) {
    subtype = explicitSubtype;
    console.log(`- [COST ENGINE] Direct engineering subtype trusted: ${subtype}`);
  } else {
    // FALLBACK HEURISTIC (LEGACY RECONSTRUCTION)
    // Category Detection
    // 1. WASTE
    if (asset === "waste_bin" || type.includes("waste") || type.includes("garbage") || type.includes("dumping") || asset.includes("waste") || asset.includes("bin") || type.includes("litter")) {
      if (type.includes("hazard") || asset.includes("hazard") || type.includes("toxic") || type.includes("chemical") || type.includes("medical") || pData.hazardous || issue.hazardous) {
        subtype = "hazardous_waste";
      } else {
        // Determine single item text cues
        const titleLower = (issue.title || "").toLowerCase();
        const descLower = (issue.description || pData.description || "").toLowerCase();
        const isSingleCue = 
          titleLower.includes("single") ||
          titleLower.includes("one bag") ||
          titleLower.includes("torn refuse bag") ||
          titleLower.includes("torn garbage bag") ||
          titleLower.includes("torn trash bag") ||
          titleLower.includes("one garbage") ||
          titleLower.includes("one trash") ||
          descLower.includes("single") ||
          descLower.includes("a large, torn black refuse bag") ||
          descLower.includes("a torn black refuse bag") ||
          descLower.includes("one garbage bag") ||
          descLower.includes("one trash bag") ||
          descLower.includes("isolated litter") ||
          (pData.visibleObjects && pData.visibleObjects.length <= 1 && pData.visibleObjects.includes("trash bag"));

        // 1. issueType (highest priority)
        let detectedSubtypeByPriority: string | null = null;
        
        if (type === "hazardous_waste") {
          detectedSubtypeByPriority = "hazardous_waste";
        } else if (type === "waste_overflow" || type.includes("overflow")) {
          detectedSubtypeByPriority = "waste_bin_overflow";
        } else if (type === "litter") {
          detectedSubtypeByPriority = "litter_scattered";
        } else if (type === "illegal_dumping" || type.includes("dumping")) {
          // Differentiate based on lower priority parameters
          if (affectedArea === "large") {
            detectedSubtypeByPriority = "illegal_dumping_large";
          } else {
            detectedSubtypeByPriority = "illegal_dumping_small";
          }
        }
        
        // 2. affectedAsset
        if (!detectedSubtypeByPriority) {
          if (asset === "waste_bin" || asset.includes("bin")) {
            detectedSubtypeByPriority = "waste_bin_overflow";
          }
        }
        
        // 3. estimatedAffectedArea & 4. damageExtent & 5. objectCount & 6. visibleWasteCoverage & 7. estimatedScale
        if (!detectedSubtypeByPriority) {
          if (affectedArea === "large") {
            detectedSubtypeByPriority = "illegal_dumping_large";
          } else if (affectedArea === "medium") {
            detectedSubtypeByPriority = "illegal_dumping_small";
          } else if (affectedArea === "small") {
            detectedSubtypeByPriority = "litter_scattered";
          }
        }
        
        // Default to scattered if still undetected
        subtype = detectedSubtypeByPriority || "litter_scattered";

        // Override based on specific object count / waste coverage / single cue if available
        const objCount = pData.objectCount !== undefined ? Number(pData.objectCount) : undefined;
        const coverage = pData.visibleWasteCoverage !== undefined ? String(pData.visibleWasteCoverage).toLowerCase() : undefined;
        
        if (isSingleCue || objCount === 1 || coverage === "single" || coverage === "low" || coverage === "minimal") {
          // If it's a single item or tiny isolated litter, it's litter_single
          subtype = "litter_single";
        } else if (objCount !== undefined && objCount > 10) {
          if (affectedArea === "large") {
            subtype = "illegal_dumping_large";
          } else {
            subtype = "illegal_dumping_small";
          }
        } else if (objCount !== undefined && objCount > 3) {
          if (subtype === "litter_single") {
            subtype = "litter_scattered";
          }
        }

        // Finally, apply Safety Rule: single bag or torn refuse bag MUST NEVER be illegal_dumping_large or illegal_dumping_small
        if (isSingleCue) {
          if (subtype === "illegal_dumping_large" || subtype === "illegal_dumping_small") {
            subtype = "litter_single";
          }
        }
      }
    }
    // 2. ROAD
    else if (asset === "road" || type.includes("road") || type.includes("pothole") || asset.includes("pavement") || type.includes("collapse") || type.includes("sinkhole")) {
      if (structuralDamage || type.includes("collapse") || type.includes("sinkhole")) {
        subtype = "road_collapse";
      } else if (type.includes("surface") || type.includes("pavement") || affectedArea === "large") {
        subtype = "road_surface_damage";
      } else if (extent === "minor") {
        subtype = "pothole_minor";
      } else {
        subtype = "pothole_major";
      }
    }
    // 3. FOOTPATH
    else if (asset === "footpath" || type.includes("footpath") || type.includes("sidewalk") || asset.includes("footpath") || asset.includes("sidewalk")) {
      if (structuralDamage || extent === "severe") {
        subtype = "footpath_collapsed";
      } else if (extent === "minor" || affectedArea === "small") {
        subtype = "footpath_crack_minor";
      } else {
        subtype = "footpath_crack_major";
      }
    }
    // 4. WATER & DRAINAGE
    else if (asset === "water_pipe" || asset === "drainage" || type.includes("water") || type.includes("leak") || asset.includes("water") || type.includes("drain") || type.includes("sewer") || asset.includes("drain")) {
      if (type.includes("drain") || type.includes("sewer") || asset.includes("drain") || asset.includes("sewer") || type.includes("block")) {
        subtype = "drainage_blocked";
      } else {
        if (activeLeak && extent === "severe") {
          subtype = "water_main_burst";
        } else if (activeLeak && extent === "moderate") {
          subtype = "water_leakage_major";
        } else if (extent === "minor" || affectedArea === "small") {
          subtype = "water_leakage_minor";
        } else if (extent === "severe" || type.includes("burst")) {
          subtype = "water_main_burst";
        } else {
          subtype = "water_leakage_major";
        }
      }
    }
    // 5. ELECTRICAL & LIGHTING
    else if (asset === "streetlight" || asset === "electrical" || type.includes("streetlight") || asset.includes("streetlight") || type.includes("electrical") || asset.includes("electrical") || (type.includes("hazard") && (asset.includes("wire") || asset.includes("power") || type.includes("wire") || type.includes("power")))) {
      if (asset === "streetlight" || type.includes("streetlight") || asset.includes("streetlight") || type.includes("lamp") || type.includes("light")) {
        if (extent === "minor" || type.includes("outage") || type.includes("off") || type.includes("unlit")) {
          subtype = "streetlight_outage";
        } else {
          subtype = "streetlight_damaged";
        }
      } else {
        if (electricalHazard && (extent === "severe" || type.includes("exposed") || asset === "electrical")) {
          subtype = "electrical_exposed";
        } else {
          subtype = "electrical_hazard";
        }
      }
    }
    // 6. STRUCTURAL
    else if (type.includes("wall") || type.includes("building") || asset.includes("wall") || asset.includes("building") || type.includes("structure") || asset.includes("structure") || type.includes("crack")) {
      if (extent === "severe" || type.includes("hazard") || type.includes("building")) {
        subtype = "building_hazard";
      } else if (extent === "minor") {
        subtype = "wall_crack_minor";
      } else {
        subtype = "wall_crack_major";
      }
    }
  }

  // Get subtype range
  const range = SUBTYPE_RANGES[subtype] || SUBTYPE_RANGES.default_fallback;
  const category = range.category;

  // Severity Interpolation
  const interpolationFactor = Math.min(1.0, Math.max(0.0, severity / 10));
  const baseCost = range.min + (range.max - range.min) * interpolationFactor;

  // Apply Damage Extent Multiplier
  // Architectural Refinement: damageExtent is already encoded in technicalSeverity (which determines the interpolation factor),
  // so applying an additional multiplier here would double-count the damage severity.
  // We set damageMultiplier to 1.0 to eliminate the redundancy while maintaining compatibility with logging and the frontend.
  const damageMultiplier = 1.0;

  const rawCostNow = baseCost * damageMultiplier;
  const repairCostNow = Math.round(rawCostNow / 100) * 100;

  // Sanity Cap Checks
  const severityCap: Record<number, number> = {
    1: 2000,
    2: 4000,
    3: 6000,
    4: 10000,
    5: 18000
  };

  const exemptAssets = ["water_pipe", "electrical", "structural", "road", "streetlight"];
  const assetExempt = exemptAssets.includes(asset) || asset.includes("water") || asset.includes("electrical") || asset.includes("structural") || asset.includes("pipe") || asset.includes("road") || asset.includes("streetlight");

  let finalRepairCostNow = repairCostNow;
  const cap = severityCap[severity];
  if (cap !== undefined && !assetExempt && repairCostNow > cap) {
    finalRepairCostNow = cap;
  }

  const rawCostNowCapped = finalRepairCostNow;

  // Deterioration Multipliers
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

  const repairCost30Days = Math.round((rawCostNowCapped * decay30) / 100) * 100;
  const repairCost90Days = Math.round((rawCostNowCapped * decay90) / 100) * 100;

  // Calculate percentage increases
  const costIncrease30 = Math.round(((repairCost30Days - finalRepairCostNow) / finalRepairCostNow) * 100) || 0;
  const costIncrease90 = Math.round(((repairCost90Days - finalRepairCostNow) / finalRepairCostNow) * 100) || 0;

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

  const severityFactor = Math.min(1.0, Math.max(0.0, (severity - 1) / 9));
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

  const SUBTYPE_ASSET_LABELS: Record<string, string> = {
    litter_single: "Single Litter Item / Torn Bag",
    litter_scattered: "Scattered Litter / Trash",
    waste_bin_overflow: "Waste Bin Overflow",
    illegal_dumping_small: "Small Illegal Dumping Pile",
    illegal_dumping_large: "Large Illegal Dumping Site",
    hazardous_waste: "Hazardous / Chemical Waste",

    pothole_minor: "Minor Road Pothole",
    pothole_major: "Major Road Pothole",
    road_surface_damage: "Road Surface Damage",
    road_collapse: "Road Collapse / Sinkhole",

    footpath_crack_minor: "Minor Footpath Crack",
    footpath_crack_major: "Major Footpath Crack",
    footpath_collapsed: "Collapsed Footpath / Sidewalk",

    water_leakage_minor: "Minor Water Leakage",
    water_leakage_major: "Major Water Leakage",
    water_main_burst: "Water Main Burst",
    drainage_blocked: "Blocked Drainage / Sewerage",

    streetlight_outage: "Streetlight Outage",
    streetlight_damaged: "Streetlight Damaged / Broken",
    electrical_hazard: "Electrical Hazard",
    electrical_exposed: "Exposed Electrical Wires",

    wall_crack_minor: "Minor Wall Crack",
    wall_crack_major: "Major Wall Structural Crack",
    building_hazard: "Building Collapse / Structural Hazard",

    default_fallback: "Municipal Infrastructure"
  };

  const assetLabel = SUBTYPE_ASSET_LABELS[subtype] || "Municipal Infrastructure";
  const extentLabel = extent.charAt(0).toUpperCase() + extent.slice(1);
  const isCapped = finalRepairCostNow < repairCostNow;
  const capValue = cap !== undefined ? cap : undefined;

  console.log(`- Subtype detected: ${subtype} (Category: ${category})`);
  console.log(`- Base Repair Cost (Severity interpolated): ₹${Math.round(baseCost)}`);
  console.log(`- Damage Multiplier applied: x${damageMultiplier} -> Repair Cost Now: ₹${repairCostNow}`);
  if (finalRepairCostNow < repairCostNow) {
    console.log(`- [SANITY CAP APPLIED]: ₹${finalRepairCostNow}`);
  }
  console.log(`- Projected 30 days: ₹${repairCost30Days} (+${costIncrease30}%)`);
  console.log(`- Projected 90 days: ₹${repairCost90Days} (+${costIncrease90}%)`);
  console.log(`- Risk Escalation: ${riskEscalation}`);
  console.log(`- Environmental Impact: ${environmentalImpact}`);
  console.log(`- Citizens Affected: ~${estimatedCitizensAffected}/day`);
  console.log("💰 --------------------------------------------------\n");

  return {
    repairCostNow: finalRepairCostNow,
    repairCost30Days,
    repairCost90Days,
    costIncrease30,
    costIncrease90,
    riskEscalation,
    estimatedCitizensAffected,
    environmentalImpact,
    recommendedAction,
    rationale,
    // Metadata properties
    subtype,
    baseCost: Math.round(baseCost),
    damageMultiplier,
    decay30,
    decay90,
    minCost: range.min,
    maxCost: range.max,
    assetLabel,
    extentLabel,
    isCapped,
    capValue
  };
}
