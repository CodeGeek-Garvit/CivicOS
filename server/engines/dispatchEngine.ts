import { DispatchPackage } from "../types/dispatch";
import { getResponsibleDepartment } from "./departmentEngine";
import { computeOperationalPriority } from "./priorityEngine";
import { getResponseSLA } from "./slaEngine";
import { generateDispatchEmail } from "../templates/dispatchTemplate";

/**
 * Maps a department string deterministically to a responsible municipal officer.
 */
export function getResponsibleOfficer(department: string): string {
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

/**
 * Deterministically constructs an official dispatch package for a fully-analyzed issue.
 * Initially, stage is PACKAGE_GENERATED as requested.
 */
export function buildDispatchPackage(issue: any, sequenceNumber: number): DispatchPackage {
  const dispatchId = `CIV-DSP-${String(sequenceNumber).padStart(6, "0")}`;
  const issueId = issue.id || "";
  const createdAt = new Date().toISOString();

  // Extract or compute operational values
  const department = issue.responsibleDepartment || getResponsibleDepartment(issue.affectedAsset || "");
  const technicalSeverity = issue.technicalSeverity !== undefined ? Number(issue.technicalSeverity) : (issue.severity !== undefined ? Number(issue.severity) : 5);
  
  let priorityLevel = issue.priorityLevel;
  if (!priorityLevel) {
    const priorityResult = computeOperationalPriority({ technicalSeverity });
    priorityLevel = priorityResult.priorityLevel;
  }

  const responseSLA = issue.responseSLA || getResponseSLA(priorityLevel);

  const repairCostToday = issue.costOfInaction?.repairCostNow || 0;
  const repairCost30Days = issue.costOfInaction?.repairCost30Days || 0;
  const repairCost90Days = issue.costOfInaction?.repairCost90Days || 0;
  const citizensAffected = issue.costOfInaction?.estimatedCitizensAffected || 0;
  const recommendedAction = issue.costOfInaction?.recommendedAction || "Immediate inspect and dispatch maintenance crew.";

  const responsibleOfficer = getResponsibleOfficer(department);

  return {
    dispatchId,
    issueId,
    createdAt,
    department,
    priorityLevel,
    technicalSeverity,
    responseSLA,
    repairCostToday,
    repairCost30Days,
    repairCost90Days,
    citizensAffected,
    recommendedAction,
    responsibleOfficer,
    dispatchStatus: "READY",
    emailStatus: "PENDING",
    sheetStatus: "PENDING",
    workflowStage: "PACKAGE_GENERATED"
  };
}

/**
 * Part 1 & 7: Generates work-order email details.
 * Architecture Refinement: This wrapper encapsulates the email generation.
 * In a future sprint (Sprint 5.2), replacing this with a real Gmail API send call
 * only requires updating this single function.
 */
export function generateEmail(dispatch: DispatchPackage, issue: any): DispatchPackage {
  const emailResult = generateDispatchEmail(dispatch, issue);
  
  return {
    ...dispatch,
    emailStatus: "READY",
    emailGeneratedAt: new Date().toISOString(),
    emailSubject: emailResult.subject,
    emailBody: emailResult.body, // Text work order
    workflowStage: "EMAIL_GENERATED"
  };
}

/**
 * Part 2 & 7: Prepares the Google Sheets registry payload row.
 * Every dispatch should generate a structured row with specified columns.
 * Architecture Refinement: This wrapper encapsulates sheet row generation.
 * In a future sprint, replacing this with a real sheets.appendRow() call
 * only requires updating this single function.
 */
export function generateSheetPayload(dispatch: DispatchPackage, issue: any): DispatchPackage {
  const coords = issue.location 
    ? `${issue.location.latitude.toFixed(6)}, ${issue.location.longitude.toFixed(6)}`
    : "Not specified";

  const confidenceScore = issue.confidence !== undefined 
    ? `${(issue.confidence * 100).toFixed(0)}%` 
    : (issue.analysisConfidence !== undefined ? `${(issue.analysisConfidence * 100).toFixed(0)}%` : "85%");

  const payload = {
    "Dispatch ID": dispatch.dispatchId,
    "Issue ID": dispatch.issueId,
    "Issue Type": issue.issueType || "Other",
    "Department": dispatch.department,
    "Officer": dispatch.responsibleOfficer,
    "Priority": dispatch.priorityLevel,
    "Severity": dispatch.technicalSeverity,
    "Confidence": confidenceScore,
    "Location": `${issue.city || "Pune"}, ${issue.state || "Maharashtra"} (Coords: ${coords})`,
    "Status": dispatch.dispatchStatus,
    "Response SLA": dispatch.responseSLA,
    "Repair Cost": dispatch.repairCostToday,
    "30 Day Cost": dispatch.repairCost30Days,
    "90 Day Cost": dispatch.repairCost90Days,
    "Created Time": dispatch.createdAt,
    "Recommended Action": dispatch.recommendedAction,
    "Workflow Stage": dispatch.workflowStage,
    "Email Status": dispatch.emailStatus
  };

  return {
    ...dispatch,
    sheetStatus: "READY",
    sheetPayload: payload,
    sheetGeneratedAt: new Date().toISOString()
  };
}

/**
 * Helper to process the entire autonomous dispatch pipeline for a registered issue.
 */
export function runAutonomousDispatchPipeline(issue: any, sequenceNumber: number): DispatchPackage {
  // Step 1: Create dispatch package (PACKAGE_GENERATED)
  let dispatch = buildDispatchPackage(issue, sequenceNumber);
  
  // Step 2: Generate professional work-order email (EMAIL_GENERATED)
  dispatch = generateEmail(dispatch, issue);
  
  // Step 3: Generate structured Google Sheets payload
  dispatch = generateSheetPayload(dispatch, issue);
  
  return dispatch;
}

