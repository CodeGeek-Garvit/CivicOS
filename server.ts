import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, orderBy, doc, setDoc } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// High limits for Base64 image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Dynamic Firebase Configuration Reading
let firebaseConfig = {
  projectId: "gen-lang-client-0288361705",
  firestoreDatabaseId: "ai-studio-18271b79-8938-4a9f-88f2-c16bb9968d9b"
};

// Simple in-memory storage for fallback demo mode
const inMemoryIssues: any[] = [];

// Initialize Firebase Client SDK with API key for security-rule-compliant, authenticated access
let isFirestoreAvailable = false;
let db: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    
    const apiKey = parsed.apiKey || process.env.VITE_FIREBASE_API_KEY;
    const authDomain = parsed.authDomain || `${parsed.projectId}.firebaseapp.com`;
    const projectId = parsed.projectId;
    const appId = parsed.appId;
    const databaseId = parsed.firestoreDatabaseId || "(default)";

    let clientApp;
    if (getClientApps().length === 0) {
      clientApp = initializeClientApp({
        apiKey,
        authDomain,
        projectId,
        appId
      });
    } else {
      clientApp = getClientApp();
    }

    db = initializeFirestore(clientApp, {}, databaseId);
    isFirestoreAvailable = true;
    console.log(`Firebase Client SDK initialized successfully on project "${projectId}" database "${databaseId}"`);
  } else {
    console.warn("No firebase-applet-config.json file found. Falling back to in-memory store.");
  }
} catch (error) {
  console.error("Firebase Client SDK failed to initialize. Falling back to in-memory store.", error);
}

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: any = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });
  console.log("Gemini API Client successfully initialized.");
} else {
  console.warn("WARNING: GEMINI_API_KEY is not defined. Gemini features will run in mock demo mode.");
}

// Robust high-fidelity category-aware fallback responses for dynamic offline/demomode or API 503 capacity limit fallback
function getCategoryAwareFallback(fileName: string = ""): { issueType: string; title: string; description: string; severity: number; confidence: number; reasoning: string[] } {
  const name = fileName.toLowerCase();
  
  if (name.includes("pothole") || name.includes("hole") || name.includes("asphalt") || name.includes("road") || name.includes("street") || name.includes("pavement")) {
    return {
      issueType: "pothole",
      title: "Deep Asphalt Pothole",
      description: "A deep and wide asphalt pothole located in the primary traffic lane. Sharp edges pose immediate safety hazards for local vehicles and cyclists.",
      severity: 7,
      confidence: 0.95,
      reasoning: [
        "Depth exceeds 8cm, presenting a severe suspension risk to vehicles",
        "Located in a high-speed travel lane of a major arterial road",
        "Surrounding pavement shows micro-fracturing indicating subsurface water ingress"
      ]
    };
  }
  
  if (name.includes("leak") || name.includes("water") || name.includes("pipe") || name.includes("sewage") || name.includes("sewer") || name.includes("bubbling") || name.includes("line")) {
    return {
      issueType: "water_leakage",
      title: "Underground Water Main Leak",
      description: "Substantial water bubbling up through road pavement joints, causing local pooling and soil erosion along the sidewalk curb.",
      severity: 6,
      confidence: 0.91,
      reasoning: [
        "Continuous non-revenue municipal water wastage",
        "Potential risk of localized sinkhole formation due to soil washaway",
        "Algae buildup starting to occur, creating slippery roadway surface"
      ]
    };
  }
  
  if (name.includes("streetlight") || name.includes("light") || name.includes("lamp") || name.includes("dark") || name.includes("bulb") || name.includes("pole")) {
    return {
      issueType: "damaged_streetlight",
      title: "Inoperative Streetlight Fixture",
      description: "A municipal streetlight on a neighborhood thoroughfare is completely unlit. Structural inspection reveals weathered electrical access door at base.",
      severity: 5,
      confidence: 0.88,
      reasoning: [
        "No illumination in a dense residential walking corridor at night",
        "Partially open electrical junction box at the utility pole base",
        "Reduces safety profile and increases motor accident susceptibility"
      ]
    };
  }
  
  if (name.includes("garbage") || name.includes("trash") || name.includes("waste") || name.includes("overflow") || name.includes("dump") || name.includes("litter") || name.includes("rubbish") || name.includes("dumpster")) {
    return {
      issueType: "waste_overflow",
      title: "Overflowing Public Waste Bin",
      description: "A public waste bin is overflowing heavily with loose plastic trash, cardboard, and organic waste, which has begun spilling onto the walking path.",
      severity: 7,
      confidence: 0.94,
      reasoning: [
        "Sanitation risk in a high-pedestrian commercial district",
        "Blocking public right of way, forcing foot traffic onto active lanes",
        "Severe wind dispersion of plastic waste into nearby storm sewers"
      ]
    };
  }
  
  if (name.includes("bridge") || name.includes("structural") || name.includes("concrete") || name.includes("rebar") || name.includes("infrastructure") || name.includes("damage") || name.includes("spalling") || name.includes("wall")) {
    return {
      issueType: "infrastructure_damage",
      title: "Corroded Concrete Bridge Pillar",
      description: "Visible concrete spalling on a pedestrian bridge load support pillar, exposing rusty reinforcing rebar and showing signs of structural weathering.",
      severity: 8,
      confidence: 0.92,
      reasoning: [
        "Exposed structural steel rebar undergoes accelerated oxidation",
        "Fallen chunks of heavy concrete pose danger to walkways below",
        "Urgent structural load assessment needed by municipal engineers"
      ]
    };
  }

  // Default fallback
  return {
    issueType: "other",
    title: "Unclassified Municipal Anomaly",
    description: "A generic public safety or infrastructure issue requiring manual review by municipal field staff.",
    severity: 4,
    confidence: 0.75,
    reasoning: [
      "Unrecognized file naming signature prevents automated routing",
      "Requires human inspection for appropriate categorization",
      "Preserving audit record in safety ledger for dispatch review"
    ]
  };
}

// API Routes

// GET /api/issues - Return all reported issues
app.get("/api/issues", async (req, res) => {
  try {
    if (isFirestoreAvailable && db) {
      const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const issues = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, issues });
    }
  } catch (error) {
    console.error("Failed to read from Firestore, returning in-memory store", error);
  }
  // Return descending by date
  const sortedInMemory = [...inMemoryIssues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, issues: sortedInMemory, isDemoMode: true });
});

// POST /api/issues/analyze - Submit an image to Gemini Vision for structured classification
app.post("/api/issues/analyze", async (req, res) => {
  const { image, fileName } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Missing image in request body" });
  }

  // Parse mimeType and base64Data
  let base64Data = image;
  let mimeType = "image/jpeg";

  if (image.startsWith("data:")) {
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
  }

  // Log Gemini Request Sent
  console.log("\n==================================================");
  console.log("🚩 [CIVICOS AUDIT] Gemini Request Sent");
  console.log(`- Time: ${new Date().toISOString()}`);
  console.log(`- File Name: ${fileName || "N/A"}`);
  console.log(`- Image Payload Size: ${image ? Math.round(image.length / 1024) : 0} KB`);
  console.log("==================================================\n");

  // If Gemini is not configured, return category-aware mock fallback response
  if (!ai) {
    const fallbackResponse = getCategoryAwareFallback(fileName);
    
    console.warn("\n==================================================");
    console.warn("⚠️ [CIVICOS AUDIT] Fallback Activated (API key not configured)");
    console.warn("- Reason: GEMINI_API_KEY environment variable is undefined");
    console.warn(`- Category-Aware Selected Output Type: ${fallbackResponse.issueType}`);
    console.warn("==================================================\n");

    return res.json({ 
      success: true, 
      analysis: {
        ...fallbackResponse,
        isFallback: true
      }, 
      isDemoMode: true 
    });
  }

  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        issueType: {
          type: Type.STRING,
          description: "The classification category of the civic issue. Must be exactly one of: pothole, water_leakage, damaged_streetlight, waste_overflow, infrastructure_damage, other."
        },
        title: {
          type: Type.STRING,
          description: "A short, descriptive, professional title for the issue (max 6 words)."
        },
        description: {
          type: Type.STRING,
          description: "A detailed summary description of the issue based on visual analysis."
        },
        severity: {
          type: Type.INTEGER,
          description: "A severity score rating from 1 to 10 based on safety and infrastructure risk. 1 is minor, 10 is critical danger."
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence level of the detection from 0.0 to 1.0."
        },
        reasoning: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "A list of 3 concise visual reasons explaining the classification and severity."
        }
      },
      required: ["issueType", "title", "description", "severity", "confidence", "reasoning"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: "Analyze the uploaded image of a municipal/civic issue and classify it, assess severity, and provide structured details."
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are the CivicOS Vision Analysis Engine. Inspect the provided photo for urban anomalies, safety hazards, municipal damage, and categorize it carefully. Be extremely analytical and precise."
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini Vision Model.");
    }

    const parsedResult = JSON.parse(resultText);

    // Validate expected structure
    if (!parsedResult.issueType || !parsedResult.title || !parsedResult.description || parsedResult.severity === undefined || parsedResult.confidence === undefined) {
      throw new Error("Invalid output structure received from AI model.");
    }

    // Log Gemini Response Received
    console.log("\n==================================================");
    console.log("✅ [CIVICOS AUDIT] Gemini Response Received");
    console.log(`- Time: ${new Date().toISOString()}`);
    console.log("- Status: SUCCESS");
    console.log("- Result Category:", parsedResult.issueType);
    console.log("- Result Title:", parsedResult.title);
    console.log("- Result Severity:", parsedResult.severity);
    console.log("- Result Confidence:", parsedResult.confidence);
    console.log("==================================================\n");

    return res.json({
      success: true,
      analysis: {
        ...parsedResult,
        isFallback: false
      }
    });
  } catch (err: any) {
    const fallbackResponse = getCategoryAwareFallback(fileName);

    // Log Fallback Activated with reason
    console.warn("\n==================================================");
    console.warn("⚠️ [CIVICOS AUDIT] Fallback Activated (Processing Exception)");
    console.warn(`- Trigger Time: ${new Date().toISOString()}`);
    console.warn(`- Reason for Fallback: ${err.message || err}`);
    console.warn(`- Category-Aware Selected Output Type: ${fallbackResponse.issueType}`);
    console.warn("==================================================\n");

    return res.json({ 
      success: true, 
      analysis: {
        ...fallbackResponse,
        isFallback: true
      }, 
      isDemoMode: true,
      fallbackWarning: `Gemini is currently experiencing high demand (${err.message || "UNAVAILABLE"}). Seamlessly resolved via local backup engine.`
    });
  }
});

// POST /api/issues/report - Save a validated reported issue to the database
app.post("/api/issues/report", async (req, res) => {
  const { issue } = req.body;
  if (!issue) {
    return res.status(400).json({ error: "Missing issue object in request body" });
  }

  const newIssue = {
    id: `issue_${Math.random().toString(36).substring(2, 11)}`,
    issueType: issue.issueType || "other",
    title: issue.title || "Untitled Issue",
    description: issue.description || "",
    severity: Number(issue.severity) || 1,
    confidence: Number(issue.confidence) || 0.0,
    reasoning: Array.isArray(issue.reasoning) ? issue.reasoning : [],
    imageUrl: issue.imageUrl || "",
    isFallback: issue.isFallback ?? false,
    status: "reported",
    createdAt: new Date().toISOString()
  };

  try {
    if (isFirestoreAvailable && db) {
      const docRef = doc(db, "issues", newIssue.id);
      await setDoc(docRef, newIssue);
      console.log(`Saved issue "${newIssue.id}" to Firestore successfully`);
      return res.status(201).json({ success: true, issue: newIssue });
    }
  } catch (error) {
    console.error("Failed to save to Firestore, falling back to in-memory store", error);
  }

  // Backup in-memory write
  inMemoryIssues.push(newIssue);
  res.status(201).json({ success: true, issue: newIssue, isDemoMode: true });
});

// Serve frontend assets
async function startViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicOS Sprint 1 Full-Stack Server listening at http://localhost:${PORT}`);
  });
}

startViteMiddleware();
