import React, { useState } from "react";
import { 
  TrendingUp, DollarSign, Users, AlertTriangle, ShieldCheck, 
  ChevronRight, ArrowUpRight, Cpu, Clock, Activity, BarChart3, Wrench, Shield, Zap, AlertOctagon,
  Percent, Droplets, MapPin, ClipboardList, Trash2, HelpCircle, Brain, Layers, Coins, Scale
} from "lucide-react";
import { SavedIssue } from "../types";
import { DecisionEngineResult, RankedIssueItem, getDepartmentName } from "../lib/decisionEngine";

interface OpsAdvisorPanelProps {
  decisionData: DecisionEngineResult;
  onSelectIssue: (issue: SavedIssue) => void;
  map: google.maps.Map | null;
}

export default function OpsAdvisorPanel({
  decisionData,
  onSelectIssue,
  map
}: OpsAdvisorPanelProps) {
  const [activeTabSection, setActiveTabSection] = useState<"summary" | "allocation" | "budget" | "queue" | "kpi">("summary");

  const formatRupees = (amount: number): string => {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  };

  const getDeptType = (deptName: string) => {
    if (deptName.includes("Road")) return "road";
    if (deptName.includes("Water")) return "water";
    if (deptName.includes("Waste")) return "waste";
    if (deptName.includes("Electrical")) return "electrical";
    if (deptName.includes("Urban")) return "urban";
    return "general";
  };

  // Helper for recommendation type icon
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case "road":
        return <Activity className="h-4 w-4 text-emerald-500" />;
      case "water":
        return <Droplets className="h-4 w-4 text-blue-500" />;
      case "waste":
        return <Trash2 className="h-4 w-4 text-amber-500" />;
      case "electrical":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case "urban":
        return <Wrench className="h-4 w-4 text-purple-500" />;
      default:
        return <Shield className="h-4 w-4 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-5" id="ops-advisor-panel-root">
      
      {/* Header Advisor Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-3.5 relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
            <Cpu className="h-3 w-3 animate-pulse" />
            Executive Advisory Core
          </span>
          <span className="text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping"></span>
            Deterministic Intelligence
          </span>
        </div>
        
        <div className="space-y-1 relative z-10">
          <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            AI Chief Operations Officer
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Dynamic strategic advisor translating physical hazards, costs, and liability growth directly into actionable executive decisions for the Municipal Commissioner.
          </p>
        </div>

        {/* Diagnostic Health Indicator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between relative z-10 text-xs">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-rose-500" />
            <div>
              <p className="font-bold text-slate-200">Critical Infrastructure Index</p>
              <p className="text-[10px] text-slate-500 font-mono">Registry Diagnostic Rating</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-rose-400">{decisionData.infrastructureHealthIndex}</span>
            <span className="text-[10px] text-slate-600 font-bold font-mono"> / 100</span>
          </div>
        </div>
      </div>

      {/* Mini Segmented Navigation for Advisor Areas */}
      <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
        <button
          onClick={() => setActiveTabSection("summary")}
          className={`py-1.5 px-1 rounded-lg transition-all text-center ${
            activeTabSection === "summary" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTabSection("allocation")}
          className={`py-1.5 px-1 rounded-lg transition-all text-center ${
            activeTabSection === "allocation" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Matrix
        </button>
        <button
          onClick={() => setActiveTabSection("budget")}
          className={`py-1.5 px-1 rounded-lg transition-all text-center ${
            activeTabSection === "budget" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Budget
        </button>
        <button
          onClick={() => setActiveTabSection("queue")}
          className={`py-1.5 px-1 rounded-lg transition-all text-center ${
            activeTabSection === "queue" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Queue
        </button>
        <button
          onClick={() => setActiveTabSection("kpi")}
          className={`py-1.5 px-1 rounded-lg transition-all text-center ${
            activeTabSection === "kpi" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Briefing
        </button>
      </div>

      {/* VIEW PANEL ROUTING */}

      {/* SECTION 1: Municipal Executive Summary */}
      {activeTabSection === "summary" && (
        <div className="space-y-4 animate-fadeIn" id="sec-executive-summary">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            SECTION 1: MUNICIPAL EXECUTIVE SUMMARY
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Active Incidents
              </span>
              <h5 className="text-xl font-black text-slate-900">{decisionData.totalActive}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Currently tracked in system</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5 text-red-600 animate-bounce" /> Critical Hazard
              </span>
              <h5 className="text-xl font-black text-red-600">{decisionData.criticalActive}</h5>
              <p className="text-[9px] text-rose-500 font-bold">Severity level ≥ 8/10</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-slate-500" /> Active Repair Cost
              </span>
              <h5 className="text-base font-black text-slate-900">{formatRupees(decisionData.totalRepairCost)}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Immediate capital outlay</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> 90D Liability
              </span>
              <h5 className="text-base font-black text-indigo-600">{formatRupees(decisionData.totalLiability90)}</h5>
              <p className="text-[9px] text-indigo-500 font-bold">Projected cost of inaction</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1 col-span-2">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-blue-500" /> Estimated Impacted Citizens
              </span>
              <h5 className="text-lg font-black text-slate-900">{decisionData.citizensImpacted.toLocaleString()}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Sum of localized population coordinates affected</p>
            </div>
          </div>

          {/* Qualitative Risk Vectors */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
              OPERATIONAL RISK VECTORS
            </span>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Highest Risk Sector:</span>
                <span className="font-extrabold text-slate-800 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[10px]">
                  {decisionData.highestRiskDept}
                </span>
              </div>
              <div className="flex justify-between items-start pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium pt-0.5">Primary Cluster Risk:</span>
                <span className="font-extrabold text-right text-indigo-900 max-w-[180px] leading-tight text-[10px]">
                  {decisionData.highestRiskCluster}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Top Priority Hazard:</span>
                <span className="font-mono font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase">
                  {decisionData.highestPriorityCategory}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: Municipal Executive Recommendations */}
          <div className="space-y-3 pt-1">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              SECTION 5: STRATEGIC ACTION RECOMMENDATIONS
            </h5>
            <div className="space-y-2">
              {decisionData.recommendations.map(rec => (
                <div key={rec.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1.5 flex items-start gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 mt-0.5 shrink-0">
                    {getRecommendationIcon(rec.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h6 className="font-extrabold text-slate-800 text-[11px] leading-tight">
                        {rec.title}
                      </h6>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        rec.impactLevel === "CRITICAL" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                        rec.impactLevel === "HIGH" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                        "bg-blue-100 text-blue-700 border border-blue-200"
                      }`}>
                        {rec.impactLevel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      {rec.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Department Priority Matrix */}
      {activeTabSection === "allocation" && (
        <div className="space-y-4 animate-fadeIn" id="sec-department-priority-matrix">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              SECTION 2: DEPARTMENT PRIORITY MATRIX
            </h4>
            <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 border border-indigo-100 rounded-full uppercase tracking-wider font-mono">
              Deterministic Rating
            </span>
          </div>

          <div className="space-y-4">
            {decisionData.departmentPriorities.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block font-mono">DEPARTMENT SECTOR</span>
                    <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      {getRecommendationIcon(getDeptType(item.departmentName))}
                      {item.departmentName}
                    </h5>
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-mono ${
                    item.priority === "Critical" ? "bg-rose-100 text-rose-700 border-rose-200" :
                    item.priority === "High" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    item.priority === "Medium" ? "bg-blue-100 text-blue-700 border-blue-200" :
                    "bg-slate-100 text-slate-500 border-slate-200"
                  }`}>
                    {item.priority}
                  </span>
                </div>

                {/* Sub-stats Grid */}
                {item.activeCount > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100 p-2 rounded-lg text-center">
                      <div>
                        <p className="text-[8px] text-slate-400 font-extrabold font-mono">ACTIVE</p>
                        <p className="text-xs font-black text-slate-800">{item.activeCount}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-rose-400 font-extrabold font-mono">CRITICAL</p>
                        <p className="text-xs font-black text-rose-600">{item.criticalCount}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-400 font-extrabold font-mono">AVG SEVERITY</p>
                        <p className="text-xs font-black text-slate-800">{(item.avgSeverity).toFixed(1)}/10</p>
                      </div>
                    </div>

                    {/* Cost rows */}
                    <div className="space-y-1.5 text-[10px] text-slate-600 font-medium font-sans">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                        <span>Estimated Impacted Citizens:</span>
                        <span className="font-bold text-slate-800">{item.citizensAffected.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                        <span>Immediate Repair Outlay:</span>
                        <span className="font-bold text-slate-800">{formatRupees(item.immediateRepairCost)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>90-Day Projected Liability:</span>
                        <span className="font-bold text-indigo-600">{formatRupees(item.liability90Day)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-medium italic">No active reports registered.</p>
                  </div>
                )}

                {/* Explanation block */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5 font-mono">EXECUTIVE BRIEFING</span>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    {item.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Budget Optimization Engine */}
      {activeTabSection === "budget" && (
        <div className="space-y-4 animate-fadeIn" id="sec-budget-optimization">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            SECTION 3: BUDGET OPTIMIZATION ENGINE
          </h4>

          {/* Main Saving Summary Banner */}
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 border border-indigo-800 text-white rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign className="h-20 w-20" />
            </div>
            
            <div className="space-y-0.5 relative z-10">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block font-mono">POTENTIAL OPERATIONAL SAVINGS</span>
              <h4 className="text-3xl font-black tracking-tight text-white">
                {formatRupees(decisionData.potentialSavings)}
              </h4>
              <p className="text-[10px] text-indigo-200/80 font-medium leading-normal">
                Determined directly by multiplying standard deterioration ratios against registered incident counts and executing early interventions today.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-800 relative z-10">
              <div>
                <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block font-mono">Spend Today</span>
                <p className="text-sm font-extrabold text-indigo-50">{formatRupees(decisionData.immediateBudget)}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block font-mono">Avoid Future Liability</span>
                <p className="text-sm font-extrabold text-rose-300">{formatRupees(decisionData.projected90DayBudget)}</p>
              </div>
            </div>
          </div>

          {/* Budget Projections Timelines */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              PROJECTED LIABILITIES CHRONOLOGY
            </span>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800">Immediate Repairs</p>
                  <p className="text-[9px] text-slate-400">Exact sum of active asset repairs</p>
                </div>
                <span className="font-mono font-extrabold text-slate-900 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                  {formatRupees(decisionData.immediateBudget)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 pt-1.5 border-t border-b border-slate-100">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800">30-Day Escalate projection</p>
                  <p className="text-[9px] text-slate-400">If deferred (moisture decay factor)</p>
                </div>
                <span className="font-mono font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded">
                  {formatRupees(decisionData.projected30DayBudget)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800">90-Day Escalate projection</p>
                  <p className="text-[9px] text-slate-400">Final degradation + civic liability cost</p>
                </div>
                <span className="font-mono font-extrabold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                  {formatRupees(decisionData.projected90DayBudget)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic text-center font-medium font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
            Calculated strictly from live active report records.
          </p>
        </div>
      )}

      {/* SECTION 4: Priority Action Queue */}
      {activeTabSection === "queue" && (
        <div className="space-y-4 animate-fadeIn" id="sec-priority-queue">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              SECTION 4: PRIORITY ACTION QUEUE
            </h4>
            <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              RANKED INCIDENTS
            </span>
          </div>

          <div className="space-y-4">
            {decisionData.rankedQueue.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs text-slate-400 font-medium">No issues in registry to rank.</p>
              </div>
            ) : (
              decisionData.rankedQueue.slice(0, 5).map((item, index) => {
                const issue = item.issue;
                return (
                  <div key={issue.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                    {/* Rank Badge Indicator */}
                    <div className="absolute top-0 right-0 bg-slate-900 text-white font-black text-[10px] px-3 py-1 rounded-bl-xl border-l border-b border-slate-800">
                      RANK #{index + 1}
                    </div>

                    <div className="space-y-1 pr-16">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
                          #{issue.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded">
                          {issue.ward || issue.city || (issue.location && issue.location.latitude && issue.location.latitude > 22 ? "Jaipur" : "Pune Center")}
                        </span>
                      </div>
                      <h5 className="font-extrabold text-slate-900 text-xs leading-snug">
                        {issue.title || "Municipal Hazard"}
                      </h5>
                    </div>

                    {/* Technical Metric Scores row */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-1 text-center">
                        <p className="text-[7px] text-slate-400 font-extrabold font-mono">SEVERITY</p>
                        <p className="text-[11px] font-black text-rose-600">{issue.severity}/10</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-1 text-center">
                        <p className="text-[7px] text-slate-400 font-extrabold font-mono">IMPACTED</p>
                        <p className="text-[11px] font-black text-slate-700">
                          {issue.costOfInaction?.estimatedCitizensAffected || 150}
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-1 text-center col-span-2">
                        <p className="text-[7px] text-slate-400 font-extrabold font-mono">90D ESCALATION</p>
                        <p className="text-[11px] font-black text-indigo-600">
                          {formatRupees(issue.costOfInaction?.repairCost90Days || 15750)}
                        </p>
                      </div>
                    </div>

                    {/* Factor-Based Justification breakdown */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">DETERMINISTIC RANKING FACTORS</span>
                      
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px] font-mono font-medium text-slate-500">
                        <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                          <span>Severity (40%):</span>
                          <span className="font-bold text-slate-700">{(issue.severity || 5).toFixed(1)}/10</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                          <span>Population (20%):</span>
                          <span className="font-bold text-slate-700">{(issue.costOfInaction?.estimatedCitizensAffected || 150).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-0.5 col-span-2">
                          <span>90D Liability Growth (20%):</span>
                          <span className="font-bold text-slate-700">
                            {formatRupees((issue.costOfInaction?.repairCost90Days || 15750) - (issue.costOfInaction?.repairCostNow || 4500))} gap
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                          <span>Dispatch Priority (10%):</span>
                          <span className="font-bold text-slate-700">{issue.dispatch?.priorityLevel || "Medium"}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                          <span>Dept Workload (10%):</span>
                          <span className="font-bold text-slate-700">
                            {decisionData.rankedQueue.filter(q => getDepartmentName(q.issue.affectedAsset || "", q.issue.issueType) === getDepartmentName(issue.affectedAsset || "", issue.issueType)).length} active
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-600 font-medium leading-relaxed font-sans border-t border-slate-200/40 pt-1.5">
                        {item.justification}
                      </p>
                    </div>

                    {/* Map Interaction Center Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          onSelectIssue(issue);
                          if (map && issue.location && issue.location.latitude != null && issue.location.longitude != null) {
                            map.setCenter({ lat: issue.location.latitude, lng: issue.location.longitude });
                            map.setZoom(16);
                          }
                        }}
                        className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black px-2.5 py-1 rounded-lg border border-indigo-100 transition-all flex items-center gap-1 uppercase"
                      >
                        <MapPin className="h-3 w-3" /> Center on Map
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: Operational KPI Briefing */}
      {activeTabSection === "kpi" && (
        <div className="space-y-4 animate-fadeIn" id="sec-operational-kpi">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            SECTION 6: COMMISSIONER EXECUTIVE BRIEFING
          </h4>

          {/* 9 Bento Grid KPIs */}
          <div className="grid grid-cols-2 gap-3">
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Total Active Incidents
              </span>
              <h5 className="text-lg font-black text-slate-900">{decisionData.totalActive}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Currently in live registry</p>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-rose-500 font-extrabold uppercase tracking-wider font-mono block">
                Critical Hazards
              </span>
              <h5 className="text-lg font-black text-rose-600">{decisionData.criticalActive}</h5>
              <p className="text-[9px] text-rose-400 font-bold">Severity level ≥ 8/10</p>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Average Severity
              </span>
              <h5 className="text-lg font-black text-slate-900">{decisionData.avgSeverity.toFixed(1)} / 10</h5>
              <p className="text-[9px] text-slate-400 font-medium">Mean registry criticality</p>
            </div>

            {/* KPI 4 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-indigo-500 font-extrabold uppercase tracking-wider font-mono block">
                Impacted Population
              </span>
              <h5 className="text-lg font-black text-indigo-600">{decisionData.citizensImpacted.toLocaleString()}</h5>
              <p className="text-[9px] text-indigo-400 font-medium">Estimated exposed citizens</p>
            </div>

            {/* KPI 5 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Immediate Repair Outlay
              </span>
              <h5 className="text-[13px] font-black text-slate-900">{formatRupees(decisionData.totalRepairCost)}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Required initial capital outlay</p>
            </div>

            {/* KPI 6 */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                90D Exposure Liability
              </span>
              <h5 className="text-[13px] font-black text-indigo-600">{formatRupees(decisionData.totalLiability90)}</h5>
              <p className="text-[9px] text-indigo-400 font-medium">Compound inaction liabilities</p>
            </div>

            {/* KPI 7 (Full width) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1 col-span-2">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Highest Risk Department Sector
              </span>
              <h5 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-rose-500" />
                {decisionData.highestRiskDept}
              </h5>
              <p className="text-[9px] text-slate-400 font-medium">Calculated from total counts & severe localized risk indexes</p>
            </div>

            {/* KPI 8 (Full width) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1 col-span-2">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Highest Risk Incident Category
              </span>
              <h5 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-amber-500" />
                {decisionData.highestPriorityCategory}
              </h5>
              <p className="text-[9px] text-slate-400 font-medium">Sector showing fastest compounding deterioration factor</p>
            </div>

            {/* KPI 9 (Full width) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1 col-span-2">
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider font-mono block">
                Highest Priority Hotspot Cluster
              </span>
              <h5 className="text-[11px] font-black text-indigo-900 leading-tight">
                {decisionData.highestRiskCluster}
              </h5>
              <p className="text-[9px] text-slate-400 font-medium">Spatially derived density anomaly from active logs</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic text-center font-medium font-mono pt-1">
            This briefing is generated in real-time and remains completely grounded in registered incidents.
          </p>
        </div>
      )}

    </div>
  );
}
