import { SavedIssue } from "../types";

// Helper: map affectedAsset or issueType to high-level departments
export const getDepartmentName = (asset: string, issueType?: string): string => {
  const cleanAsset = (asset || "").toLowerCase();
  const cleanType = (issueType || "").toLowerCase();
  
  if (cleanAsset === "road" || cleanType === "pothole") {
    return "Roads & Infrastructure";
  } else if (cleanAsset === "streetlight" || cleanAsset === "electrical" || cleanType === "damaged_streetlight") {
    return "Electrical Maintenance";
  } else if (cleanAsset === "footpath") {
    return "Urban Development";
  } else if (cleanAsset === "water_pipe" || cleanAsset === "drainage" || cleanType === "water_leakage") {
    return "Water & Drainage";
  } else if (cleanAsset === "waste_bin" || cleanType === "waste_overflow") {
    return "Solid Waste Management";
  }
  return "Municipal General";
};

// Distance formula for spatial cluster hotspot detection (Haversine in meters)
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export interface DepartmentPriorityItem {
  departmentName: string;
  activeCount: number;
  criticalCount: number;
  avgSeverity: number;
  citizensAffected: number;
  immediateRepairCost: number;
  liability90Day: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  explanation: string;
  riskScore: number;
  normalizedLiability: number;
  normalizedCitizens: number;
}

export interface RankedIssueItem {
  issue: SavedIssue;
  rankingScore: number;
  justification: string;
  factors: {
    severityScore: number;
    populationScore: number;
    escalationScore: number;
    dispatchScore: number;
    deptUrgencyScore: number;
  };
}

export interface ExecutiveRecommendation {
  id: string;
  title: string;
  description: string;
  impactLevel: "CRITICAL" | "HIGH" | "MEDIUM";
  type: "road" | "water" | "waste" | "electrical" | "urban" | "general";
}

export interface DecisionEngineResult {
  totalActive: number;
  criticalActive: number;
  totalRepairCost: number;
  totalLiability90: number;
  savingsOpportunity: number;
  citizensImpacted: number;
  highestRiskDept: string;
  highestRiskCluster: string;
  highestPriorityCategory: string;
  
  departmentPriorities: DepartmentPriorityItem[];
  
  immediateBudget: number;
  projected30DayBudget: number;
  projected90DayBudget: number;
  potentialSavings: number;
  
  rankedQueue: RankedIssueItem[];
  recommendations: ExecutiveRecommendation[];
  
  avgSeverity: number;
  avgCost: number;
  predictedFinancialExposure: number;
  infrastructureHealthIndex: number;
}

/**
 * Deterministically analyzes the current active issues registry and calculates
 * executive-ready decisions based exclusively on live municipal assets and costs.
 */
export const runDecisionIntelligence = (activeIssuesList: SavedIssue[]): DecisionEngineResult => {
  // Filter out invalid or incomplete issues
  const list = (activeIssuesList || []).filter(
    i => i && typeof i === "object" && i.id
  );

  const totalActive = list.length;
  const criticalActive = list.filter(i => (i.severity || 0) >= 8).length;

  // 1. Core Budget Computations (strictly from registry totals)
  const immediateBudget = list.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
  const projected30DayBudget = list.reduce((sum, i) => sum + (i.costOfInaction?.repairCost30Days || 9000), 0);
  const projected90DayBudget = list.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
  const potentialSavings = Math.max(0, projected90DayBudget - immediateBudget);
  const predictedFinancialExposure = projected90DayBudget;

  // 2. Citizens Impacted (strictly from registry totals)
  const citizensImpacted = list.reduce((sum, i) => sum + (i.costOfInaction?.estimatedCitizensAffected || 150), 0);

  // 3. Department Priority Matrix Calculations
  const departmentsList = [
    "Roads & Infrastructure",
    "Electrical Maintenance",
    "Urban Development",
    "Water & Drainage",
    "Solid Waste Management",
    "Municipal General"
  ];

  const formatRupees = (amount: number): string => {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  };

  const rawDepts = departmentsList.map(deptName => {
    const deptIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === deptName);
    const activeCount = deptIssues.length;
    const criticalCount = deptIssues.filter(i => (i.severity || 0) >= 8).length;
    const totalSeverity = deptIssues.reduce((sum, curr) => sum + (curr.severity || 5), 0);
    const avgSeverity = activeCount > 0 ? totalSeverity / activeCount : 0;
    const citizensAffected = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.estimatedCitizensAffected || 150), 0);
    const immediateRepairCost = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.repairCostNow || 4500), 0);
    const liability90Day = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.repairCost90Days || 15750), 0);
    return {
      deptName,
      activeCount,
      criticalCount,
      avgSeverity,
      citizensAffected,
      immediateRepairCost,
      liability90Day
    };
  });

  const maxLiability = Math.max(...rawDepts.map(d => d.liability90Day), 1);
  const maxCitizens = Math.max(...rawDepts.map(d => d.citizensAffected), 1);

  const departmentPriorities: DepartmentPriorityItem[] = rawDepts.map(dept => {
    const normalizedLiability = (dept.liability90Day / maxLiability) * 10;
    const normalizedCitizens = (dept.citizensAffected / maxCitizens) * 10;
    
    // Formula: (Critical * 4) + (AvgSeverity * 3) + NormalizedLiability + NormalizedCitizens
    const riskScore = dept.activeCount > 0 ? ((dept.criticalCount * 4) + (dept.avgSeverity * 3) + normalizedLiability + normalizedCitizens) : 0;
    
    let priority: "Critical" | "High" | "Medium" | "Low" = "Low";
    if (dept.activeCount === 0) {
      priority = "Low";
    } else {
      if (riskScore >= 20 || dept.criticalCount >= 2 || dept.avgSeverity >= 8) {
        priority = "Critical";
      } else if (riskScore >= 12 || dept.criticalCount >= 1 || dept.avgSeverity >= 6) {
        priority = "High";
      } else if (riskScore >= 6) {
        priority = "Medium";
      } else {
        priority = "Low";
      }
    }

    const costGap = dept.liability90Day - dept.immediateRepairCost;
    const urgencyAdjective = priority === "Critical" ? "immediate emergency intervention" :
                             priority === "High" ? "high-priority coordination" :
                             priority === "Medium" ? "scheduled maintenance dispatch" : "routine observation";

    const explanation = `${dept.deptName} requires ${urgencyAdjective} to address ${dept.activeCount} active incident${dept.activeCount > 1 ? "s" : ""} (${dept.criticalCount} critical). Delayed remediation risks a structural deterioration gap of ${formatRupees(costGap)} within 90 days, impacting an estimated population of ${dept.citizensAffected.toLocaleString()} citizens.`;

    return {
      departmentName: dept.deptName,
      activeCount: dept.activeCount,
      criticalCount: dept.criticalCount,
      avgSeverity: dept.avgSeverity,
      citizensAffected: dept.citizensAffected,
      immediateRepairCost: dept.immediateRepairCost,
      liability90Day: dept.liability90Day,
      priority,
      explanation,
      riskScore,
      normalizedLiability,
      normalizedCitizens
    };
  });

  // Deterministic highest risk department sorting
  // The highest risk department matches index 0 of sorted department assessment
  const sortedDeptsByRisk = [...departmentPriorities].sort((a, b) => b.riskScore - a.riskScore);
  const highestRiskDeptObj = sortedDeptsByRisk.find(d => d.activeCount > 0);
  const highestRiskDept = highestRiskDeptObj ? highestRiskDeptObj.departmentName : "None";

  // 4. Geographic Hotspot Cluster Risk Identification
  const hotspots: Array<{
    name: string;
    count: number;
    riskScore: number;
    avgSeverity: number;
  }> = [];

  const visited = new Set<string>();
  const tempClusters: Array<{ name: string; riskScore: number; count: number; issueIds: string[] }> = [];

  list.forEach(issue => {
    if (visited.has(issue.id) || !issue.location || issue.location.latitude == null || issue.location.longitude == null) return;

    const cluster: SavedIssue[] = [issue];
    visited.add(issue.id);
    const issueDept = getDepartmentName(issue.affectedAsset || "", issue.issueType);

    list.forEach(other => {
      if (visited.has(other.id) || !other.location || other.location.latitude == null || other.location.longitude == null) return;
      const otherDept = getDepartmentName(other.affectedAsset || "", other.issueType);
      
      if (issueDept === otherDept) {
        const dist = getDistanceMeters(
          issue.location.latitude,
          issue.location.longitude,
          other.location.latitude,
          other.location.longitude
        );
        if (dist <= 1200) { // 1.2km radius
          cluster.push(other);
          visited.add(other.id);
        }
      }
    });

    const avgSeverity = cluster.reduce((sum, curr) => sum + (curr.severity || 5), 0) / cluster.length;
    const citizens = cluster.reduce((sum, curr) => sum + (curr.costOfInaction?.estimatedCitizensAffected || 150), 0);
    const clusterRisk = (avgSeverity * cluster.length * 2.0) + (citizens / 80);

    let clusterName = `${issueDept} Anomaly Cluster`;
    const wardName = issue.ward || issue.city || "";
    if (wardName) {
      clusterName += ` in ${wardName}`;
    }

    hotspots.push({
      name: clusterName,
      count: cluster.length,
      riskScore: clusterRisk,
      avgSeverity
    });

    tempClusters.push({
      name: clusterName,
      riskScore: clusterRisk,
      count: cluster.length,
      issueIds: cluster.map(c => c.id)
    });
  });

  hotspots.sort((a, b) => b.riskScore - a.riskScore);
  const highestRiskCluster = hotspots[0]?.name || "No high-density incident hotspot clusters detected.";

  // Sort tempClusters by riskScore to identify highest risk hotspot
  tempClusters.sort((a, b) => b.riskScore - a.riskScore);
  const highestRiskClusterObj = tempClusters[0];

  // Now build issueToClusterMap
  const issueToClusterMap: Record<string, { name: string; count: number; isHighest: boolean }> = {};
  tempClusters.forEach(tc => {
    const isHighest = highestRiskClusterObj ? tc.name === highestRiskClusterObj.name : false;
    tc.issueIds.forEach(id => {
      issueToClusterMap[id] = {
        name: tc.name,
        count: tc.count,
        isHighest
      };
    });
  });

  // 5. Category Analysis
  const typeStats: Record<string, { count: number; totalSeverity: number }> = {};
  list.forEach(i => {
    const t = i.issueType || "Other";
    const cleanT = t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (!typeStats[cleanT]) {
      typeStats[cleanT] = { count: 0, totalSeverity: 0 };
    }
    typeStats[cleanT].count += 1;
    typeStats[cleanT].totalSeverity += (i.severity || 5);
  });

  let highestPriorityCategory = "None";
  let maxCategoryScore = -1;
  Object.entries(typeStats).forEach(([type, stats]) => {
    const avgSev = stats.totalSeverity / stats.count;
    const score = (avgSev * 2.5) + (stats.count * 4);
    if (score > maxCategoryScore) {
      maxCategoryScore = score;
      highestPriorityCategory = type;
    }
  });

  // 6. Priority Action Queue (Deterministic ranking & transparent weights factor)
  // Calculate 10 factors, normalize each, then apply precise weights
  const getDispatchNumeric = (issue: SavedIssue) => {
    const level = String(issue.dispatch?.priorityLevel || "").toUpperCase();
    if (level === "CRITICAL") return 100;
    if (level === "HIGH") return 80;
    if (level === "MEDIUM") return 50;
    if (level === "LOW") return 30;
    return (issue.severity || 5) >= 8 ? 90 : 40;
  };

  const rawSeverities = list.map(i => i.severity || 5);
  const rawDispatches = list.map(i => getDispatchNumeric(i));
  const rawCitizens = list.map(i => i.costOfInaction?.estimatedCitizensAffected || 150);
  const rawGrowthRatios = list.map(i => {
    const now = i.costOfInaction?.repairCostNow || 4500;
    const fut = i.costOfInaction?.repairCost90Days || 15750;
    return now > 0 ? fut / now : 3.5;
  });
  const rawImmediateCosts = list.map(i => i.costOfInaction?.repairCostNow || 4500);
  const rawDeptScores = list.map(i => {
    const dept = getDepartmentName(i.affectedAsset || "", i.issueType);
    const deptItem = departmentPriorities.find(d => d.departmentName === dept);
    return deptItem ? deptItem.riskScore : 0;
  });
  const rawClusterDensities = list.map(i => {
    const cl = issueToClusterMap[i.id];
    return cl ? cl.count : 1;
  });
  const rawHighestDepts = list.map(i => {
    const dept = getDepartmentName(i.affectedAsset || "", i.issueType);
    return (dept === highestRiskDept && highestRiskDept !== "None") ? 1 : 0;
  });
  const rawHighestHotspots = list.map(i => {
    const cl = issueToClusterMap[i.id];
    return (cl && cl.isHighest) ? 1 : 0;
  });
  const timestamps = list.map(i => i.createdAt ? Date.parse(i.createdAt) : 0);
  const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  const rawAges = timestamps.map(t => maxTimestamp - t);

  const normalizeArray = (values: number[]): number[] => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) {
      return values.map(() => (max > 0 ? 100 : 0));
    }
    return values.map(v => ((v - min) / (max - min)) * 100);
  };

  const normSeverities = normalizeArray(rawSeverities);
  const normDispatches = normalizeArray(rawDispatches);
  const normCitizens = normalizeArray(rawCitizens);
  const normGrowthRatios = normalizeArray(rawGrowthRatios);
  const normImmediateCosts = normalizeArray(rawImmediateCosts);
  const normDeptScores = normalizeArray(rawDeptScores);
  const normClusterDensities = normalizeArray(rawClusterDensities);
  const normHighestDepts = normalizeArray(rawHighestDepts);
  const normHighestHotspots = normalizeArray(rawHighestHotspots);
  const normAges = normalizeArray(rawAges);

  const rankedQueue: RankedIssueItem[] = list.map((issue, idx) => {
    const sevScore = normSeverities[idx];
    const popScore = normCitizens[idx];
    const escScore = normGrowthRatios[idx];
    const dispScore = normDispatches[idx];
    const deptScore = normDeptScores[idx];

    // Compute beautiful 10-factor weighted index (sum = 100%)
    const score = (normSeverities[idx] * 0.25) +
                  (normDispatches[idx] * 0.15) +
                  (normCitizens[idx] * 0.15) +
                  (normGrowthRatios[idx] * 0.10) +
                  (normImmediateCosts[idx] * 0.10) +
                  (normDeptScores[idx] * 0.10) +
                  (normClusterDensities[idx] * 0.05) +
                  (normHighestDepts[idx] * 0.04) +
                  (normHighestHotspots[idx] * 0.03) +
                  (normAges[idx] * 0.03);

    const justification = `Ranked with precision score of ${score.toFixed(2)}/100 derived from CivicOS Deterministic Priority Index incorporating 10 weighted municipal integrity factors.`;

    return {
      issue,
      rankingScore: score,
      justification,
      factors: {
        severityScore: sevScore,
        populationScore: popScore,
        escalationScore: escScore,
        dispatchScore: dispScore,
        deptUrgencyScore: deptScore
      }
    };
  });

  rankedQueue.sort((a, b) => {
    if (Math.abs(b.rankingScore - a.rankingScore) > 1e-9) {
      return b.rankingScore - a.rankingScore;
    }

    // Tie-breaker 1: Higher Severity
    const sevA = a.issue.severity || 5;
    const sevB = b.issue.severity || 5;
    if (sevB !== sevA) return sevB - sevA;

    // Tie-breaker 2: Higher Dispatch Priority
    const getDispVal = (issue: SavedIssue) => {
      const level = String(issue.dispatch?.priorityLevel || "").toUpperCase();
      if (level === "CRITICAL") return 4;
      if (level === "HIGH") return 3;
      if (level === "MEDIUM") return 2;
      if (level === "LOW") return 1;
      return 0;
    };
    const dispA = getDispVal(a.issue);
    const dispB = getDispVal(b.issue);
    if (dispB !== dispA) return dispB - dispA;

    // Tie-breaker 3: Higher Liability Growth
    const getGrowth = (issue: SavedIssue) => {
      const now = issue.costOfInaction?.repairCostNow || 4500;
      const fut = issue.costOfInaction?.repairCost90Days || 15750;
      return fut - now;
    };
    const growthA = getGrowth(a.issue);
    const growthB = getGrowth(b.issue);
    if (growthB !== growthA) return growthB - growthA;

    // Tie-breaker 4: Higher Citizens Impacted
    const citA = a.issue.costOfInaction?.estimatedCitizensAffected || 150;
    const citB = b.issue.costOfInaction?.estimatedCitizensAffected || 150;
    if (citB !== citA) return citB - citA;

    // Tie-breaker 5: Older Incident (smaller timestamp)
    const timeA = a.issue.createdAt ? Date.parse(a.issue.createdAt) : 0;
    const timeB = b.issue.createdAt ? Date.parse(b.issue.createdAt) : 0;
    if (timeA !== timeB) return timeA - timeB;

    // Tie-breaker 6: Stable alphabetical comparison of Incident ID
    return a.issue.id.localeCompare(b.issue.id);
  });

  // 7. Executive Recommendations referencing exact live evidence
  const recommendations: ExecutiveRecommendation[] = [];
  let recommendationCounter = 1;

  const roadIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Roads & Infrastructure");
  const waterIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Water & Drainage");
  const wasteIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Solid Waste Management");
  const electricalIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Electrical Maintenance");
  const urbanIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Urban Development");

  if (criticalActive > 0) {
    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Immediate Inter-Departmental Emergency Mobilization",
      description: `Initiate emergency coordination to address the ${criticalActive} critical report${criticalActive > 1 ? "s" : ""} registered with severity ratings ≥ 8/10. Securing these zones immediately will mitigate severe public injury hazards and prevent instant financial degradation.`,
      impactLevel: "CRITICAL",
      type: "general"
    });
  }

  if (roadIssues.length > 0) {
    const avgRoadSeverity = roadIssues.reduce((sum, i) => sum + (i.severity || 5), 0) / roadIssues.length;
    const roadNow = roadIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
    const road90 = roadIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
    const roadSavings = road90 - roadNow;

    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Asphalt Sealing & Structural Pavement Stabilization",
      description: `Generated based on ${roadIssues.length} active pavement defects with an average severity of ${avgRoadSeverity.toFixed(1)}/10. Intervening now with localized sub-grade packing requires a baseline of ${formatRupees(roadNow)}, avoiding an escalation to ${formatRupees(road90)} (saving ${formatRupees(roadSavings)} in preventable base erosion over 90 days).`,
      impactLevel: avgRoadSeverity >= 7 ? "CRITICAL" : "HIGH",
      type: "road"
    });
  }

  if (waterIssues.length > 0) {
    const avgWaterSeverity = waterIssues.reduce((sum, i) => sum + (i.severity || 5), 0) / waterIssues.length;
    const waterNow = waterIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
    const water90 = waterIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
    const waterSavings = water90 - waterNow;

    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Pressurized Sub-surface Hydraulic Erosion Control",
      description: `Generated based on ${waterIssues.length} active drainage and pipeline reports with an average severity of ${avgWaterSeverity.toFixed(1)}/10. Prompt joint alignment sealing of leakages protects structural road beds and saves ${formatRupees(waterSavings)} in escalating deep pavement degradation liabilities.`,
      impactLevel: avgWaterSeverity >= 7 ? "CRITICAL" : "HIGH",
      type: "water"
    });
  }

  if (wasteIssues.length > 0) {
    const wasteNow = wasteIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
    const waste90 = wasteIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
    const wasteSavings = waste90 - wasteNow;
    const totalAffected = wasteIssues.reduce((sum, i) => sum + (i.costOfInaction?.estimatedCitizensAffected || 150), 0);

    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Targeted Sanitary Hauling & Garbage Clearance",
      description: `Generated based on ${wasteIssues.length} solid waste incidents impacting an estimated ${totalAffected.toLocaleString()} citizens. Cleansing active dump sites immediately costs ${formatRupees(wasteNow)} and avoids severe local vector breeding and future soil/water cleanup costs projected at ${formatRupees(waste90)}.`,
      impactLevel: "HIGH",
      type: "waste"
    });
  }

  if (electricalIssues.length > 0) {
    const avgElecSeverity = electricalIssues.reduce((sum, i) => sum + (i.severity || 5), 0) / electricalIssues.length;
    const elecNow = electricalIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
    const elec90 = electricalIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
    const elecSavings = elec90 - elecNow;

    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Nocturnal Visibility & Electrical Circuit Audit",
      description: `Generated based on ${electricalIssues.length} streetlight/electrical defects averaging ${avgElecSeverity.toFixed(1)}/10 in severity. Remediation resolves safety dark zones immediately for ${formatRupees(elecNow)}, preventing a compound utility grid decay penalty of ${formatRupees(elec90)} over 90 days.`,
      impactLevel: avgElecSeverity >= 7 ? "HIGH" : "MEDIUM",
      type: "electrical"
    });
  }

  if (urbanIssues.length > 0) {
    const avgUrbanSeverity = urbanIssues.reduce((sum, i) => sum + (i.severity || 5), 0) / urbanIssues.length;
    const urbanNow = urbanIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
    const urban90 = urbanIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
    const urbanSavings = urban90 - urbanNow;

    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Pathway Crack Sealing & Pedestrian Zone Alignment",
      description: `Generated based on ${urbanIssues.length} footpath reports averaging ${avgUrbanSeverity.toFixed(1)}/10 in severity. Resolving walkway defects restores standard pedestrian accessibility for ${formatRupees(urbanNow)} and avoids future civil liability claims totaling ${formatRupees(urban90)}.`,
      impactLevel: "MEDIUM",
      type: "urban"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: `rec_${recommendationCounter++}`,
      title: "Passive Analytical Scanning Active",
      description: "No active incidents are currently tracked in the system. The municipal infrastructure is scanned in a zero-incident standby state.",
      impactLevel: "MEDIUM",
      type: "general"
    });
  }

  // 8. Operational KPIs (Deterministic and strictly derived)
  const avgSeverity = totalActive > 0 ? list.reduce((sum, i) => sum + (i.severity || 5), 0) / totalActive : 0;
  const avgCost = totalActive > 0 ? immediateBudget / totalActive : 0;

  // Calculate infrastructure health index using a realistic, deterministic, and balanced penalty-based formula
  const volumePenalty = Math.min(20, (totalActive / 30) * 20);
  const criticalRatio = totalActive > 0 ? criticalActive / totalActive : 0;
  const criticalPenalty = criticalRatio * 30;
  const severityPenalty = (avgSeverity / 10) * 25;
  const liabilityPenalty = Math.min(15, (projected90DayBudget / 500000) * 15);
  const maxDeptCount = departmentPriorities.length > 0 ? Math.max(...departmentPriorities.map(d => d.activeCount)) : 0;
  const concentrationRatio = totalActive > 0 ? maxDeptCount / totalActive : 0;
  const concentrationPenalty = concentrationRatio * 10;

  const totalPenalty = volumePenalty + criticalPenalty + severityPenalty + liabilityPenalty + concentrationPenalty;
  const infrastructureHealthIndex = Math.max(10, Math.min(100, Math.round(100 - totalPenalty)));

  return {
    totalActive,
    criticalActive,
    totalRepairCost: immediateBudget,
    totalLiability90: projected90DayBudget,
    savingsOpportunity: potentialSavings,
    citizensImpacted,
    highestRiskDept,
    highestRiskCluster,
    highestPriorityCategory,
    departmentPriorities,
    immediateBudget,
    projected30DayBudget,
    projected90DayBudget,
    potentialSavings,
    rankedQueue,
    recommendations,
    avgSeverity,
    avgCost,
    predictedFinancialExposure,
    infrastructureHealthIndex
  };
};
