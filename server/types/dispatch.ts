export interface DispatchPackage {
  dispatchId: string;
  issueId: string;
  createdAt: string;
  department: string;
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  technicalSeverity: number;
  responseSLA: string;
  repairCostToday: number;
  repairCost30Days: number;
  repairCost90Days: number;
  citizensAffected: number;
  recommendedAction: string;
  responsibleOfficer: string;
  dispatchStatus: "READY" | string;
  emailStatus: "PENDING" | "READY" | "SENT" | string;
  sheetStatus: "PENDING" | "READY" | "LOGGED" | string;
  workflowStage: "PACKAGE_GENERATED" | "EMAIL_GENERATED" | "EMAIL_SENT" | "SHEET_LOGGED" | "DISPATCH_COMPLETE";
  
  // Sprint 5 Communication Fields
  emailGeneratedAt?: string;
  emailSubject?: string;
  emailBody?: string;
  sheetPayload?: any;
  sheetGeneratedAt?: string;
}
