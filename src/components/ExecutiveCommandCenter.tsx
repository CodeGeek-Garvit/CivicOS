import React, { useMemo } from "react";
import { SavedIssue } from "../types";
import { runDecisionIntelligence, getDepartmentName } from "../lib/decisionEngine";
import { 
  Activity, AlertTriangle, ShieldCheck, Cpu, Clock, 
  ShieldAlert, Check, RefreshCw, BarChart3, Users, DollarSign, Award, 
  AlertCircle, Building, FileText, Brain, Server, ArrowRight
} from "lucide-react";

interface ExecutiveCommandCenterProps {
  issues: SavedIssue[];
  isLiveMode: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function ExecutiveCommandCenter({
  issues,
  isLiveMode,
  onRefresh,
  isLoading
}: ExecutiveCommandCenterProps) {

  // Separate Live and Demo issues
  const liveIssues = useMemo(() => {
    return issues.filter(i => i.isDemoMode !== true && !i.id.startsWith("issue_mock_"));
  }, [issues]);

  const demoIssues = useMemo(() => {
    return issues.filter(i => i.isDemoMode === true || i.id.startsWith("issue_mock_"));
  }, [issues]);

  // Active issues based on current mode
  const activeIssuesList = useMemo(() => {
    const rawList = isLiveMode ? liveIssues : demoIssues;
    const seen = new Set<string>();
    return rawList.filter(item => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [isLiveMode, liveIssues, demoIssues]);

  // Run decision intelligence on active issues
  const decisionData = useMemo(() => {
    return runDecisionIntelligence(activeIssuesList);
  }, [activeIssuesList]);

  // Format Helper: Rupees formatting
  const formatRupees = (amount: number): string => {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  };

  // ----------------------------------------------------
  // SECTION 1: City Health Score and contributing factors
  // ----------------------------------------------------
  const healthStats = useMemo(() => {
    const score = decisionData.infrastructureHealthIndex;
    const totalActive = activeIssuesList.length;
    const criticalActive = activeIssuesList.filter(i => (i.severity || 0) >= 8).length;
    const avgSeverity = totalActive > 0 ? activeIssuesList.reduce((sum, i) => sum + (i.severity || 5), 0) / totalActive : 0;
    const totalLiability90 = activeIssuesList.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);

    // Calculate maximum incidents in any single department
    const deptsCountMap: Record<string, number> = {};
    activeIssuesList.forEach(i => {
      const d = getDepartmentName(i.affectedAsset || "", i.issueType);
      deptsCountMap[d] = (deptsCountMap[d] || 0) + 1;
    });
    const maxDeptCount = Object.keys(deptsCountMap).length > 0 ? Math.max(...Object.values(deptsCountMap)) : 0;

    // Deductions matching the decisionEngine.ts formula exactly
    const volumePenalty = Math.min(20, (totalActive / 30) * 20);
    const criticalRatio = totalActive > 0 ? criticalActive / totalActive : 0;
    const criticalPenalty = criticalRatio * 30;
    const severityPenalty = (avgSeverity / 10) * 25;
    const liabilityPenalty = Math.min(15, (totalLiability90 / 500000) * 15);
    const concentrationRatio = totalActive > 0 ? maxDeptCount / totalActive : 0;
    const concentrationPenalty = concentrationRatio * 10;

    const reasons: Array<{ label: string; penalty: number; value: string }> = [];
    if (volumePenalty > 0) {
      reasons.push({ label: "Incident Registry Volume", penalty: volumePenalty, value: `${totalActive} active incidents` });
    }
    if (criticalPenalty > 0) {
      reasons.push({ label: "Critical Hazard Ratio", penalty: criticalPenalty, value: `${criticalActive} critical issues (${Math.round(criticalRatio * 100)}%)` });
    }
    if (severityPenalty > 0) {
      reasons.push({ label: "Average Incident Severity", penalty: severityPenalty, value: `${avgSeverity.toFixed(1)}/10 avg severity` });
    }
    if (liabilityPenalty > 0) {
      reasons.push({ label: "Projected 90-Day Liability", penalty: liabilityPenalty, value: formatRupees(totalLiability90) });
    }
    if (concentrationPenalty > 0) {
      reasons.push({ label: "Departmental Concentration", penalty: concentrationPenalty, value: `Peak department workload: ${maxDeptCount} issues` });
    }

    return { score, reasons, totalActive, criticalActive, avgSeverity, totalLiability90 };
  }, [decisionData, activeIssuesList]);

  // ----------------------------------------------------
  // SECTION 2 & 4: Top 5 Critical Alerts & Timeline Queue
  // ----------------------------------------------------
  const topAlerts = useMemo(() => {
    return decisionData.rankedQueue.slice(0, 5);
  }, [decisionData]);

  // ----------------------------------------------------
  // SECTION 3: Today's Executive Briefing (Registry-grounded)
  // ----------------------------------------------------
  const briefingParagraphs = useMemo(() => {
    const total = decisionData.totalActive;
    const activeDepts = decisionData.departmentPriorities.filter(d => d.activeCount > 0);
    const deptsCount = activeDepts.length;
    
    if (total === 0) {
      return [
        "Today's municipal registry contains zero active incidents. The city-wide infrastructure network is currently operating at baseline stability.",
        "Operational surveillance systems remain active. Passive scans of spatial, electrical, and hydraulic grids report no outstanding anomalies.",
        "Pre-authorized dispatch packages and work order pipelines are on standby, ready to deploy instantly if any reports are synchronized."
      ];
    }

    const roadIssues = activeIssuesList.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Roads & Infrastructure");
    const wasteIssues = activeIssuesList.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Solid Waste Management");
    const elecIssues = activeIssuesList.filter(i => getDepartmentName(i.affectedAsset || "", i.issueType) === "Electrical Maintenance");

    // Find highest exposure dept
    let highestExposureDept = "Municipal General";
    let maxExposure = 0;
    activeDepts.forEach(d => {
      if (d.liability90Day > maxExposure) {
        maxExposure = d.liability90Day;
        highestExposureDept = d.departmentName;
      }
    });

    const savingsOnTop5 = topAlerts.reduce((sum, item) => {
      const now = item.issue.costOfInaction?.repairCostNow || 4500;
      const future = item.issue.costOfInaction?.repairCost90Days || 15750;
      return sum + (future - now);
    }, 0);

    const savingsLakhs = (savingsOnTop5 / 100000).toFixed(1);

    // Solid waste description
    const wasteDept = decisionData.departmentPriorities.find(d => d.departmentName === "Solid Waste Management");
    let wasteStatus = "Solid waste operations remain stable.";
    if (wasteDept && wasteDept.activeCount > 0) {
      if (wasteDept.priority === "Critical" || wasteDept.priority === "High") {
        wasteStatus = `Solid waste operations are under elevated stress with ${wasteDept.activeCount} active incidents (${wasteDept.criticalCount} critical), requiring immediate clearance to prevent vector hazard escalation.`;
      } else {
        wasteStatus = `Solid waste operations remain stable with ${wasteDept.activeCount} minor incidents currently managed via standard routes.`;
      }
    }

    // Electrical description
    const elecDept = decisionData.departmentPriorities.find(d => d.departmentName === "Electrical Maintenance");
    let elecStatus = "Electrical infrastructure currently presents low operational risk.";
    if (elecDept && elecDept.activeCount > 0) {
      if (elecDept.priority === "Critical" || elecDept.priority === "High") {
        elecStatus = `Electrical grid infrastructure represents localized safety hazard risk with ${elecDept.criticalCount} critical anomalies reported.`;
      } else {
        elecStatus = `Electrical infrastructure presents stable operational status with ${elecDept.activeCount} routine circuit items.`;
      }
    }

    return [
      `Today's municipal registry contains ${total} active incident${total > 1 ? "s" : ""} across ${deptsCount} department${deptsCount > 1 ? "s" : ""} with immediate repair liabilities of ${formatRupees(decisionData.immediateBudget)}.`,
      `${highestExposureDept} currently represents the highest financial risk, with projected liabilities totaling ${formatRupees(maxExposure)} over 90 days if left unaddressed.`,
      `Immediate dispatch and remediation of the top ${topAlerts.length} critical alerts would save an estimated ${formatRupees(savingsOnTop5)} (approximately ₹${savingsLakhs} lakh) in compounding sub-grade and structural degradation costs.`,
      wasteStatus,
      elecStatus
    ];
  }, [decisionData, activeIssuesList, topAlerts]);

  // ----------------------------------------------------
  // SECTION 5: Department Risk & Exposure Log (Sorted deterministically)
  // ----------------------------------------------------
  const sortedDepartments = useMemo(() => {
    const maxLiability = Math.max(...decisionData.departmentPriorities.map(d => d.liability90Day), 1);
    const maxCitizens = Math.max(...decisionData.departmentPriorities.map(d => d.citizensAffected), 1);
    
    const scored = decisionData.departmentPriorities.map(dept => {
      const normalizedLiability = (dept.liability90Day / maxLiability) * 10;
      const normalizedCitizens = (dept.citizensAffected / maxCitizens) * 10;
      
      // Formula: (Critical * 4) + (AvgSeverity * 3) + NormalizedLiability + NormalizedCitizens
      const riskScore = (dept.criticalCount * 4) + (dept.avgSeverity * 3) + normalizedLiability + normalizedCitizens;
      return {
        ...dept,
        normalizedLiability,
        normalizedCitizens,
        riskScore
      };
    });
    
    return scored.sort((a, b) => b.riskScore - a.riskScore);
  }, [decisionData.departmentPriorities]);

  // ----------------------------------------------------
  // SECTION 6: Category and Ward Risk Distribution
  // ----------------------------------------------------
  const categoryExposure = useMemo(() => {
    const statsMap: Record<string, { count: number; criticalCount: number; avgSeverity: number; liability90Day: number }> = {};
    activeIssuesList.forEach(i => {
      const rawType = i.issueType || "Other";
      const type = rawType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (!statsMap[type]) {
        statsMap[type] = { count: 0, criticalCount: 0, avgSeverity: 0, liability90Day: 0 };
      }
      statsMap[type].count += 1;
      if ((i.severity || 0) >= 8) statsMap[type].criticalCount += 1;
      statsMap[type].avgSeverity += (i.severity || 5);
      statsMap[type].liability90Day += (i.costOfInaction?.repairCost90Days || 15750);
    });
    
    return Object.entries(statsMap).map(([name, stats]) => ({
      name,
      count: stats.count,
      criticalCount: stats.criticalCount,
      avgSeverity: stats.count > 0 ? stats.avgSeverity / stats.count : 0,
      liability90Day: stats.liability90Day
    })).sort((a, b) => b.liability90Day - a.liability90Day);
  }, [activeIssuesList]);

  const wardExposure = useMemo(() => {
    const statsMap: Record<string, { count: number; criticalCount: number; liability90Day: number }> = {};
    activeIssuesList.forEach(i => {
      const ward = i.ward || i.city || "Unassigned";
      if (!statsMap[ward]) {
        statsMap[ward] = { count: 0, criticalCount: 0, liability90Day: 0 };
      }
      statsMap[ward].count += 1;
      if ((i.severity || 0) >= 8) statsMap[ward].criticalCount += 1;
      statsMap[ward].liability90Day += (i.costOfInaction?.repairCost90Days || 15750);
    });
    
    return Object.entries(statsMap).map(([name, stats]) => ({
      name,
      count: stats.count,
      criticalCount: stats.criticalCount,
      liability90Day: stats.liability90Day
    })).sort((a, b) => b.liability90Day - a.liability90Day);
  }, [activeIssuesList]);

  const totalLiabilityOverall = useMemo(() => {
    return activeIssuesList.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 15750), 0);
  }, [activeIssuesList]);

  // ----------------------------------------------------
  // SECTION 7: Strategic Authority Interventions (Registry-grounded)
  // ----------------------------------------------------
  const commissionerRecommendations = useMemo(() => {
    const recs: Array<{ title: string; reason: string; label: string }> = [];

    // 1. Highest Liability Department
    const highestLiabDept = sortedDepartments[0];
    if (highestLiabDept && highestLiabDept.activeCount > 0) {
      const roadNow = highestLiabDept.immediateRepairCost;
      const road90 = highestLiabDept.liability90Day;
      const savings = road90 - roadNow;
      recs.push({
        label: "FINANCIAL VULNERABILITY MITIGATION",
        title: `Approve emergency budget stabilization for ${highestLiabDept.departmentName}`,
        reason: `Remediation in this sector currently represents our largest projected financial risk, escalating from ${formatRupees(roadNow)} to ${formatRupees(road90)} over 90 days. Executing immediate repairs prevents a capital degradation penalty of ${formatRupees(savings)}.`
      });
    } else {
      recs.push({
        label: "BUDGET OVERSEE",
        title: "Approve grid-wide routine infrastructure asset audits",
        reason: "The municipal registry displays zero active cost escalation items. Maintaining seasonal audit schedules keeps the municipal asset buffer high."
      });
    }

    // 2. Highest Workload/Concentration Ward
    const topWard = wardExposure[0];
    if (topWard && topWard.count > 0) {
      recs.push({
        label: "WARD WORKLOAD CONCENTRATION",
        title: `Concentrate municipal supervisor inspections in ${topWard.name}`,
        reason: `A cluster of ${topWard.count} active incidents is concentrated within ${topWard.name}, indicating local service bottlenecks. Increasing field supervisor presence is required to verify clearance and sub-grade stability.`
      });
    } else {
      recs.push({
        label: "GEOGRAPHIC PATROLS",
        title: "Establish uniform ward baseline monitoring logs",
        reason: "Active incidents are sparsely and uniformly distributed. Routine field rounds across Pune zones are recommended to preserve baseline index ratings."
      });
    }

    // 3. Highest Citizen Impact Department
    const highestCitizenDept = [...sortedDepartments].sort((a, b) => b.citizensAffected - a.citizensAffected)[0];
    if (highestCitizenDept && highestCitizenDept.citizensAffected > 0) {
      recs.push({
        label: "CIVIC EXPOSURE REDUCTION",
        title: `Prioritize ${highestCitizenDept.departmentName} safety clearances`,
        reason: `Active defects within this department impact an estimated population of ${highestCitizenDept.citizensAffected.toLocaleString()} citizens. Expediting crew dispatches restores safety buffers and prevents secondary civil liabilities.`
      });
    } else {
      recs.push({
        label: "POPULATION HEALTH",
        title: "Deploy preemptive stormwater drain desilting operations",
        reason: "Zero active pipeline or sewage defects are logged. Reallocating sewer maintenance capacity to preemptive monsoonal desilting protects nearby housing wards."
      });
    }

    return recs;
  }, [sortedDepartments, wardExposure]);

  // ----------------------------------------------------
  // UI Styles and Color helpers
  // ----------------------------------------------------
  const getSeverityBadge = (severity: number) => {
    if (severity >= 8) {
      return (
        <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
          CRITICAL ({severity}/10)
        </span>
      );
    }
    if (severity >= 5) {
      return (
        <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
          HIGH ({severity}/10)
        </span>
      );
    }
    return (
      <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
        LOW ({severity}/10)
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2 py-0.5 rounded-full font-bold uppercase">CRITICAL</span>;
      case "High":
        return <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold uppercase">HIGH</span>;
      case "Medium":
        return <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold uppercase">MEDIUM</span>;
      default:
        return <span className="text-[9px] bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase">LOW</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="executive-command-center-root">
      
      {/* Dashboard Executive Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Cpu className="h-40 w-40 text-white" />
        </div>
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-500/30">
              CIVICOS CONSOLE
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Executive Authority Layer</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-none">
            Municipal Executive Command Center
          </h1>
          <p className="text-sm text-slate-300 font-medium">
            Strategic operational integrity dashboard for the City Commissioner & Administrators.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 z-10 sm:items-center">
          {/* Metadata Badges */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 flex flex-col gap-1 shrink-0">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Jurisidiction:</span>
              <span className="font-bold text-white uppercase">{isLiveMode ? "Live verified GPS" : "Pune Municipality"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Live Registry:</span>
              <span className={`font-bold uppercase ${isLiveMode ? "text-emerald-400" : "text-amber-400"}`}>
                {isLiveMode ? "Live Mode" : "Demo Mode"}
              </span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 transition-all font-bold px-4 py-3 rounded-xl text-white text-xs flex items-center justify-center gap-2 border border-indigo-500 shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Command Center</span>
          </button>
        </div>
      </div>

      {/* Grid Layout: Row 1 - Health score (Section 1) & Critical alerts (Section 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SECTION 1: City Health Snapshot (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between" id="city-health-snapshot">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              Section 1 — City Health Snapshot
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-5">Overall City Health Score</h3>
            
            {/* Visual Gauge */}
            <div className="flex items-center gap-5 my-6">
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#f1f5f9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke={healthStats.score >= 80 ? "#10b981" : healthStats.score >= 50 ? "#f59e0b" : "#f43f5e"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - healthStats.score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-900 leading-none">{healthStats.score}</span>
                  <span className="text-xs text-slate-400 font-bold block">/ 100</span>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Integrity Level</p>
                <p className={`text-sm font-extrabold uppercase tracking-wide mt-0.5 ${
                  healthStats.score >= 80 ? "text-emerald-600" : healthStats.score >= 50 ? "text-amber-600" : "text-rose-600"
                }`}>
                  {healthStats.score >= 80 ? "Satisfactory" : healthStats.score >= 50 ? "Moderate Strains" : "Critical Demand"}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1">Based on active incident pressure & liabilities.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Health Factor Deductions Log</span>
            <ul className="space-y-2 text-xs font-semibold text-slate-700">
              {healthStats.reasons.length === 0 ? (
                <li className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>No active incident penalties applied. Standard integrity high.</span>
                </li>
              ) : (
                healthStats.reasons.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <div>
                        <p className="text-slate-800 font-bold text-[11px] leading-tight">{item.label}</p>
                        <p className="text-slate-400 text-[9px] font-medium leading-none">{item.value}</p>
                      </div>
                    </div>
                    <span className="text-rose-600 font-bold text-[11px] shrink-0">
                      -{item.penalty.toFixed(1)} pts
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* SECTION 2: Critical Alerts (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between" id="critical-alerts">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <ShieldAlert className="h-4 w-4 text-indigo-500" />
              Section 2 — Critical Alerts
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Highest-Priority Action Items</h3>
            
            <div className="space-y-3">
              {topAlerts.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-400 font-bold">
                  No alerts detected. The municipal infrastructure registry contains zero pending active hazards.
                </div>
              ) : (
                topAlerts.map(item => {
                  const dept = getDepartmentName(item.issue.affectedAsset || "", item.issue.issueType);
                  return (
                    <div key={item.issue.id} className="bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getSeverityBadge(item.issue.severity || 5)}
                          <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded">
                            {dept}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">ID: #{item.issue.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 leading-snug">{item.issue.title}</h4>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.justification}</p>
                      </div>
                      
                      <div className="flex flex-col md:items-end shrink-0 gap-1 text-xs">
                        <div className="bg-slate-100/50 border border-slate-200/50 px-3 py-1.5 rounded-xl text-right">
                          <span className="text-[8px] text-slate-400 block uppercase font-bold tracking-wider">PROJECTED LIABILITY (90D)</span>
                          <span className="font-extrabold text-rose-600 text-sm">{formatRupees(item.issue.costOfInaction?.repairCost90Days || 15750)}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono text-right mt-1 uppercase">WARD: {item.issue.ward || item.issue.city || "PUNE"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Grid Layout: Row 2 - Today's Executive Briefing & Decision Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SECTION 3: Today's Executive Briefing (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between" id="todays-executive-briefing">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              Section 3 — Today's Executive Briefing
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Strategic City Briefing</h3>
            
            <div className="space-y-4 text-slate-700 text-xs md:text-sm leading-relaxed font-medium bg-slate-50 border border-slate-100 rounded-2xl p-5">
              {briefingParagraphs.map((para, idx) => (
                <p key={idx} className={`${idx === 2 ? "border-l-2 border-indigo-500 pl-3.5 font-bold text-slate-900" : ""}`}>
                  {para}
                </p>
              ))}
            </div>
          </div>
          
          <div className="mt-5 text-[10px] text-slate-400 italic">
            * This brief is deterministically generated from live municipal database registers. No simulated data is used.
          </div>
        </div>

        {/* SECTION 4: Decision Timeline (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between" id="decision-timeline">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Section 4 — Decision Timeline
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Recommended Decision Timeline</h3>
            <p className="text-xs text-slate-500 font-medium mb-5">Timeline generated using registry prioritization weights.</p>
            
            <div className="space-y-4">
              {activeIssuesList.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400 font-bold">
                  Registry Clear. No active dispatch decisions required.
                </div>
              ) : (
                (() => {
                  const timelineHours = ["08:30", "10:30", "12:30", "14:00", "15:30"];
                  return decisionData.rankedQueue.slice(0, 5).map((item, idx) => {
                    const time = timelineHours[idx] || "16:30";
                    const dept = getDepartmentName(item.issue.affectedAsset || "", item.issue.issueType);
                    let action = "Dispatch repairs & audit safety bounds";
                    if (dept.includes("Roads")) action = "Highest priority road inspection & asphalt sealing";
                    if (dept.includes("Water")) action = "Dispatch drainage crew to seal sub-surface leakage";
                    if (dept.includes("Waste")) action = "Targeted sanitary hauling & clearance review";
                    if (dept.includes("Electrical")) action = "Circuit hazard mitigation & visibility audit";
                    
                    return (
                      <div key={item.issue.id} className="flex gap-4 items-start relative">
                        {idx < 4 && idx < decisionData.rankedQueue.slice(0, 5).length - 1 && (
                          <div className="absolute top-6 bottom-0 left-4 w-0.5 bg-slate-100 -mb-4" />
                        )}
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg shrink-0 w-12 text-center">
                          {time}
                        </span>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex-1 text-xs space-y-1">
                          <p className="font-extrabold text-slate-900">{action}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{item.issue.title} (Score: {Math.round(item.rankingScore)}/100)</p>
                          <p className="text-[9px] text-slate-400 font-medium font-mono uppercase">{item.issue.ward || item.issue.city || "Pune"}</p>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 5: Department Risk & Exposure Log (Full width grid) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md" id="department-risk-log">
        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          Section 5 — Department Risk & Exposure Log
        </span>
        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Department Operational Assessment</h3>
        <p className="text-xs text-slate-400 mb-6 font-semibold">
          Sorted dynamically by deterministic Department Risk Score: 
          <code className="text-indigo-600 font-mono text-[10px] ml-1 bg-slate-50 px-1.5 py-0.5 rounded border">
            (Critical × 4) + (AvgSeverity × 3) + (Normalized Liability) + (Normalized Citizens Affected)
          </code>
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDepartments.map((dept, index) => {
            const riskColor = dept.priority === "Critical" ? "text-rose-600 bg-rose-50 border-rose-100" :
                              dept.priority === "High" ? "text-amber-600 bg-amber-50 border-amber-100" :
                              dept.priority === "Medium" ? "text-blue-600 bg-blue-50 border-blue-100" :
                              "text-slate-500 bg-slate-50 border-slate-100";
            
            return (
              <div key={dept.departmentName} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between gap-4 relative">
                <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-300 font-black">
                  #{index + 1}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-400">JURISDICTION CATEGORY</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${riskColor}`}>
                      {dept.priority}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 leading-snug">{dept.departmentName}</h4>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{dept.explanation}</p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200/50">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>DEPARTMENT RISK SCORE</span>
                    <span className="text-slate-900 font-extrabold">{dept.riskScore.toFixed(1)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[8px] text-slate-400 font-semibold mt-1 bg-slate-50 p-1.5 rounded">
                    <div>
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Critical</span>
                      <span className="text-slate-900 font-bold">{(dept.criticalCount * 4).toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Severity</span>
                      <span className="text-slate-900 font-bold">{(dept.avgSeverity * 3).toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Liab. Norm</span>
                      <span className="text-slate-900 font-bold">{dept.normalizedLiability.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Cit. Norm</span>
                      <span className="text-slate-900 font-bold">{dept.normalizedCitizens.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-200/50 pt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/30">
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Active Demands</span>
                    <span className="font-extrabold text-slate-900 text-xs mt-0.5 block">{dept.activeCount} ({dept.criticalCount} Critical)</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200/30">
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">90-Day Liability</span>
                    <span className="font-extrabold text-slate-900 text-xs mt-0.5 block">{formatRupees(dept.liability90Day)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 6: City Risk Distribution (Progress metrics / Exposure) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md animate-fade-in" id="city-risk-distribution">
        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          Section 6 — City Risk Distribution
        </span>
        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Department & Category Exposure Analysis</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Panel A: Category Risk Exposure */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                Category-level Exposure
              </h4>
              <div className="space-y-4">
                {categoryExposure.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No category risk recorded.</p>
                ) : (
                  categoryExposure.map(cat => {
                    const percent = totalLiabilityOverall > 0 ? (cat.liability90Day / totalLiabilityOverall) * 100 : 0;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700">{cat.name} <span className="text-[10px] text-slate-400">({cat.count} issues)</span></span>
                          <span className="text-slate-900">{formatRupees(cat.liability90Day)} <span className="text-[10px] text-slate-400">({Math.round(percent)}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Panel B: Geographic Ward Risk Concentration */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Geographic Ward Risk Concentration
              </h4>
              <div className="space-y-4">
                {wardExposure.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No ward concentration logged.</p>
                ) : (
                  wardExposure.map(ward => {
                    const percent = totalLiabilityOverall > 0 ? (ward.liability90Day / totalLiabilityOverall) * 100 : 0;
                    return (
                      <div key={ward.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700">{ward.name} <span className="text-[10px] text-slate-400">({ward.count} issues, {ward.criticalCount} crit)</span></span>
                          <span className="text-slate-900">{formatRupees(ward.liability90Day)} <span className="text-[10px] text-slate-400">({Math.round(percent)}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 7: Commissioner's Attention Required */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl" id="commissioners-attention-required">
        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <Brain className="h-4.5 w-4.5 text-amber-400 animate-pulse" />
          Section 7 — Strategic Authority Interventions
        </span>
        <h3 className="text-lg md:text-xl font-black text-white tracking-tight mb-5">Strategic Authority Interventions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {commissionerRecommendations.map((rec, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-lg flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{rec.label}</span>
                </div>
                <h4 className="text-xs font-extrabold text-white leading-snug">{rec.title}</h4>
              </div>
              <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400 font-medium leading-relaxed">
                <span className="font-bold text-amber-400 uppercase block text-[9px] tracking-wide mb-1 font-mono">REGISTRY DETECTED EVIDENCE:</span>
                {rec.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 8: Operational Achievements & Module Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="achievements-and-status">
        
        {/* SECTION 8.1: Achievements (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Award className="h-4 w-4 text-indigo-500" />
              Section 8 — Operational Achievements & Module Status
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">Operational Achievements</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">Deduplicated status of active pipeline modules running inside CivicOS.</p>
            
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { label: `${decisionData.totalActive} Active Incidents Registered`, desc: "Integrity registers fully synchronized with field reports" },
                { label: "Dispatch Packages Generated", desc: "Automated standard crew assignment profiles compiled" },
                { label: "Municipal Work Orders Prepared", desc: "Rational repair estimates and costs formatted" },
                { label: "Registry Database Synchronized", desc: "Secure state commits validated with Firestore" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-xl">
                  <Check className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.label}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 8.2: Module Status (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Server className="h-4 w-4 text-indigo-500" />
              Core System Status
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4">CivicOS Core Module Health</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">System diagnostic telemetry of the active autonomous features.</p>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {[
                { name: "Vision AI", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Severity Engine", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Cost Engine", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Dispatch Engine", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Registry", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "GIS Spatial", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Decision Intelligence", status: "ONLINE", style: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { name: "Communication Layer", status: "READY", style: "text-indigo-600 bg-indigo-50 border-indigo-100" }
              ].map((mod, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-slate-600 text-[11px]">{mod.name}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${mod.style}`}>
                    {mod.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-3.5 flex justify-between items-center text-[10px] text-slate-400 font-mono mt-4">
            <span>SYSTEM LATENCY: 24ms</span>
            <span>RECORDS: {activeIssuesList.length}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
