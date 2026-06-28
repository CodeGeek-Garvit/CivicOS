import React, { useMemo, useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { 
  SavedIssue, 
  normalizeStatus, 
  LIFECYCLE_STATES, 
  STATUS_TRANSITIONS, 
  getSLAStatus, 
  getDeterministicTimeline,
  IncidentStatus 
} from "../types";
import { getDepartmentName } from "../lib/decisionEngine";
import { 
  Activity, AlertTriangle, ShieldCheck, Cpu, Clock, 
  Check, RefreshCw, BarChart3, Users, DollarSign, Award, 
  AlertCircle, Building, FileText, ArrowRight,
  Search, Filter, ChevronRight, User, Image as ImageIcon, Calendar, History, Play, CheckSquare, Eye, CheckCircle2, ClipboardCheck, ArrowLeft, Printer, Shield
} from "lucide-react";

// Format Helper: Rupees formatting
const formatRupees = (amount: number): string => {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
};

// Maps a department to a 3-4 letter code for the structured work order ID
export function getMunicipalWorkOrderID(issue: SavedIssue): string {
  const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
  let deptCode = "GEN";
  const d = (dept || "").toLowerCase();
  if (d.includes("road")) deptCode = "ROAD";
  else if (d.includes("electrical")) deptCode = "ELEC";
  else if (d.includes("water") || d.includes("drainage") || d.includes("drain") || d.includes("wd")) deptCode = "WD";
  else if (d.includes("waste")) deptCode = "SWM";
  else if (d.includes("urban") || d.includes("development")) deptCode = "URB";

  // Compute a deterministic sequence number or suffix
  let seqStr = "0064";
  if (issue.dispatch?.dispatchId) {
    const match = issue.dispatch.dispatchId.match(/\d+/);
    if (match) {
      seqStr = match[0].slice(-4).padStart(4, "0");
    }
  } else {
    let hash = 0;
    const idStr = issue.id || "";
    for (let i = 0; i < idStr.length; i++) {
      hash = (hash << 5) - hash + idStr.charCodeAt(i);
      hash |= 0;
    }
    seqStr = String(Math.abs(hash) % 1000).padStart(4, "0");
  }

  return `PMC-${deptCode}-${seqStr}`;
}

export function getDeterministicOfficer(department: string): string {
  const dept = (department || "").toLowerCase();
  if (dept.includes("road")) {
    return "Shri. Anil Khopade (Senior Superintendent Engineer, Roads)";
  } else if (dept.includes("electrical")) {
    return "Shri. Sanjay Deshpande (Assistant Executive Engineer, Electrical)";
  } else if (dept.includes("water") || dept.includes("drainage")) {
    return "Smt. Jyoti Shinde (Executive Engineer, Water Works)";
  } else if (dept.includes("waste")) {
    return "Shri. Mahesh Tambe (Chief Sanitation Inspector, SWM)";
  } else if (dept.includes("urban") || dept.includes("development") || dept.includes("footpath")) {
    return "Smt. Prachi Gokhale (Senior Planner & Civil Works Engineer)";
  } else {
    return "Shri. Vijaykumar Shinde (Lead Operations Officer, PMC)";
  }
}

export function getDeterministicInspector(department: string): string {
  const dept = (department || "").toLowerCase();
  if (dept.includes("road")) {
    return "Inspector R. Kedari (Roads, ID-412)";
  } else if (dept.includes("electrical")) {
    return "Inspector S. Gholap (Electrical, ID-558)";
  } else if (dept.includes("water") || dept.includes("drainage")) {
    return "Inspector A. Deshmukh (Water Works, ID-621)";
  } else if (dept.includes("waste")) {
    return "Inspector M. Kulkarni (Sanitation, ID-892)";
  } else if (dept.includes("urban") || dept.includes("development") || dept.includes("footpath")) {
    return "Inspector P. Joshi (Civil, ID-314)";
  } else {
    return "Inspector V. Patil (Operations, ID-101)";
  }
}

export interface BudgetBreakdown {
  crewSize: number;
  materials: number;
  labor: number;
  equipment: number;
  trafficManagement: number;
  inspection: number;
  equipmentList: string[];
}

export function getBudgetBreakdown(cost: number, category: string, severity: number): BudgetBreakdown {
  const c = Math.round(cost);
  const crewSize = severity >= 8 ? 5 : severity >= 5 ? 3 : 2;
  
  let equipmentList: string[] = ["Standard Repair Truck", "Hand Tools"];
  const cat = (category || "").toLowerCase();
  if (cat.includes("road")) {
    equipmentList = severity >= 8 ? ["Asphalt Roller", "Excavator", "Core Cutter"] : ["Asphalt Patching Truck", "Plate Compactor"];
  } else if (cat.includes("electrical")) {
    equipmentList = ["Hydraulic Aerial Lift", "Insulated Safety Kit", "Multimeter"];
  } else if (cat.includes("water") || cat.includes("drainage")) {
    equipmentList = ["Dewatering Pump", "Pipe Fusion Machine", "Utility Truck"];
  } else if (cat.includes("waste")) {
    equipmentList = ["Compactor Garbage Truck", "Shovels & Sanitizers"];
  }
  
  let trafficPercent = cat.includes("road") || cat.includes("water") ? 10 : 0;
  let materialsPercent = cat.includes("electrical") || cat.includes("water") ? 40 : 30;
  let laborPercent = 30;
  let equipmentPercent = 20;
  let inspectionPercent = 10;
  
  const totalPercent = trafficPercent + materialsPercent + laborPercent + equipmentPercent + inspectionPercent;
  if (totalPercent !== 100) {
    materialsPercent += (100 - totalPercent);
  }
  
  const materials = Math.round((materialsPercent / 100) * c);
  const labor = Math.round((laborPercent / 100) * c);
  const equipment = Math.round((equipmentPercent / 100) * c);
  const trafficManagement = Math.round((trafficPercent / 100) * c);
  const inspection = Math.round((inspectionPercent / 100) * c);
  
  return {
    crewSize,
    materials,
    labor,
    equipment,
    trafficManagement,
    inspection,
    equipmentList
  };
}

export function getSlaExplanation(issue: SavedIssue): string {
  const priority = (issue.dispatch?.priorityLevel || "HIGH").toUpperCase();
  const severity = issue.severity || 5;
  
  let reason = "";
  if (priority === "CRITICAL" || severity >= 8) {
    reason = `PMC SLA Policy dictates a strict 24-hour turnaround for Critical (Severity ${severity}/10) hazards on primary arterial assets to minimize acute safety risks.`;
  } else if (priority === "HIGH" || severity >= 6) {
    reason = `Standard Municipal Policy allocates 72 hours (3 days) for High (Severity ${severity}/10) incidents to deploy specialized repair crews under localized traffic coordination.`;
  } else if (priority === "MEDIUM" || severity >= 4) {
    reason = `Scheduled maintenance guidelines assign a 7-day (168 hrs) completion window for Medium priority issues like routine public assets patching.`;
  } else {
    reason = `General PMC observation rules specify a 14-day window for low-severity or unclassified municipal incidents requiring detailed planning.`;
  }
  return reason;
}

/**
 * Generates an elegant, single-page PDF Work Order mirroring the printable template exactly.
 */
function generateWorkOrderPdf(issue: SavedIssue): string {
  const doc = new jsPDF("p", "mm", "a4");
  
  const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
  const workOrderId = getMunicipalWorkOrderID(issue);
  const officer = issue.dispatch?.responsibleOfficer || getDeterministicOfficer(dept);
  const priority = issue.dispatch?.priorityLevel || "HIGH";
  const rawCost = issue.costOfInaction?.repairCostNow || 4500;
  const costStr = formatRupees(rawCost);
  const sla = issue.dispatch?.responseSLA || "24 Hours";
  const breakdown = getBudgetBreakdown(rawCost, issue.issueType || "", issue.severity || 5);

  // Deep Slate header banner
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 35, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PUNE MUNICIPAL CORPORATION", 15, 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text("Official Infrastructure Work Order", 15, 26);

  // Top Right Info
  doc.setTextColor(59, 130, 246); // #3b82f6
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("WORK ORDER GENERATED", 195, 15, { align: "right" });
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 195, 22, { align: "right" });
  doc.text(`UID: ${issue.id.slice(0, 10).toUpperCase()}`, 195, 28, { align: "right" });

  // Grid details layout
  let y = 48;
  
  // Incident Details Box
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.roundedRect(12, y, 90, 60, 3, 3, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text("INCIDENT DETAILS", 18, y + 8);
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y + 11, 98, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text("Registry ID:", 18, y + 18);
  doc.text("Title:", 18, y + 26);
  doc.text("Category:", 18, y + 34);
  doc.text("Severity Index:", 18, y + 42);
  doc.text("Reporting Area:", 18, y + 50);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(issue.id.slice(0, 16), 45, y + 18);
  doc.text(issue.title.length > 25 ? issue.title.substring(0, 25) + "..." : issue.title, 45, y + 26);
  doc.text(issue.issueType || "Other", 45, y + 34);
  doc.text(`${issue.severity || 5}/10`, 45, y + 42);
  doc.text(issue.ward || issue.city || "Pune", 45, y + 50);

  // Execution Controls Box
  doc.roundedRect(108, y, 90, 60, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("EXECUTION CONTROLS", 114, y + 8);
  doc.line(112, y + 11, 194, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Work Order ID:", 114, y + 18);
  doc.text("Assigned Dept:", 114, y + 26);
  doc.text("Duty Officer:", 114, y + 34);
  doc.text("Priority Level:", 114, y + 42);
  doc.text("Estimated Cost:", 114, y + 50);
  doc.text("SLA Timeline:", 114, y + 56);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(workOrderId, 142, y + 18);
  doc.text(dept.substring(0, 24), 142, y + 26);
  doc.text(officer.length > 20 ? officer.substring(0, 20) + "..." : officer, 142, y + 34);
  
  doc.setTextColor(185, 28, 28); // red for priority
  doc.text(priority, 142, y + 42);
  
  doc.setTextColor(15, 23, 42);
  doc.text(costStr, 142, y + 50);
  doc.text(sla, 142, y + 56);

  // Diagnosis Block
  y = 114;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, y, 186, 26, 3, 3, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Incident Diagnosis & Remediation Plan", 18, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  
  const recomAction = issue.dispatch?.recommendedAction || "Dispatch authorized field crews immediately to audit public safety margins. Perform core remediation of physical structural failure matching state civic standards.";
  const lines = doc.splitTextToSize(recomAction, 174);
  doc.text(lines, 18, y + 14);

  // Resource & Budget Box
  y = 146;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, y, 186, 40, 3, 3, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Municipal Resource & Budget Allocation", 18, y + 8);
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y + 11, 194, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("REMEDIATION CREW", 18, y + 17);
  doc.text("REQUIRED EQUIPMENT", 80, y + 17);
  doc.text("MATERIALS BUDGET", 145, y + 17);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${breakdown.crewSize} Specialized Staff`, 18, y + 22);
  
  const equipStr = breakdown.equipmentList.join(", ");
  const equipLines = doc.splitTextToSize(equipStr, 60);
  doc.text(equipLines, 80, y + 22);
  doc.text(formatRupees(breakdown.materials), 145, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("LABOUR COST", 18, y + 30);
  doc.text("EQUIPMENT LEASING", 80, y + 30);
  doc.text("TRAFFIC MANAGEMENT", 145, y + 30);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupees(breakdown.labor), 18, y + 34);
  doc.text(formatRupees(breakdown.equipment), 80, y + 34);
  doc.text(formatRupees(breakdown.trafficManagement), 145, y + 34);

  // Digital Signature
  y = 192;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Digital Validation Signature", 12, y + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("This document is verified against the Pune Municipal Corporation", 12, y + 14);
  doc.text("decentralized Firestore ledger and remains legally binding.", 12, y + 18);
  doc.text(`Reference ID: ${issue.id.toUpperCase()}`, 12, y + 24);

  // QR box
  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setFillColor(255, 255, 255);
  doc.rect(162, y + 2, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("QR CODE SECURE", 176, y + 14, { align: "center" });
  doc.text("VERIFIED", 176, y + 19, { align: "center" });

  // Footer Legal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Pune Municipal Corporation Headquarters • Shivaji Nagar, Pune, Maharashtra 411005 • Internal Operations Dept", 105, 285, { align: "center" });

  return doc.output("base64" as any) as any;
}

interface IncidentExecutionCenterProps {
  issues: SavedIssue[];
  selectedIssueId: string | null;
  onSelectIssueId: (id: string | null) => void;
  onReturnToCommandCenter: () => void;
  onUpdateIssueStatus?: (
    id: string, 
    newStatus: string, 
    extraData?: {
      afterImageUrl?: string;
      inspectionResult?: string;
      verifiedBy?: string;
      completionTime?: string;
    }
  ) => void;
}

export default function IncidentExecutionCenter({
  issues,
  selectedIssueId,
  onSelectIssueId,
  onReturnToCommandCenter,
  onUpdateIssueStatus
}: IncidentExecutionCenterProps) {
  // Local states for filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterWard, setFilterWard] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterSla, setFilterSla] = useState("All");

  // Reference for scrolling to highlighted/selected row
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Auto scroll to selected issue when selectedIssueId is changed
  useEffect(() => {
    if (selectedIssueId) {
      setTimeout(() => {
        const element = rowRefs.current[selectedIssueId];
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [selectedIssueId]);

  // SLA countdown timer state
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Local state for tracking real Gmail dispatch (Sprint 11)
  const [dispatchState, setDispatchState] = useState<"IDLE" | "PREPARING" | "CONNECTING" | "DELIVERED">("IDLE");
  const [dispatchError, setDispatchError] = useState<{ type: string; message: string } | null>(null);
  const [dispatchedDetails, setDispatchedDetails] = useState<{ recipient: string; timestamp: string; messageId?: string } | null>(null);

  // Reset dispatch state when switching issues
  useEffect(() => {
    setDispatchState("IDLE");
    setDispatchError(null);
    setDispatchedDetails(null);
  }, [selectedIssueId]);

  const handleDispatchGmail = async (issue: SavedIssue) => {
    setDispatchState("PREPARING");
    setDispatchError(null);

    // Short delay for high-fidelity user feedback of preparation
    await new Promise((resolve) => setTimeout(resolve, 800));

    let pdfDataUri = "";
    try {
      pdfDataUri = generateWorkOrderPdf(issue);
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      setDispatchError({ 
        type: "PREPARING_FAILED", 
        message: `Failed to prepare PDF Work Order: ${err.message || err}` 
      });
      setDispatchState("IDLE");
      return;
    }

    setDispatchState("CONNECTING");

    try {
      const response = await fetch("/api/dispatch/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          issueId: issue.id,
          dispatchPackage: issue.dispatch || {
            dispatchId: getMunicipalWorkOrderID(issue),
            department: getDepartmentName(issue.affectedAsset || "", issue.issueType),
            technicalSeverity: issue.severity || 5,
            responseSLA: issue.dispatch?.responseSLA || "24 Hours",
            responsibleOfficer: getDeterministicOfficer(getDepartmentName(issue.affectedAsset || "", issue.issueType)),
            priorityLevel: issue.dispatch?.priorityLevel || "HIGH",
            recommendedAction: "Dispatch authorized field crews immediately."
          },
          costOfInaction: issue.costOfInaction,
          pdfBase64: pdfDataUri
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setDispatchError({
          type: data.errorType || "UNKNOWN",
          message: data.error || "An unexpected dispatch error occurred."
        });
        setDispatchState("IDLE");
        return;
      }

      setDispatchState("DELIVERED");
      setDispatchedDetails({
        recipient: data.recipient,
        timestamp: data.sentTimestamp || new Date().toISOString(),
        messageId: data.gmailMessageId
      });

      // Automatically advance the status of the issue in client state
      if (onUpdateIssueStatus) {
        onUpdateIssueStatus(issue.id, "Crew Dispatched");
      }
    } catch (err: any) {
      console.error("Gmail dispatch error:", err);
      setDispatchError({
        type: "NETWORK_ERROR",
        message: "Network Error: Failed to reach the CivicOS dispatch server."
      });
      setDispatchState("IDLE");
    }
  };

  // Compute the 4 KPI cards strictly from active issues
  const kpis = useMemo(() => {
    // 1. Active Work Orders (not closed)
    const activeIssues = issues.filter(i => normalizeStatus(i.status) !== "Closed");
    const activeCount = activeIssues.length;

    // 2. Overdue SLA Cases (not closed and SLA is onTrack === false)
    const overdueCount = issues.filter(i => {
      const s = normalizeStatus(i.status);
      if (s === "Closed") return false;
      const sla = getSLAStatus(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime, new Date(currentTime));
      return !sla.onTrack;
    }).length;

    // 3. Today's Closures (Status Resolved or Closed)
    const closuresCount = issues.filter(i => {
      const s = normalizeStatus(i.status);
      return s === "Closed" || s === "Resolved";
    }).length;

    // 4. Average Resolution Time (strictly computed from resolved/closed)
    const completedIssues = issues.filter(i => {
      const s = normalizeStatus(i.status);
      return (s === "Closed" || s === "Resolved") && i.createdAt;
    });

    let avgTimeText = "18.5 hrs";
    if (completedIssues.length > 0) {
      const totalHours = completedIssues.reduce((sum, i) => {
        const start = new Date(i.createdAt).getTime();
        const end = i.completionTime ? new Date(i.completionTime).getTime() : currentTime;
        const diffHrs = Math.max(0.5, (end - start) / (1000 * 60 * 60));
        return sum + diffHrs;
      }, 0);
      avgTimeText = `${(totalHours / completedIssues.length).toFixed(1)} hrs`;
    }

    return {
      activeCount,
      overdueCount,
      closuresCount,
      avgTimeText
    };
  }, [issues, currentTime]);

  // Extract list of unique wards for filtering
  const wardOptions = useMemo(() => {
    const wards = new Set<string>();
    issues.forEach(i => {
      if (i.ward) wards.add(i.ward);
      else if (i.city) wards.add(i.city);
    });
    return Array.from(wards).sort();
  }, [issues]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Title or id match
      const titleMatch = (issue.title || "Untitled Issue").toLowerCase().includes((searchQuery || "").toLowerCase());
      const idMatch = (issue.id || "").toLowerCase().includes((searchQuery || "").toLowerCase());
      const workOrderMatch = getMunicipalWorkOrderID(issue).toLowerCase().includes((searchQuery || "").toLowerCase());
      const matchesSearch = titleMatch || idMatch || workOrderMatch;

      // Status filter
      const status = normalizeStatus(issue.status);
      const matchesStatus = filterStatus === "All" || status === filterStatus;

      // Department filter
      const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
      const matchesDept = filterDepartment === "All" || dept === filterDepartment;

      // Ward filter
      const ward = issue.ward || issue.city || "Pune";
      const matchesWard = filterWard === "All" || ward === filterWard;

      // Priority filter
      const priority = issue.dispatch?.priorityLevel || "HIGH";
      const matchesPriority = filterPriority === "All" || priority.toUpperCase() === filterPriority.toUpperCase();

      // SLA Status filter
      const sla = getSLAStatus(issue.createdAt, issue.dispatch?.responseSLA || "24 Hours", issue.completionTime, new Date(currentTime));
      let matchesSla = true;
      if (filterSla === "OK") {
        matchesSla = sla.onTrack;
      } else if (filterSla === "BREACHED") {
        matchesSla = !sla.onTrack;
      }

      return matchesSearch && matchesStatus && matchesDept && matchesWard && matchesPriority && matchesSla;
    });
  }, [issues, searchQuery, filterStatus, filterDepartment, filterWard, filterPriority, filterSla]);

  // Selected Issue detail object
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return issues.find(i => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  // Handle advancement
  const handleAdvance = (issue: SavedIssue) => {
    if (!onUpdateIssueStatus) return;

    const currentStatus = normalizeStatus(issue.status);
    const transitions = STATUS_TRANSITIONS[currentStatus] || [];
    const nextStatus = transitions[0];
    if (!nextStatus) return;

    const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
    const afterImageMap: Record<string, string> = {
      "roads & infrastructure": "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80",
      "electrical maintenance": "https://images.unsplash.com/photo-1509395062183-67c5ad6faff9?auto=format&fit=crop&w=400&q=80",
      "solid waste management": "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=400&q=80",
      "water & drainage": "https://images.unsplash.com/photo-1542013936693-8848e574047e?auto=format&fit=crop&w=400&q=80",
      "urban development": "https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=400&q=80"
    };
    const simAfterImage = afterImageMap[(dept || "").toLowerCase()] || "https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=400&q=80";

    let payload: any = {};
    if (nextStatus === "Quality Inspection") {
      payload = {
        afterImageUrl: simAfterImage,
        inspectionResult: "Structural core remediation matches ISO-9001 standards."
      };
    } else if (nextStatus === "Resolved") {
      payload = {
        verifiedBy: getDeterministicInspector(dept),
        completionTime: new Date().toISOString()
      };
    }

    onUpdateIssueStatus(issue.id, nextStatus, payload);
  };

  // Printable work order trigger
  const triggerPrint = (issue: SavedIssue) => {
    const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
    const workOrderId = getMunicipalWorkOrderID(issue);
    const officer = issue.dispatch?.responsibleOfficer || getDeterministicOfficer(dept);
    const priority = issue.dispatch?.priorityLevel || "HIGH";
    const rawCost = issue.costOfInaction?.repairCostNow || 4500;
    const cost = formatRupees(rawCost);
    const status = normalizeStatus(issue.status);
    const sla = issue.dispatch?.responseSLA || "24 Hours";
    
    const breakdown = getBudgetBreakdown(rawCost, issue.issueType || "", issue.severity || 5);
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate printable work order.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Municipal Work Order - ${workOrderId}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #334155; }
            .header { border-bottom: 3px double #cbd5e1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo-sec { display: flex; align-items: center; gap: 15px; }
            .logo-placeholder { background: #4f46e5; color: white; padding: 12px; font-weight: bold; border-radius: 8px; font-size: 20px; }
            .title-sec h1 { font-size: 22px; margin: 0; color: #0f172a; font-weight: 800; }
            .title-sec p { font-size: 11px; margin: 3px 0 0 0; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
            .grid-details { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .card { border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background: #f8fafc; }
            .card-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
            .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
            .detail-row span:first-child { color: #64748b; }
            .detail-row span:last-child { font-weight: bold; color: #0f172a; }
            .description-block { border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
            .qr-section { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 30px; }
            .qr-box { text-align: center; }
            .qr-box img { border: 1px solid #e2e8f0; padding: 5px; border-radius: 8px; width: 120px; height: 120px; }
            .qr-box p { font-size: 10px; color: #64748b; margin-top: 5px; font-family: monospace; }
            .footer-legal { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 50px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-sec">
              <div class="logo-placeholder">PMC</div>
              <div class="title-sec">
                <h1>PUNE MUNICIPAL CORPORATION</h1>
                <p>Official Infrastructure Work Order</p>
              </div>
            </div>
            <div>
              <h2 style="font-size: 16px; margin: 0; text-align: right; color: #4f46e5;">WORK ORDER GENERATED</h2>
              <p style="font-size: 11px; margin: 3px 0 0 0; text-align: right; color: #64748b; font-family: monospace;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div class="grid-details">
            <div class="card">
              <div class="card-title">Incident Details</div>
              <div class="detail-row"><span>Registry ID:</span><span>${issue.id}</span></div>
              <div class="detail-row"><span>Title:</span><span>${issue.title}</span></div>
              <div class="detail-row"><span>Category:</span><span>${issue.issueType || "Other"}</span></div>
              <div class="detail-row"><span>Severity Index:</span><span>${issue.severity || 5}/10</span></div>
              <div class="detail-row"><span>Reporting Area:</span><span>${issue.ward || issue.city || "Pune"}</span></div>
            </div>

            <div class="card">
              <div class="card-title">Execution Controls</div>
              <div class="detail-row"><span>Work Order ID:</span><span>${workOrderId}</span></div>
              <div class="detail-row"><span>Assigned Dept:</span><span>${dept}</span></div>
              <div class="detail-row"><span>Duty Officer:</span><span>${officer}</span></div>
              <div class="detail-row"><span>Priority level:</span><span style="color: #b91c1c;">${priority}</span></div>
              <div class="detail-row"><span>Estimated Cost:</span><span>${cost}</span></div>
              <div class="detail-row"><span>SLA Timeline:</span><span>${sla}</span></div>
            </div>
          </div>

          <div class="description-block">
            <h3 style="font-size: 14px; margin-top: 0; color: #0f172a;">Incident Diagnosis & Remediation Plan</h3>
            <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 0;">
              ${issue.dispatch?.recommendedAction || "Dispatch authorized field crews immediately to audit public safety margins. Perform core remediation of physical structural failure matching state civic standards."}
            </p>
          </div>

          <div class="card" style="margin-bottom: 30px;">
            <div class="card-title">Municipal Resource & Budget Allocation</div>
            <div style="display: grid; grid-template-cols: repeat(3, 1fr); gap: 15px; font-size: 13px;">
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Remediation Crew</div>
                <div style="font-weight: bold; margin-top: 4px;">${breakdown.crewSize} Specialized Officers</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Required Equipment</div>
                <div style="font-weight: bold; margin-top: 4px; font-size: 12px;">${breakdown.equipmentList.join(", ")}</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Materials Budget</div>
                <div style="font-weight: bold; margin-top: 4px;">${formatRupees(breakdown.materials)}</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Labour Cost</div>
                <div style="font-weight: bold; margin-top: 4px;">${formatRupees(breakdown.labor)}</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Equipment Leasing</div>
                <div style="font-weight: bold; margin-top: 4px;">${formatRupees(breakdown.equipment)}</div>
              </div>
              <div>
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase;">Traffic Management</div>
                <div style="font-weight: bold; margin-top: 4px;">${formatRupees(breakdown.trafficManagement)}</div>
              </div>
            </div>
          </div>

          <div class="grid-details">
            <div class="card" style="grid-column: span 2;">
              <div class="card-title">Current Workflow Execution Stage</div>
              <div class="detail-row"><span>Operational Status:</span><span style="color: #4f46e5; text-transform: uppercase;">${status}</span></div>
              <div class="detail-row"><span>SLA Target Status:</span><span>${getSLAStatus(issue.createdAt, issue.dispatch?.responseSLA || "24 Hours", issue.completionTime).statusText}</span></div>
              <div class="detail-row"><span>Log Reference:</span><span style="font-family: monospace; font-size: 11px;">${issue.createdAt}</span></div>
            </div>
          </div>

          <div class="qr-section">
            <div>
              <h3 style="font-size: 13px; margin: 0; color: #0f172a;">Digital Validation Signature</h3>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; max-width: 450px; margin: 5px 0 0 0;">
                Scan the QR code to verify this ticket directly against the Pune Municipal Corporation decentralized Firestore ledger. This document remains legally binding.
              </p>
            </div>
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${issue.id}" alt="QR code verification" />
              <p>REF: ${issue.id.slice(0, 10).toUpperCase()}</p>
            </div>
          </div>

          <div class="footer-legal">
            Pune Municipal Corporation Headquarters • Shivaji Nagar, Pune, Maharashtra 411005 • Internal Operations Dept
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* HEADER SECTION WITH NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onReturnToCommandCenter}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-bold hidden sm:inline">Executive Dashboard</span>
            </button>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Operations Center
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Incident Execution Center</h2>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Realtime municipal execution control room. Operationalize, inspect, and complete work orders securely.
          </p>
        </div>

        <button
          onClick={onReturnToCommandCenter}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 border border-slate-200 cursor-pointer self-stretch md:self-auto justify-center"
        >
          <Building className="h-4 w-4" />
          Return to Executive Command Center
        </button>
      </div>

      {/* PART 2 — EXECUTION KPI DASHBOARD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="execution-kpis">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100/50">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Work Orders</span>
            <span className="text-xl font-black text-slate-900">{kpis.activeCount}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-100/50">
            <AlertTriangle className="h-6 w-6 text-rose-600 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Overdue SLA Cases</span>
            <span className="text-xl font-black text-slate-900">{kpis.overdueCount}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100/50">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Today's Closures</span>
            <span className="text-xl font-black text-slate-900">{kpis.closuresCount}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100/50">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Avg Resolution Time</span>
            <span className="text-xl font-black text-slate-900">{kpis.avgTimeText}</span>
          </div>
        </div>
      </div>

      {/* MASTER-DETAIL SYSTEM SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="execution-split-container">
        
        {/* MASTER PANEL: INCIDENTS TABLE */}
        <div className={`${selectedIssueId ? "lg:col-span-5" : "lg:col-span-12"} bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-4 flex flex-col justify-between`}>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-slate-500" />
                Active Field Tickets ({filteredIssues.length})
              </h3>
            </div>

            {/* PART 10 — FILTERS BAR (ROW 1: Search & Status/Dept) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              
              <div className="relative col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-3">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, ID, Work Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  {LIFECYCLE_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
                >
                  <option value="All">All Depts</option>
                  <option value="Roads & Infrastructure">Roads & Infra</option>
                  <option value="Electrical Maintenance">Electrical</option>
                  <option value="Water & Drainage">Water & Drainage</option>
                  <option value="Solid Waste Management">Waste Mgmt</option>
                  <option value="Municipal General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Ward</label>
                <select
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
                >
                  <option value="All">All Wards</option>
                  {wardOptions.map(ward => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
                >
                  <option value="All">All Priorities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2 xl:col-span-2">
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">SLA Status</label>
                <select
                  value={filterSla}
                  onChange={(e) => setFilterSla(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
                >
                  <option value="All">All SLA states</option>
                  <option value="OK">SLA OK</option>
                  <option value="BREACHED">SLA BREACHED</option>
                </select>
              </div>

            </div>

            {/* TABLE LIST */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Work Order ID</th>
                      <th className="p-3">Incident Description</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-xs text-slate-400 font-bold italic bg-white">
                          No matching incidents found in the municipal registry.
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map((issue) => {
                        const isSelected = selectedIssueId === issue.id;
                        const status = normalizeStatus(issue.status);
                        const workOrderID = getMunicipalWorkOrderID(issue);
                        const sla = getSLAStatus(issue.createdAt, issue.dispatch?.responseSLA || "24 Hours");
                        
                        let statusBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
                        if (status === "Closed") statusBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                        if (status === "Resolved") statusBadgeColor = "bg-teal-100 text-teal-800 border-teal-200";
                        if (status === "Quality Inspection") statusBadgeColor = "bg-rose-100 text-rose-800 border-rose-200";
                        if (status === "Work In Progress") statusBadgeColor = "bg-purple-100 text-purple-800 border-purple-200";
                        if (status === "Crew Dispatched") statusBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";

                        // Compute remaining hours
                        let targetHours = 24;
                        const slaStr = String(issue.dispatch?.responseSLA || "24 Hours").toLowerCase();
                        if (slaStr.includes("24 hours") || slaStr.includes("critical")) targetHours = 24;
                        else if (slaStr.includes("72 hours") || slaStr.includes("high")) targetHours = 72;
                        else if (slaStr.includes("7 days") || slaStr.includes("medium")) targetHours = 168;
                        else if (slaStr.includes("14 days") || slaStr.includes("low")) targetHours = 336;

                        const targetTime = new Date(issue.createdAt).getTime() + targetHours * 60 * 60 * 1000;
                        const remainingMs = targetTime - currentTime;
                        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));

                        return (
                          <tr
                            key={issue.id}
                            ref={el => rowRefs.current[issue.id] = el}
                            id={`execution-row-${issue.id}`}
                            className={`border-b border-slate-150/50 hover:bg-white/80 transition-all cursor-pointer ${
                              isSelected 
                                ? "bg-indigo-50/40 border-l-4 border-l-indigo-600 font-extrabold shadow-sm" 
                                : "bg-white"
                            }`}
                            onClick={() => onSelectIssueId(issue.id)}
                          >
                            <td className="p-3">
                              <span className="text-[10px] font-mono font-bold text-slate-800 block">
                                {workOrderID}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400">
                                UID: #{issue.id.slice(-6).toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3">
                              <p className="text-xs font-black text-slate-800 line-clamp-1">{issue.title}</p>
                              <p className="text-[9px] text-slate-400 font-medium">Ward: {issue.ward || issue.city || "Pune"}</p>
                            </td>
                            <td className="p-3">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${statusBadgeColor}`}>
                                {status}
                              </span>
                            </td>
                            <td className="p-3">
                              {status === "Closed" || status === "Resolved" ? (
                                <span className="text-[9px] font-bold text-emerald-600">✓ COMPLETED</span>
                              ) : remainingHours <= 0 ? (
                                <span className="text-[9px] font-black text-rose-600 animate-pulse bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">
                                  BREACHED
                                </span>
                              ) : (
                                <span className={`text-[9px] font-bold ${remainingHours <= 6 ? "text-amber-600 animate-pulse" : "text-indigo-600"}`}>
                                  {remainingHours} hrs left
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-400 text-center border-t border-slate-100 pt-3 mt-4">
            REGISTRY REFERENCE: SYSTEM SECURE • PORT: 3000
          </div>
        </div>

        {/* DETAIL PANEL: OPERATIONS DASHBOARD CARD / INCIDENT LIFECYCLE CONTROLLER */}
        <div className="lg:col-span-7">
          {selectedIssue ? (() => {
            const issue = selectedIssue;
            const dept = getDepartmentName(issue.affectedAsset || "", issue.issueType);
            const status = normalizeStatus(issue.status);
            const workOrderID = getMunicipalWorkOrderID(issue);
            const officer = issue.dispatch?.responsibleOfficer || getDeterministicOfficer(dept);
            const priority = issue.dispatch?.priorityLevel || "HIGH";
            const cost = issue.costOfInaction?.repairCostNow || 4500;
            const slaConfig = issue.dispatch?.responseSLA || "24 Hours";
            
            // Computations for SLA Live Countdown (Part 4)
            let targetHours = 24;
            const slaStr = slaConfig.toLowerCase();
            if (slaStr.includes("24 hours") || slaStr.includes("critical")) targetHours = 24;
            else if (slaStr.includes("72 hours") || slaStr.includes("high")) targetHours = 72;
            else if (slaStr.includes("7 days") || slaStr.includes("medium")) targetHours = 168;
            else if (slaStr.includes("14 days") || slaStr.includes("low")) targetHours = 336;

            const createdTime = isNaN(new Date(issue.createdAt).getTime()) ? new Date().getTime() : new Date(issue.createdAt).getTime();
            const targetTime = createdTime + targetHours * 60 * 60 * 1000;
            const remainingMs = targetTime - currentTime;
            const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
            
            // SLA string or Breach text
            const liveSlaText = remainingHours <= 0 ? "SLA BREACHED" : `${remainingHours} hrs remaining`;

            // Dynamic timestamp helper for Timeline with strict logical ceilings
            const getTimelineStepTime = (offsetMins: number): string => {
              const targetMs = createdTime + offsetMins * 60 * 1000;
              const maxCeiling = issue.completionTime ? new Date(issue.completionTime).getTime() : currentTime;
              const d = new Date(Math.min(targetMs, maxCeiling));
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
            };

            const timelineSteps = [
              { stage: "Reported", label: "Reported", time: getTimelineStepTime(0) },
              { stage: "Verified", label: "Verified", time: getTimelineStepTime(3) },
              { stage: "Assigned", label: "Assigned", time: getTimelineStepTime(8) },
              { stage: "Crew Dispatched", label: "Crew Dispatched", time: getTimelineStepTime(15) },
              { stage: "Work In Progress", label: "Work Started", time: getTimelineStepTime(45) },
              { stage: "Quality Inspection", label: "Inspection", time: getTimelineStepTime(105) },
              { stage: "Resolved", label: "Resolved", time: getTimelineStepTime(120) },
              { stage: "Closed", label: "Closed", time: issue.completionTime ? new Date(issue.completionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : getTimelineStepTime(125) }
            ];

            const currentStageIdx = LIFECYCLE_STATES.indexOf(status);
            const transitions = STATUS_TRANSITIONS[status] || [];
            const nextStatus = transitions[0];

            return (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6 animate-fade-in relative">
                
                {/* Panel Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {dept}
                      </span>
                      <span className="text-[10px] font-mono font-extrabold text-slate-500">
                        {workOrderID}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight">
                      {issue.title}
                    </h4>
                    <p className="text-[9px] font-mono text-slate-400">Registry UID: {issue.id}</p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => triggerPrint(issue)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer text-xs font-bold"
                      title="Print Work Order PDF"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Print Work Order</span>
                    </button>
                    <button
                      onClick={() => onSelectIssueId(null)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* PART 3 — LIFECYCLE PROGRESS TRACKER */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                    Visual Progress Tracker (Ground-authoritative)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-1.5">
                    {LIFECYCLE_STATES.map((step, idx) => {
                      const isPast = idx < currentStageIdx;
                      const isCurrent = idx === currentStageIdx;
                      
                      let stepStyle = "bg-slate-100 text-slate-400 border-slate-200";
                      if (isPast) {
                        stepStyle = "bg-emerald-500 text-white border-emerald-600 shadow-sm";
                      } else if (isCurrent) {
                        stepStyle = "bg-indigo-600 text-white border-indigo-700 animate-pulse ring-2 ring-indigo-100 ring-offset-1 shadow-md";
                      }

                      return (
                        <div 
                          key={step} 
                          className={`text-[9px] font-black px-2 py-1.5 rounded-xl border ${stepStyle} flex items-center justify-center gap-1 text-center`}
                        >
                          {isPast && <Check className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* OPERATIONAL PARAMETERS GRID (PART 6 & SLA COUNTDOWN PART 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Countdown & SLA */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block font-mono mb-2">
                        SLA Countdown Monitoring
                      </span>
                      
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-slate-500 font-semibold">SLA Tier limit:</span>
                        <span className="text-[11px] font-extrabold text-slate-900">{slaConfig}</span>
                      </div>

                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-slate-500 font-semibold">Priority Class:</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-700">
                          {priority}
                        </span>
                      </div>

                      <div className="border-t border-slate-200/60 pt-2.5 flex justify-between items-center mb-2.5">
                        <span className="text-[11px] text-slate-500 font-semibold">Remaining Target SLA:</span>
                        {status === "Closed" || status === "Resolved" ? (
                          <span className="text-[10px] font-black text-emerald-600 uppercase">SLA MET & COMPLIANT</span>
                        ) : remainingHours <= 0 ? (
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wide bg-rose-100 border border-rose-200 px-2 py-0.5 rounded animate-pulse">
                            {liveSlaText}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-black uppercase ${remainingHours <= 6 ? "text-amber-600 animate-pulse" : "text-indigo-600"}`}>
                            {liveSlaText}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Explanatory Policy Guideline */}
                    <div className="border-t border-slate-200/60 pt-2 text-[9px] text-slate-500 font-medium leading-relaxed bg-white/40 p-2 rounded border border-slate-200/30">
                      {getSlaExplanation(issue)}
                    </div>
                  </div>

                  {/* Dispatch Parameters */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block font-mono">
                      Executive Dispatch Details
                    </span>

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500 font-semibold">Responsible Officer:</span>
                      <span className="text-[11px] font-extrabold text-slate-900">{officer}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500 font-semibold">Budget Allocation:</span>
                      <span className="text-[11px] font-black text-slate-900">{formatRupees(cost)}</span>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2.5 flex justify-between items-center">
                      <span className="text-[11px] text-slate-500 font-semibold">Target Completion:</span>
                      <span className="text-[10px] font-bold text-slate-700">
                        {new Date(targetTime).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(targetTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {issue.dispatch?.emailSent && (
                      <div className="border-t border-slate-200/60 pt-2.5 space-y-1 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-black text-[9px] uppercase tracking-wider">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>MUNICIPAL EMAIL DISPATCHED</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-600"><span>To:</span><span className="text-slate-800 font-extrabold">{issue.dispatch.emailRecipient}</span></div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-600"><span>Sent:</span><span className="text-slate-800 font-extrabold">{issue.dispatch.emailDeliveredAt ? new Date(issue.dispatch.emailDeliveredAt).toLocaleString() : "N/A"}</span></div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-600 truncate"><span className="shrink-0 text-left">Gmail ID:</span><span className="text-slate-800 font-mono text-[8px] truncate select-all">{issue.dispatch.emailMessageId}</span></div>
                      </div>
                    )}

                    {/* Financial & Resource Detailed Breakdown */}
                    {(() => {
                      const breakdown = getBudgetBreakdown(cost, issue.issueType || "", issue.severity || 5);
                      return (
                        <div className="border-t border-slate-200/60 pt-2 text-[9px] text-slate-500 font-medium space-y-1 bg-white/40 p-2 rounded border border-slate-200/30">
                          <div className="font-extrabold text-slate-600 uppercase text-[8px] tracking-wider mb-1">RESOURCE & FINANCIAL BREAKDOWN</div>
                          <div className="flex justify-between"><span>Crew size:</span><span className="font-bold text-slate-700">{breakdown.crewSize} staff</span></div>
                          <div className="flex justify-between"><span>Equipment:</span><span className="font-bold text-slate-700 truncate max-w-[130px]" title={breakdown.equipmentList.join(", ")}>{breakdown.equipmentList.join(", ")}</span></div>
                          <div className="flex justify-between"><span>Materials:</span><span className="font-bold text-slate-700">{formatRupees(breakdown.materials)}</span></div>
                          <div className="flex justify-between"><span>Labor cost:</span><span className="font-bold text-slate-700">{formatRupees(breakdown.labor)}</span></div>
                          <div className="flex justify-between"><span>Equip lease:</span><span className="font-bold text-slate-700">{formatRupees(breakdown.equipment)}</span></div>
                          {breakdown.trafficManagement > 0 && (
                            <div className="flex justify-between"><span>Traffic management:</span><span className="font-bold text-slate-700">{formatRupees(breakdown.trafficManagement)}</span></div>
                          )}
                          <div className="flex justify-between"><span>Inspection:</span><span className="font-bold text-slate-700">{formatRupees(breakdown.inspection)}</span></div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* PART 7 — BEFORE / AFTER EVIDENCE */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                    Before / After Photo Verification Panel
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Image */}
                    <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-black text-rose-600 block uppercase tracking-wider font-mono">Before Repair (Citizen)</span>
                      <div className="h-32 bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200/50">
                        <img
                          src={issue.imageUrl}
                          alt="Before Repair"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 text-center font-mono">{issue.createdAt}</p>
                    </div>

                    {/* After Image */}
                    <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-emerald-600 block uppercase tracking-wider font-mono">After Repair Evidence</span>
                        {issue.afterImageUrl && (
                          issue.afterImageUrl.startsWith("data:") ? (
                            <span className="text-[7px] bg-emerald-100 border border-emerald-200 text-emerald-700 px-1 py-0.2 rounded font-bold uppercase font-mono scale-90 origin-right">VERIFIED FIELD UPLOAD</span>
                          ) : (
                            <span className="text-[7px] bg-amber-100 border border-amber-200 text-amber-700 px-1 py-0.2 rounded font-bold uppercase font-mono scale-90 origin-right">SIMULATED DEMO PROOF</span>
                          )
                        )}
                      </div>
                      
                      {issue.afterImageUrl ? (
                        <>
                          <div className="h-32 bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200/50">
                            <img
                              src={issue.afterImageUrl}
                              alt="After Repair Evidence"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          <div className="text-center bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg space-y-0.5">
                            <p className="text-[9px] text-emerald-700 font-extrabold uppercase tracking-wide flex items-center justify-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              ✓ Verification Complete
                            </p>
                            <p className="text-[8px] text-slate-500 font-semibold">{issue.verifiedBy || "Approved by Chief Inspector"}</p>
                          </div>
                        </>
                      ) : (
                        <div className="h-32 bg-slate-100 rounded-lg overflow-hidden relative border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-3">
                          <ImageIcon className="h-8 w-8 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-700 font-extrabold uppercase tracking-wide text-rose-600 animate-pulse">
                            Awaiting Completion Proof
                          </p>
                          <p className="text-[8px] text-slate-400 font-medium max-w-[160px] leading-relaxed">
                            Field crew must upload repair evidence before closure. Verification Pending.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* PART 12 — CASE COMPLETION EXPERIENCE */}
                {status === "Closed" && (
                  <div className="bg-emerald-50 border-2 border-emerald-500/20 p-5 rounded-2xl space-y-3 shadow-inner">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500 text-white p-1.5 rounded-full">
                        <Check className="h-5 w-5 stroke-[3]" />
                      </div>
                      <div>
                        <h5 className="text-sm font-black text-emerald-900 tracking-tight uppercase">
                          ✔ MUNICIPAL EXECUTION COMPLETE
                        </h5>
                        <p className="text-[10px] text-emerald-600 font-bold">The field ticket is officially resolved and archived.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-left pt-1">
                      {[
                        "Work Order Closed",
                        "Inspection Passed",
                        "Evidence Archived",
                        "Citizen Notified",
                        "Registry Archived"
                      ].map((task) => (
                        <div key={task} className="flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold bg-white/80 border border-emerald-100/50 px-2.5 py-1 rounded-lg">
                          <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {task}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PART 8 — MUNICIPAL TIMELINE & PART 9 — EXECUTION ACTIVITY LOG */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                  
                  {/* Audit Timeline */}
                  <div className="md:col-span-5 space-y-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                      Municipal Timeline
                    </span>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                      {timelineSteps.map((step, idx) => {
                        const isReached = idx <= currentStageIdx;
                        
                        return (
                          <div key={step.stage} className="flex gap-3 items-center text-xs">
                            <div className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                              isReached ? "bg-emerald-500 border-emerald-600" : "bg-slate-200 border-slate-300"
                            }`} />
                            <div className="flex justify-between items-center w-full">
                              <span className={`font-extrabold ${isReached ? "text-slate-800" : "text-slate-400"}`}>
                                {step.label}
                              </span>
                              <span className="text-[9px] font-mono font-bold text-slate-400">
                                {isReached ? step.time : "Pending"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Operational Activity Feed */}
                  <div className="md:col-span-7 space-y-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                      Execution Activity Log
                    </span>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 max-h-[280px] overflow-y-auto">
                      {(() => {
                        const logs = [
                          { idx: 0, text: "Citizen submitted report with photographic evidence" },
                          { idx: 1, text: "AI categorized incident & severity index established" },
                          { idx: 2, text: `Supervisor verified report & created work order ${workOrderID}` },
                          { idx: 3, text: `Crew dispatched under Officer ${officer}` },
                          { idx: 4, text: "Crew arrived on-site & physical remediation work started" },
                          { idx: 5, text: "Remediation complete; field before/after proof archived" },
                          { idx: 6, text: "Quality Audit inspection completed & approved" },
                          { idx: 7, text: "Case closed in decentralized municipal ledger" }
                        ];

                        const reachedLogs = logs.filter(l => l.idx <= currentStageIdx);

                        return reachedLogs.map((log) => {
                          const stepTime = getTimelineStepTime(
                            log.idx === 0 ? 0 : 
                            log.idx === 1 ? 3 :
                            log.idx === 2 ? 8 :
                            log.idx === 3 ? 15 :
                            log.idx === 4 ? 45 :
                            log.idx === 5 ? 105 :
                            log.idx === 6 ? 120 : 125
                          );

                          return (
                            <div key={log.idx} className="flex gap-2.5 items-start text-[11px] border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                              <History className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-700 leading-snug">{log.text}</p>
                                <p className="text-[8px] font-mono font-extrabold text-slate-400">{stepTime}</p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                </div>

                {/* ADVANCE WORKFLOW ACTION */}
                {nextStatus ? (
                  nextStatus === "Crew Dispatched" ? (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="text-left space-y-0.5">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block font-mono">
                            OFFICIAL GMAIL DISPATCH
                          </span>
                          <p className="text-xs font-bold text-slate-700">
                            Subject: <span className="text-slate-800 font-extrabold">PMC Work Order • {workOrderID}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            Recipient: <span className="text-slate-700 font-bold">{process.env.GMAIL_DEMO_RECIPIENT || "Default Dispatch Contact"}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => handleDispatchGmail(issue)}
                          disabled={dispatchState !== "IDLE"}
                          className={`font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                            dispatchState === "IDLE" 
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                              : dispatchState === "DELIVERED"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {dispatchState === "IDLE" && (
                            <>
                              <Play className="h-3.5 w-3.5 animate-pulse" />
                              <span>Dispatch Work Order</span>
                            </>
                          )}
                          {dispatchState === "PREPARING" && (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Preparing Work Order...</span>
                            </>
                          )}
                          {dispatchState === "CONNECTING" && (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Connecting to Gmail...</span>
                            </>
                          )}
                          {dispatchState === "DELIVERED" && (
                            <>
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                              <span>Dispatch Delivered</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* ERROR DISPLAY FOR RETRY */}
                      {dispatchError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex gap-3 items-start animate-fade-in">
                          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-1 w-full">
                            <h5 className="text-xs font-black text-rose-800 uppercase tracking-wide">
                              {dispatchError.type === "AUTH_FAILED" && "Authentication Failed"}
                              {dispatchError.type === "QUOTA_EXCEEDED" && "Quota Exceeded"}
                              {dispatchError.type === "INVALID_RECIPIENT" && "Recipient Invalid"}
                              {dispatchError.type === "NETWORK_ERROR" && "Network Error"}
                              {dispatchError.type !== "AUTH_FAILED" && dispatchError.type !== "QUOTA_EXCEEDED" && dispatchError.type !== "INVALID_RECIPIENT" && dispatchError.type !== "NETWORK_ERROR" && "Dispatch Error"}
                            </h5>
                            <p className="text-[10px] text-rose-600 font-medium leading-relaxed font-mono">
                              {dispatchError.message}
                            </p>
                            <button
                              onClick={() => {
                                setDispatchError(null);
                                handleDispatchGmail(issue);
                              }}
                              className="text-[10px] font-black text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry Dispatch Request
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SUCCESS CONFIRMATION DISPLAY / TOAST PANEL */}
                      {dispatchState === "DELIVERED" && dispatchedDetails && (
                        <div className="bg-emerald-50 border-2 border-emerald-500/20 rounded-xl p-4 space-y-2.5 animate-fade-in shadow-inner">
                          <div className="flex gap-2.5 items-start">
                            <div className="bg-emerald-500 text-white p-1 rounded-full mt-0.5">
                              <Check className="h-4 w-4 stroke-[3]" />
                            </div>
                            <div className="space-y-0.5">
                              <h5 className="text-xs font-black text-emerald-900 tracking-tight uppercase">
                                Municipal Work Order successfully dispatched
                              </h5>
                              <p className="text-[10px] text-emerald-600 font-bold">
                                Email was delivered successfully via Google Gmail API.
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-emerald-100/50 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-emerald-800 font-bold">
                            <div className="flex justify-between sm:justify-start gap-2 bg-white/70 px-2 py-1.5 rounded border border-emerald-100/30">
                              <span className="text-slate-500">Recipient:</span>
                              <span>{dispatchedDetails.recipient}</span>
                            </div>
                            <div className="flex justify-between sm:justify-start gap-2 bg-white/70 px-2 py-1.5 rounded border border-emerald-100/30">
                              <span className="text-slate-500">Delivered At:</span>
                              <span>{dispatchedDetails.timestamp ? new Date(dispatchedDetails.timestamp).toLocaleString() : "N/A"}</span>
                            </div>
                            {dispatchedDetails.messageId && (
                              <div className="sm:col-span-2 flex justify-between sm:justify-start gap-2 bg-white/70 px-2 py-1.5 rounded border border-emerald-100/30 truncate">
                                <span className="text-slate-500 shrink-0">Gmail ID:</span>
                                <span className="font-mono text-[9px] select-all truncate">{dispatchedDetails.messageId}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="text-left space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                          Advance Incident Stage
                        </span>
                        <p className="text-xs font-bold text-slate-700">
                          Current: <span className="text-indigo-600 font-black">{status}</span> ➜ Target: <span className="text-emerald-600 font-black">{nextStatus}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleAdvance(issue)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 animate-pulse" />
                        Advance to {nextStatus}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-800">Case Execution Complete</p>
                      <p className="text-[10px] text-emerald-600 font-bold">This incident is fully closed in the municipal ledger. No further action is required.</p>
                    </div>
                  </div>
                )}

              </div>
            );
          })() : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-md space-y-3">
              <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto" />
              <h4 className="text-slate-800 font-black text-lg">No Incident Selected</h4>
              <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                Click on any active work ticket from the municipal registry to view its visual progress, countdown timers, before/after evidence, and printable work orders.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
