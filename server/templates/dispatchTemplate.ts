import { DispatchPackage } from "../types/dispatch";

export interface EmailTemplateResult {
  subject: string;
  body: string;
  htmlBody: string;
}

export function generateDispatchEmail(dispatch: DispatchPackage, issue: any): EmailTemplateResult {
  const priorityLevelStr = String(dispatch.priorityLevel || "MEDIUM").toUpperCase();
  const subject = `[CivicOS Dispatch] ${dispatch.dispatchId || "CIV-DSP-000000"} | ${issue.title || issue.issueType || "Municipal Issue"} | Priority ${priorityLevelStr}`;

  const coords = (issue.location && typeof issue.location.latitude === "number" && typeof issue.location.longitude === "number")
    ? `${issue.location.latitude.toFixed(6)}, ${issue.location.longitude.toFixed(6)}`
    : "Not specified";

  const confidenceScore = (typeof issue.confidence === "number")
    ? `${(issue.confidence * 100).toFixed(0)}%` 
    : (typeof issue.analysisConfidence === "number" ? `${(issue.analysisConfidence * 100).toFixed(0)}%` : "85%");

  // Resilient fallback-safe parameters for backward compatibility with legacy Pune incidents
  const repairCostToday = typeof dispatch.repairCostToday === "number"
    ? dispatch.repairCostToday
    : (issue.costOfInaction?.repairCostNow ?? 4500);

  const repairCost30Days = typeof dispatch.repairCost30Days === "number"
    ? dispatch.repairCost30Days
    : (issue.costOfInaction?.repairCost30Days ?? Math.round(repairCostToday * 2.1));

  const repairCost90Days = typeof dispatch.repairCost90Days === "number"
    ? dispatch.repairCost90Days
    : (issue.costOfInaction?.repairCost90Days ?? Math.round(repairCostToday * 5.8));

  const citizensAffected = typeof dispatch.citizensAffected === "number"
    ? dispatch.citizensAffected
    : (issue.costOfInaction?.estimatedCitizensAffected ?? 150);

  const costToday = repairCostToday.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const cost30 = repairCost30Days.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const cost90 = repairCost90Days.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const costDifference30 = (repairCost30Days - repairCostToday).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const costDifference90 = (repairCost90Days - repairCostToday).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  const aiSummary = issue.rationale || (issue.reasoning && Array.isArray(issue.reasoning) ? issue.reasoning.join(". ") : "Progressive physical and structural deterioration identified requiring immediate intervention.");

  const evidenceImage = issue.imageUrl || "No evidence image link provided";

  const body = `
======================================================================
MUNICIPAL OPERATIONS & DISPATCH DIVISION - WORK ORDER
======================================================================
Dispatch ID:          ${dispatch.dispatchId || "CIV-DSP-000000"}
Incident ID:          ${dispatch.issueId || issue.id || "N/A"}
Generated On:         ${dispatch.createdAt || new Date().toISOString()}
Workflow Stage:       ${dispatch.workflowStage || "PACKAGE_GENERATED"}
----------------------------------------------------------------------
DEPARTMENTAL ASSIGNMENT
----------------------------------------------------------------------
Responsible Dept:     ${dispatch.department || "General Roads"}
Responsible Officer:  ${dispatch.responsibleOfficer || "Shri. Vijaykumar Shinde (Lead Operations Officer, PMC)"}
Response SLA:         ${dispatch.responseSLA || "24 Hours"}
----------------------------------------------------------------------
INCIDENT SPECIFICATIONS
----------------------------------------------------------------------
Issue Title:          ${issue.title || "Untitled Incident"}
Issue Type:           ${issue.issueType || "Other"}
Priority Level:       ${dispatch.priorityLevel || "HIGH"}
Technical Severity:   ${dispatch.technicalSeverity || 5}/10
Confidence Score:     ${confidenceScore}
Citizens Affected:    ~${citizensAffected} per day
Location:             City: ${issue.city || "Pune"}, State: ${issue.state || "Maharashtra"}, Country: ${issue.country || "India"}
Coordinates:          ${coords}
Evidence Image Link:  ${evidenceImage}
Description:          ${issue.description || "No description provided."}
----------------------------------------------------------------------
AI ENGINEERING SUMMARY
----------------------------------------------------------------------
${aiSummary}
----------------------------------------------------------------------
OPERATIONAL DIRECTION & ACTION
----------------------------------------------------------------------
Recommended Action:   ${dispatch.recommendedAction || "Dispatch authorized field crews immediately."}
----------------------------------------------------------------------
FINANCIAL REPAIR & DELAY SUMMARY (COST OF INACTION)
----------------------------------------------------------------------
Estimated Repair Cost Today:  ${costToday}
Projected Cost in 30 Days:    ${cost30} (Delay Penalty: +${costDifference30})
Projected Cost in 90 Days:    ${cost90} (Delay Penalty: +${costDifference90})
Risk Escalation Level:        ${issue.costOfInaction?.riskEscalation || "MEDIUM"}
----------------------------------------------------------------------
CONFIDENTIALITY NOTICE: This is an official municipal dispatch transmittal.
It is intended solely for authorized contractors and departmental officers.
======================================================================
`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">CivicOS Dispatch System</h2>
    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Official Municipal Work Order</p>
  </div>
  
  <div style="padding: 24px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
      <div>
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Dispatch ID</span>
        <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${dispatch.dispatchId || "CIV-DSP-000000"}</div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Incident ID</span>
        <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${dispatch.issueId || issue.id || "N/A"}</div>
      </div>
    </div>
 
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 6px 0; font-weight: bold; width: 35%;">Issue Title:</td>
        <td style="padding: 6px 0;">${issue.title || "Untitled Incident"}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Responsible Department:</td>
        <td style="padding: 6px 0;">${dispatch.department || "General Roads"}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Responsible Officer:</td>
        <td style="padding: 6px 0;">${dispatch.responsibleOfficer || "Shri. Vijaykumar Shinde (Lead Operations Officer, PMC)"}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Response SLA:</td>
        <td style="padding: 6px 0; color: #dc2626; font-weight: bold;">${dispatch.responseSLA || "24 Hours"}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Priority Level:</td>
        <td style="padding: 6px 0;"><span style="background-color: ${(dispatch.priorityLevel || "HIGH") === "CRITICAL" ? "#fee2e2" : "#fef3c7"}; color: ${(dispatch.priorityLevel || "HIGH") === "CRITICAL" ? "#991b1b" : "#92400e"}; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">${dispatch.priorityLevel || "HIGH"}</span></td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Technical Severity:</td>
        <td style="padding: 6px 0;">${dispatch.technicalSeverity || 5}/10 (Confidence: ${confidenceScore})</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: bold;">Generated On:</td>
        <td style="padding: 6px 0; color: #64748b;">${dispatch.createdAt || new Date().toISOString()}</td>
      </tr>
    </table>
 
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0;">
      <h4 style="margin: 0 0 6px 0; color: #1d4ed8; font-size: 14px; text-transform: uppercase;">Recommended Action Plan</h4>
      <p style="margin: 0; font-size: 14px;">${dispatch.recommendedAction || "Dispatch authorized field crews immediately."}</p>
    </div>
 
    <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; background-color: #fdfdfd;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Incident Description</h4>
      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Issue Type:</strong> ${issue.issueType || "Other"}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Location:</strong> ${issue.city || "Pune"}, ${issue.state || "Maharashtra"} (Coordinates: ${coords})</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569;">${issue.description || "No description provided."}</p>
      ${issue.imageUrl ? `<p style="margin: 0; font-size: 13px;"><strong>Evidence Attachment:</strong> <a href="${issue.imageUrl}" style="color: #3b82f6; text-decoration: underline;">View Uploaded Photo</a></p>` : ""}
    </div>
 
    <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; background-color: #f8fafc;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">AI Engineering Summary</h4>
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5; font-style: italic;">${aiSummary}</p>
    </div>
 
    <div style="border: 1px solid #fca5a5; border-radius: 6px; padding: 16px; background-color: #fff5f5; margin-bottom: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #991b1b; border-bottom: 1px solid #fecaca; padding-bottom: 6px;">Cost of Inaction Analysis</h4>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0;">Estimated Repair Today:</td>
          <td style="padding: 4px 0; font-weight: bold; text-align: right;">${costToday}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #991b1b;">Projected Repair in 30 Days:</td>
          <td style="padding: 4px 0; font-weight: bold; text-align: right; color: #991b1b;">${cost30} (+${costDifference30})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #991b1b;">Projected Repair in 90 Days:</td>
          <td style="padding: 4px 0; font-weight: bold; text-align: right; color: #991b1b;">${cost90} (+${costDifference90})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold;">Daily Public Impact:</td>
          <td style="padding: 4px 0; font-weight: bold; text-align: right; color: #dc2626;">~${citizensAffected} Citizens Affected</td>
        </tr>
      </table>
    </div>
  </div>
  
  <div style="background-color: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
    CONFIDENTIALITY NOTICE: This is an official automated dispatch work order generated by CivicOS.<br/>
    Unauthorized distribution, modification or use is strictly prohibited.
  </div>
</div>
`;

  return { subject, body, htmlBody };
}
