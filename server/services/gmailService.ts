/**
 * GMAIL API OAUTH2 DISPATCH SERVICE - SETUP GUIDE & DOCUMENTATION
 * ===================================================================
 * 
 * To enable real Gmail dispatch in CivicOS, follow these steps:
 * 
 * 1. ENABLE GMAIL API:
 *    - Go to Google Cloud Console (https://console.cloud.google.com).
 *    - Select your project.
 *    - Search for "Gmail API" in the API Library and click "Enable".
 * 
 * 2. CREATE OAUTH CLIENT:
 *    - Go to APIs & Services > Credentials.
 *    - Click "Create Credentials" > "OAuth client ID".
 *    - Select application type: "Web application".
 *    - Add authorized Redirect URIs (e.g., "https://developers.google.com/oauthplayground" if using OAuth Playground).
 *    - Save to obtain your Client ID and Client Secret.
 * 
 * 3. OBTAIN REFRESH TOKEN:
 *    - Go to Google OAuth 2.0 Playground (https://developers.google.com/oauthplayground).
 *    - Click the Settings gear in the top right, check "Use your own OAuth credentials", and input your Client ID and Client Secret.
 *    - In Step 1, select "Gmail API v1" and authorize the scope: https://www.googleapis.com/auth/gmail.send
 *    - Authorize your account, exchange authorization code for tokens, and copy the "Refresh Token".
 * 
 * 4. REQUIRED ENVIRONMENT VARIABLES (set in AI Studio secrets):
 *    - GMAIL_CLIENT_ID: Your OAuth 2.0 Client ID.
 *    - GMAIL_CLIENT_SECRET: Your OAuth 2.0 Client Secret.
 *    - GMAIL_REFRESH_TOKEN: The persistent refresh token obtained in step 3.
 *    - GMAIL_DEMO_RECIPIENT: The fallback personal Gmail address for development.
 * 
 * 5. COMMON AUTHENTICATION FAILURES:
 *    - "invalid_grant": The refresh token has expired or has been revoked (re-authenticate in Playground).
 *    - "unauthorized_client" or "invalid_client": Incorrect Client ID or Client Secret.
 *    - "Access blocked: App has not completed verification": Ensure the test user account is added under "OAuth consent screen" > "Test users".
 */

import { google } from "googleapis";
import { DispatchPackage } from "../types/dispatch";
import { generateDispatchEmail } from "../templates/dispatchTemplate";

export interface SendDispatchEmailResult {
  success: boolean;
  recipient: string;
  gmailMessageId?: string;
  sentTimestamp?: string;
  error?: string;
  errorType?: "AUTH_FAILED" | "QUOTA_EXCEEDED" | "INVALID_RECIPIENT" | "NETWORK_ERROR" | "UNKNOWN";
}

/**
 * Helper to build an RFC 822 compliant MIME email with a PDF attachment.
 */
function buildMimeMessage(
  to: string,
  subject: string,
  htmlBody: string,
  pdfBase64: string,
  filename: string
): string {
  const boundary = "CivicOS_Boundary_" + Math.random().toString(36).substring(2);
  
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
  ];

  const bodyParts = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
  ];

  // Clean Base64 of any headers (e.g. "data:application/pdf;base64," or with filename attributes)
  let cleanPdfBase64 = pdfBase64;
  if (cleanPdfBase64.includes("%")) {
    try {
      cleanPdfBase64 = decodeURIComponent(cleanPdfBase64);
    } catch (e) {
      console.warn("decodeURIComponent failed, using original base64:", e);
    }
  }
  if (cleanPdfBase64.includes("base64,")) {
    cleanPdfBase64 = cleanPdfBase64.split("base64,")[1];
  }
  cleanPdfBase64 = cleanPdfBase64.replace(/[\s\r\n]+/g, "").trim();

  const attachmentParts = [
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    cleanPdfBase64,
    "",
    `--${boundary}--`,
  ];

  const fullMessage = [...headers, ...bodyParts, ...attachmentParts].join("\r\n");
  
  // Safe base64url encoding for Gmail API raw format
  return Buffer.from(fullMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sends a work order dispatch email using the official Gmail API via OAuth2.
 */
export async function sendDispatchEmail(
  dispatchPackage: DispatchPackage,
  issue: any,
  pdfBase64: string
): Promise<SendDispatchEmailResult> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  
  // Determine final recipient. Use GMAIL_DEMO_RECIPIENT or fall back to user email
  const recipient = process.env.GMAIL_DEMO_RECIPIENT || process.env.USER_EMAIL || "garvit.arpit79@gmail.com";

  console.log(`\n==================================================`);
  console.log(`✉️ [GMAIL DISPATCH SERVICE] Sending email to: ${recipient}`);
  console.log(`- Dispatch ID: ${dispatchPackage.dispatchId}`);
  console.log(`- Issue ID: ${dispatchPackage.issueId}`);
  console.log(`==================================================\n`);

  // Basic recipient validation
  if (!recipient || !recipient.includes("@")) {
    return {
      success: false,
      recipient: recipient || "Unknown",
      error: "Recipient email is invalid or missing.",
      errorType: "INVALID_RECIPIENT"
    };
  }

  // 1. Verify OAuth Credentials are provided
  if (!clientId || !clientSecret || !refreshToken) {
    console.error("❌ [GMAIL DISPATCH SERVICE] Missing OAuth2 configuration variables.");
    return {
      success: false,
      recipient,
      error: "Gmail OAuth2 credentials (Client ID, Secret, or Refresh Token) are not configured in environment variables.",
      errorType: "AUTH_FAILED"
    };
  }

  try {
    // 2. Setup OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Validate authentication by forcing token refresh (checks client secret/refresh token validity)
    try {
      await oauth2Client.getAccessToken();
    } catch (authError: any) {
      console.error("❌ [GMAIL DISPATCH SERVICE] OAuth Authentication failed:", authError);
      return {
        success: false,
        recipient,
        error: `Authentication Failed: ${authError.message || authError}`,
        errorType: "AUTH_FAILED"
      };
    }

    // 3. Initialize Gmail client
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 4. Generate email HTML content using the existing template implementation
    const templateResult = generateDispatchEmail(dispatchPackage, issue);
    
    // Explicit header/footer enhancement requirements from Sprint 11
    const finalHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; color: white; padding: 25px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">CivicOS</h2>
          <p style="margin: 3px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px;">AI Municipal Operating System</p>
          <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; font-size: 14px; font-weight: bold; color: #3b82f6;">Official Municipal Dispatch</div>
        </div>
        
        <div style="padding: 25px; background: #ffffff;">
          ${templateResult.htmlBody}
        </div>

        <div style="background-color: #f8fafc; padding: 15px 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; font-weight: 500;">
          Generated automatically by CivicOS Municipal Operations Platform
        </div>
      </div>
    `;

    // 5. Construct Multipart MIME Raw Message
    const filename = `Municipal_WorkOrder_${dispatchPackage.dispatchId}.pdf`;
    const rawMime = buildMimeMessage(recipient, templateResult.subject, finalHtml, pdfBase64, filename);

    // 6. Send via official Gmail API
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMime,
      },
    });

    const gmailMessageId = response.data.id || undefined;
    const sentTimestamp = new Date().toISOString();

    console.log(`✅ [GMAIL DISPATCH SERVICE] Success! Message ID: ${gmailMessageId}`);

    return {
      success: true,
      recipient,
      gmailMessageId,
      sentTimestamp
    };
  } catch (error: any) {
    console.error("❌ [GMAIL DISPATCH SERVICE] Sending failed:", error);
    
    // Distinguish quota, network, and general errors
    let errorType: "QUOTA_EXCEEDED" | "NETWORK_ERROR" | "UNKNOWN" = "UNKNOWN";
    const errMsg = String(error.message || error).toLowerCase();

    if (errMsg.includes("quota") || errMsg.includes("rate limit") || error.code === 429) {
      errorType = "QUOTA_EXCEEDED";
    } else if (errMsg.includes("enotfound") || errMsg.includes("etimedout") || errMsg.includes("fetch") || errMsg.includes("network")) {
      errorType = "NETWORK_ERROR";
    }

    return {
      success: false,
      recipient,
      error: error.message || String(error),
      errorType
    };
  }
}
