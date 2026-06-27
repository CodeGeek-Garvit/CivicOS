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

  const departmentPriorities: DepartmentPriorityItem[] = departmentsList.map(deptName => {
    const deptIssues = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === deptName);
    const activeCount = deptIssues.length;
    const criticalCount = deptIssues.filter(i => (i.severity || 0) >= 8).length;
    const totalSeverity = deptIssues.reduce((sum, curr) => sum + (curr.severity || 5), 0);
    const avgSeverity = activeCount > 0 ? totalSeverity / activeCount : 0;
    const citizensAffected = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.estimatedCitizensAffected || 150), 0);
    const immediateRepairCost = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.repairCostNow || 4500), 0);
    const liability90Day = deptIssues.reduce((sum, curr) => sum + (curr.costOfInaction?.repairCost90Days || 15750), 0);
    const costGap = liability90Day - immediateRepairCost;

    // Deterministic priority score calculation
    // Base priority is Low. We upgrade based on critical incidents, average severity, citizens affected, and financial escalation.
    let priority: "Critical" | "High" | "Medium" | "Low" = "Low";
    let explanation = "";

    if (activeCount === 0) {
      priority = "Low";
      explanation = "No active incidents registered for this sector. Asset registers display baseline stability.";
    } else {
      const priorityScore = (avgSeverity * 8) + (criticalCount * 20) + (activeCount * 4) + (citizensAffected / 100) + (costGap / 10000);
      
      if (priorityScore >= 80 || criticalCount >= 2 || avgSeverity >= 8) {
        priority = "Critical";
      } else if (priorityScore >= 40 || criticalCount >= 1 || avgSeverity >= 6) {
        priority = "High";
      } else if (priorityScore >= 15) {
        priority = "Medium";
      } else {
        priority = "Low";
      }

      const urgencyAdjective = priority === "Critical" ? "immediate emergency intervention" :
                               priority === "High" ? "high-priority coordination" :
                               priority === "Medium" ? "scheduled maintenance dispatch" : "routine observation";

      explanation = `${deptName} requires ${urgencyAdjective} to address ${activeCount} active incident${activeCount > 1 ? "s" : ""} (${criticalCount} critical). Delayed remediation risks a structural deterioration gap of ${formatRupees(costGap)} within 90 days, impacting an estimated population of ${citizensAffected.toLocaleString()} citizens.`;
    }

    return {
      departmentName: deptName,
      activeCount,
      criticalCount,
      avgSeverity,
      citizensAffected,
      immediateRepairCost,
      liability90Day,
      priority,
      explanation
    };
  });

  // Calculate highest risk department based on active incidents + severity weighting
  let highestRiskDept = "None";
  let maxRiskScore = -1;
  departmentPriorities.forEach(d => {
    if (d.activeCount > 0) {
      const riskScore = (d.activeCount * 5) + (d.criticalCount * 15) + (d.avgSeverity * 10);
      if (riskScore > maxRiskScore) {
        maxRiskScore = riskScore;
        highestRiskDept = d.departmentName;
      }
    }
  });

  // 4. Geographic Hotspot Cluster Risk Identification
  const hotspots: Array<{
    name: string;
    count: number;
    riskScore: number;
    avgSeverity: number;
  }> = [];

  const visited = new Set<string>();
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
  });

  hotspots.sort((a, b) => b.riskScore - a.riskScore);
  const highestRiskCluster = hotspots[0]?.name || "No high-density incident hotspot clusters detected.";

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
  const rankedQueue: RankedIssueItem[] = list.map(issue => {
    const sev = issue.severity || 5;
    const citizens = issue.costOfInaction?.estimatedCitizensAffected || 150;
    const costNow = issue.costOfInaction?.repairCostNow || 4500;
    const cost90 = issue.costOfInaction?.repairCost90Days || 15750;
    const costRatio = costNow > 0 ? cost90 / costNow : 3.5;
    const costGap = cost90 - costNow;

    let dispatchPriorityScore = 50;
    let dispatchLabel = "Medium";
    if (issue.dispatch?.priorityLevel) {
      const level = String(issue.dispatch.priorityLevel).toUpperCase();
      dispatchLabel = issue.dispatch.priorityLevel;
      if (level === "CRITICAL") dispatchPriorityScore = 100;
      else if (level === "HIGH") dispatchPriorityScore = 80;
      else if (level === "MEDIUM") dispatchPriorityScore = 50;
      else if (level === "LOW") dispatchPriorityScore = 30;
    } else if (sev >= 8) {
      dispatchPriorityScore = 90;
      dispatchLabel = "High (Auto)";
    }

    const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
    const deptIssuesCount = list.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === dept).length;
    const deptUrgencyScore = Math.min(100, deptIssuesCount * 15);

    const severityScore = sev * 10; // 0 to 100
    const populationScore = Math.min(100, (citizens / 1200) * 100);
    const escalationScore = Math.min(100, (costRatio / 5) * 100);

    // Multi-factor formula with exact weights
    const rankingScore = (severityScore * 0.40) + (populationScore * 0.20) + (escalationScore * 0.20) + (dispatchPriorityScore * 0.10) + (deptUrgencyScore * 0.10);

    const justification = `Ranked with score of ${Math.round(rankingScore)}/100 derived from: Severity of ${sev}/10 (40% weight), Population Impact of ${citizens} citizens (20% weight), 90-day Cost Escalation of ${costRatio.toFixed(1)}x (20% weight), Dispatch Priority [${dispatchLabel}] (10% weight), and Department Workload of ${deptIssuesCount} active issues (10% weight).`;

    return {
      issue,
      rankingScore,
      justification,
      factors: {
        severityScore,
        populationScore,
        escalationScore,
        dispatchScore: dispatchPriorityScore,
        deptUrgencyScore
      }
    };
  });

  rankedQueue.sort((a, b) => b.rankingScore - a.rankingScore);

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

  // Calculate infrastructure health index using our existing deterministic penalty formula
  const densityPenalty = totalActive * 2.5;
  const severityPenalty = avgSeverity * 3.5;
  const hazardPenalty = criticalActive * 4.0;
  const activeDepts = departmentPriorities.filter(d => d.activeCount > 0).length;
  const diversityPenalty = activeDepts > 0 ? (5 - activeDepts) * 2.0 : 10;
  
  const totalPenalty = densityPenalty + severityPenalty + hazardPenalty + Math.max(0, diversityPenalty);
  const infrastructureHealthIndex = Math.max(15, Math.min(100, Math.round(100 - totalPenalty)));

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
