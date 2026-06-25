import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
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
    
    // Automatic seeding if enabled
    seedDemoDatasetIfEnabled();
  } else {
    console.warn("No firebase-applet-config.json file found. Falling back to in-memory store.");
  }
} catch (error) {
  console.error("Firebase Client SDK failed to initialize. Falling back to in-memory store.", error);
}

// Function to automatically seed approximately 40 realistic civic issues distributed across 4 Pune wards
async function seedDemoDatasetIfEnabled() {
  const useDemo = process.env.VITE_USE_DEMO_DATASET === "true" || process.env.USE_DEMO_DATASET === "true";
  if (!useDemo || !isFirestoreAvailable || !db) {
    return;
  }
  
  try {
    const q = query(collection(db, "issues"));
    const snap = await getDocs(q);
    if (snap.size > 2) {
      console.log(`[CIVICOS SEEDER] Database already contains ${snap.size} issues. Skipping automatic demo dataset seeding.`);
      return;
    }
    
    console.log("[CIVICOS SEEDER] Database empty or has minimal records. Seeding 40 realistic issues distributed across 4 Pune wards...");
    
    const wards = [
      { name: "Shivajinagar", centerLat: 18.525, centerLng: 73.845 },
      { name: "Kothrud", centerLat: 18.505, centerLng: 73.815 },
      { name: "Viman Nagar", centerLat: 18.562, centerLng: 73.912 },
      { name: "Hadapsar", centerLat: 18.502, centerLng: 73.928 }
    ];
    
    const issueTemplates = [
      {
        issueType: "pothole",
        titles: [
          "Clogged storm drain causing localized road degradation",
          "Deep multi-pot structural asphalt cracking",
          "Unfinished utility road-cut subsidence",
          "Deep structural pavement cavity on main thoroughfare",
          "Deteriorating service road with active gravel stripping"
        ],
        descriptions: [
          "A series of continuous, deep asphalt depressions along the high-traffic corridor, exposing road-bed gravel and causing rapid vehicle braking maneuvers.",
          "Substantial structural cracking and localized pavement crumbling in the center lane of the road. Risk of severe suspension damage to passing light vehicles.",
          "Unrepaired trench from telecom cabling works has collapsed by 10cm, creating a sharp drop-off across the lane width.",
          "Dangerous, deep pothole with sharp vertical edges in the center of the lane. Water collects inside, hiding its depth from night traffic."
        ],
        reasoning: [
          "Continuous high-load public bus traffic accelerating structural roadbed wear",
          "High moisture retention due to compromised local drainage lines",
          "Creates extreme swerving hazards for two-wheelers in high-traffic periods",
          "Visible structural fatigue in surrounding asphalt base layers"
        ],
        minSev: 6, maxSev: 9,
        imageUrls: [
          "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80",
          "https://images.unsplash.com/photo-1599740831146-5a79f7d4d39c?auto=format&fit=crop&w=400&q=80"
        ]
      },
      {
        issueType: "water_leakage",
        titles: [
          "Underground municipal distribution line fracture",
          "Water meter manifold joint failure with high-pressure spray",
          "Compromised sewage lateral leaking into drainage ditch",
          "Constant municipal pipe leakage bubbling through pavement joints",
          "Sewer access manhole overflow"
        ],
        descriptions: [
          "Significant potable water continuously bubbling through asphalt joints, creating a permanent stream of run-off down the gutter and eroding the pavement subbase.",
          "A major municipal connection pipe joint has ruptured. High-pressure clean water is pooling into the adjacent sidewalk and residential driveway.",
          "A slow but persistent leak from an old distribution main. Has created a permanent muddy slip-hazard on the concrete pedestrian walkway.",
          "Foul-smelling water overflowing from a blocked sewer access point. Organic waste depositing on the roadway lane edges."
        ],
        reasoning: [
          "Non-revenue clean municipal water being lost at an estimated 20 liters per minute",
          "High risk of undermining the structural integrity of the surrounding asphalt roadway",
          "Standing water has initiated algae growth, creating a slip hazard for pedestrians",
          "Requires immediate valves isolation and joint sleeve replacement by water department"
        ],
        minSev: 5, maxSev: 8,
        imageUrls: [
          "https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&w=400&q=80"
        ]
      },
      {
        issueType: "damaged_streetlight",
        titles: [
          "Inoperative main avenue streetlight pole",
          "Flickering high-voltage public safety luminaire",
          "Exposed electrical wiring at base of utility pole",
          "Storm-damaged street light bracket leaning over road",
          "Entire dark block due to circuit control failure"
        ],
        descriptions: [
          "A critical public light fixture is completely burnt out, leaving a key pedestrian crossing and blind curve in complete darkness during night hours.",
          "Unsecured, rusted junction panel at the base of the metal streetlight pole has exposed bare copper terminals within easy reach of the sidewalk.",
          "Street lamp luminaire is heavily flickering or unlit, severely reducing the security profile of the narrow residential alleyway.",
          "A physical collision has damaged the pole bracket, causing the heavy light fixture to hang precariously above the active bike lane."
        ],
        reasoning: [
          "Increases risk of pedestrian-vehicle collisions at the unlit intersection",
          "Exposed live wiring poses an immediate electrocution hazard, especially during rainy conditions",
          "Dark zone encourages illegal dumping and safety issues on this secluded walkway",
          "Structural damage to the mounting bracket requires emergency cherry-picker dispatch"
        ],
        minSev: 4, maxSev: 7,
        imageUrls: []
      },
      {
        issueType: "waste_overflow",
        titles: [
          "Overflowing municipal secondary dump station",
          "Illegal commercial dumping on public right-of-way",
          "Compromised public trash receptacle with wind dispersion",
          "Unattended organic and plastic waste heap at roadside",
          "Decomposing food market waste pile blocking sidewalk"
        ],
        descriptions: [
          "A large pile of mixed domestic, plastic, and organic waste has accumulated around a saturated green public bin, spreading into the active roadway lane.",
          "Construction debris, plastic bags, and household furniture have been illegally dumped overnight along the vacant public land margin.",
          "Public waste container is full beyond capacity. Winds are actively carrying plastic bags and food wrappers into the stormwater drainage grates.",
          "Uncollected organic market waste has begun decaying, creating severe odors and attracting insect vectors adjacent to the residential colony gates."
        ],
        reasoning: [
          "Significant public health and sanitation hazard in high-density neighborhood",
          "Wind-blown plastics are actively entering the storm drainage system, risking future waterlogging",
          "Forcing school children to walk on the active vehicular lane due to sidewalk blockage",
          "Encourages stray animal activity which poses minor traffic hazards"
        ],
        minSev: 5, maxSev: 8,
        imageUrls: [
          "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80"
        ]
      },
      {
        issueType: "infrastructure_damage",
        titles: [
          "Structural spalling on concrete footbridge column",
          "Collapsed safety guardrail on bridge elevated ramp",
          "Severely cracked storm water drainage canal wall",
          "Unsecured municipal excavation pit without protective barriers",
          "Compromised retaining wall showing active tilt"
        ],
        descriptions: [
          "Concrete spalling has exposed heavily corroded structural steel rebar inside the pedestrian overpass column, showing visible structural degradation.",
          "A segment of the safety guardrail has been completely broken off on an elevated road curve, leaving an unprotected 4-meter drop-off over the railway line.",
          "The concrete wall of the stormwater channel has cracked and shifted outwards, risking a structural collapse that would block the drainage route.",
          "An excavation pit dug for municipal plumbing remains completely open on a dark street corner with no warning signs, barricades, or lights."
        ],
        reasoning: [
          "Compromised structural column requires immediate load capacity engineering inspection",
          "Absence of safety barriers creates extreme hazard for pedestrians and motorized two-wheelers",
          "Erosion of support soil behind the cracked canal wall could trigger localized road subsidence",
          "Urgent retrofitting of physical barricades and blinkers required to prevent severe falls"
        ],
        minSev: 7, maxSev: 10,
        imageUrls: []
      }
    ];
    
    let seededCount = 0;
    
    for (let i = 0; i < 40; i++) {
      const template = issueTemplates[i % issueTemplates.length];
      const ward = wards[Math.floor(i / 10) % wards.length];
      
      const spreadLat = (Math.random() - 0.5) * 0.015;
      const spreadLng = (Math.random() - 0.5) * 0.015;
      const latitude = Number((ward.centerLat + spreadLat).toFixed(6));
      const longitude = Number((ward.centerLng + spreadLng).toFixed(6));
      
      const title = template.titles[i % template.titles.length];
      const description = template.descriptions[i % template.descriptions.length];
      const severity = Math.floor(Math.random() * (template.maxSev - template.minSev + 1)) + template.minSev;
      const confidence = Number((0.80 + Math.random() * 0.18).toFixed(2));
      
      const daysAgo = Math.random() * 14;
      const date = new Date();
      date.setMilliseconds(date.getMilliseconds() - daysAgo * 24 * 60 * 60 * 1000);
      const createdAt = date.toISOString();
      
      const status = Math.random() > 0.6 ? (Math.random() > 0.5 ? "resolved" : "in_progress") : "reported";
      
      const id = `issue_mock_${i + 1}`;
      
      const newIssue = {
        id,
        issueType: template.issueType,
        title: `${ward.name} Ward: ${title}`,
        description,
        severity,
        confidence,
        reasoning: template.reasoning,
        imageUrl: template.imageUrls[Math.floor(Math.random() * template.imageUrls.length)] || "",
        isFallback: false,
        status,
        createdAt,
        location: {
          latitude,
          longitude
        },
        ward: ward.name,
        isDemoMode: true
      };
      
      const docRef = doc(db, "issues", id);
      await setDoc(docRef, newIssue);
      seededCount++;
    }
    
    console.log(`[CIVICOS SEEDER] Seeded ${seededCount} realistic issues in Firestore across 4 wards successfully.`);
  } catch (error) {
    console.error("[CIVICOS SEEDER] Seeding failed:", error);
  }
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
function getCategoryAwareFallback(fileName: string = ""): {
  issueType: string;
  title: string;
  description: string;
  severity: number;
  confidence: number;
  scores: {
    safetyRisk: number;
    infrastructureDamage: number;
    publicImpact: number;
    urgency: number;
  };
  reasoning: string[];
} {
  const name = fileName.toLowerCase();
  
  if (name.includes("pothole") || name.includes("hole") || name.includes("asphalt") || name.includes("road") || name.includes("street") || name.includes("pavement")) {
    return {
      issueType: "pothole",
      title: "Deep Asphalt Pothole",
      description: "A deep and wide asphalt pothole located in the primary traffic lane. Sharp edges pose immediate safety hazards for local vehicles and cyclists.",
      severity: 7,
      confidence: 0.95,
      scores: {
        safetyRisk: 6,
        infrastructureDamage: 7,
        publicImpact: 7,
        urgency: 7
      },
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
      scores: {
        safetyRisk: 4,
        infrastructureDamage: 6,
        publicImpact: 5,
        urgency: 5
      },
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
      scores: {
        safetyRisk: 5,
        infrastructureDamage: 3,
        publicImpact: 4,
        urgency: 4
      },
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
      scores: {
        safetyRisk: 5,
        infrastructureDamage: 2,
        publicImpact: 8,
        urgency: 6
      },
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
      scores: {
        safetyRisk: 7,
        infrastructureDamage: 8,
        publicImpact: 6,
        urgency: 8
      },
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
    scores: {
      safetyRisk: 3,
      infrastructureDamage: 3,
      publicImpact: 3,
      urgency: 3
    },
    reasoning: [
      "Unrecognized file naming signature prevents automated routing",
      "Requires human inspection for appropriate categorization",
      "Preserving audit record in safety ledger for dispatch review"
    ]
  };
}

// API Routes

// GET /api/firebase-config - Returns Client SDK config for realtime listeners
app.get("/api/firebase-config", (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw);
      return res.json({
        success: true,
        config: {
          apiKey: parsed.apiKey || process.env.VITE_FIREBASE_API_KEY,
          authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
          projectId: parsed.projectId,
          appId: parsed.appId,
          databaseId: parsed.firestoreDatabaseId || "(default)"
        }
      });
    }
  } catch (error: any) {
    console.error("Failed to read firebase-applet-config.json for frontend client:", error);
  }
  res.status(500).json({ success: false, error: "Firebase Client configuration not found or failed to load." });
});

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

  // Check API Key Presence & Security Check
  const apiKeyExists = !!process.env.GEMINI_API_KEY;
  const maskedApiKey = apiKeyExists 
    ? `${process.env.GEMINI_API_KEY!.slice(0, 8)}...${process.env.GEMINI_API_KEY!.slice(-4)}`
    : "NOT_CONFIGURED";

  const payloadSizeKb = Math.round(image.length / 1024);

  // Log Gemini Request Sent (Production Diagnostics Start)
  console.log("\n🔍 ==================================================");
  console.log("🚩 [GEMINI DIAGNOSTICS] Pipeline Execution Started");
  console.log(`- Trigger Time: ${new Date().toISOString()}`);
  console.log(`- File Name: ${fileName || "N/A"}`);
  console.log(`- Mime Type: ${mimeType}`);
  console.log(`- Payload Size: ${payloadSizeKb} KB`);
  console.log(`- Is API Key Configured: ${apiKeyExists} (Masked: ${maskedApiKey})`);
  console.log(`- Model Selected: gemini-2.5-flash`);
  console.log("==================================================\n");

  // If Gemini is not configured, return category-aware mock fallback response
  if (!ai) {
    const fallbackResponse = getCategoryAwareFallback(fileName);
    
    console.warn("\n⚠️ ==================================================");
    console.warn("⚠️ [GEMINI DIAGNOSTICS] Local Fallback Activated (No API Key)");
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

  let requestInitiated = false;
  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        issueType: {
          type: Type.STRING,
          description: "The classification category of the civic issue. Must be exactly one of: pothole, waste_overflow, damaged_streetlight, water_leakage, infrastructure_damage, illegal_dumping, drainage_issue, road_damage, fallen_tree, traffic_signal_damage, unknown."
        },
        title: {
          type: Type.STRING,
          description: "A short, descriptive, professional title for the issue (max 6 words)."
        },
        description: {
          type: Type.STRING,
          description: "A detailed summary description under 80 words detailing ONLY what is actually visible."
        },
        severity: {
          type: Type.INTEGER,
          description: "An overall severity score rating from 1 to 10 based on safety and infrastructure risk guidelines. 1-2: cosmetic, 3-4: routine, 5-6: moderate, 7-8: serious, 9-10: critical."
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence level of the detection from 0.0 to 1.0 representing analysis certainty."
        },
        scores: {
          type: Type.OBJECT,
          properties: {
            safetyRisk: {
              type: Type.INTEGER,
              description: "How likely someone could be injured immediately (0 to 10)."
            },
            infrastructureDamage: {
              type: Type.INTEGER,
              description: "How badly the infrastructure itself is damaged (0 to 10)."
            },
            publicImpact: {
              type: Type.INTEGER,
              description: "How many citizens are likely affected (0 to 10)."
            },
            urgency: {
              type: Type.INTEGER,
              description: "How quickly repair is needed (0 to 10)."
            }
          },
          required: ["safetyRisk", "infrastructureDamage", "publicImpact", "urgency"]
        },
        reasoning: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "Provide exactly 3 concise reasoning bullets, referencing only what is actually visible."
        }
      },
      required: ["issueType", "title", "description", "severity", "confidence", "scores", "reasoning"]
    };

    console.log("🚀 [GEMINI DIAGNOSTICS] Dispatching Request to Gemini API...");
    requestInitiated = true;

    const systemInstruction = `You are CivicOS Vision Engine v2.
You are NOT merely an image classifier.
You are an experienced Municipal Infrastructure Engineer responsible for triaging citizen complaints for a Smart City Command Center.
Your job is to inspect ONE uploaded image and produce an objective engineering assessment.
Do NOT exaggerate severity.
Only assign high severity when there is evidence of immediate danger or critical infrastructure failure.

-----------------------------------------
STEP 1 — Identify the Issue
-----------------------------------------
Determine the single most appropriate issue category.
Allowed values:
- pothole
- waste_overflow
- damaged_streetlight
- water_leakage
- infrastructure_damage
- illegal_dumping
- drainage_issue
- road_damage
- fallen_tree
- traffic_signal_damage
- unknown

If uncertain, choose the closest category.

-----------------------------------------
STEP 2 — Describe the Evidence
-----------------------------------------
Describe ONLY what is actually visible.
Do NOT invent objects.
Do NOT assume things hidden from view.
Mention:
• visible damage
• approximate size
• affected infrastructure
• environmental context

Keep description under 80 words.

-----------------------------------------
STEP 3 — Assess Five Independent Factors
-----------------------------------------
Assign each score between 0 and 10.
SafetyRisk
How likely someone could be injured immediately.
InfrastructureDamage
How badly the infrastructure itself is damaged.
PublicImpact
How many citizens are likely affected.
Urgency
How quickly repair is needed.
Confidence
How certain you are based only on the image.
Confidence is NOT severity.
Confidence reflects certainty of your analysis.
Examples:
Clear image: 0.95–1.00
Slight blur: 0.80
Night image: 0.65
Partially hidden object: 0.60
Unknown object: 0.45

-----------------------------------------
STEP 4 — Compute Overall Severity
-----------------------------------------
Use these engineering guidelines.
1–2: Cosmetic issue. No public danger. Examples: Minor paint damage, Small stain, Litter
3–4: Routine maintenance. Examples: Small sidewalk crack, Minor garbage, Dirty sign, Small vegetation growth
5–6: Moderate hazard. Needs scheduled repair. Examples: Broken footpath, Small pothole, Partially damaged streetlight, Moderate leakage, Overflowing bin
7–8: Serious hazard. Requires prompt repair. Examples: Large pothole, Major water leakage, Collapsed pavement, Broken traffic signal, Large illegal dumping
9–10: Critical emergency. Immediate public danger. Examples: Live exposed electrical wires, Road collapse, Sinkhole, Burst water main flooding road, Fallen power pole, Bridge structural failure, Traffic signal completely non-functional at busy intersection
Only assign 9 or 10 when there is clear evidence of immediate danger.

-----------------------------------------
STEP 5 — Explain the Decision
-----------------------------------------
Provide exactly 3 concise reasoning bullets.
Each bullet must reference something actually visible.

-----------------------------------------
OUTPUT
-----------------------------------------
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: "Analyze the uploaded image of a municipal/civic issue according to engineering guidelines and output structured assessment JSON."
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
        systemInstruction: systemInstruction
      }
    });

    console.log("📬 [GEMINI DIAGNOSTICS] Received API response payload");
    const resultText = response.text;
    console.log(`- Raw Response Output:\n--------------------\n${resultText}\n--------------------`);

    if (!resultText) {
      throw new Error("Empty response from Gemini Vision Model.");
    }

    const parsedResult = JSON.parse(resultText);
    console.log("- Parsed JSON successfully:", JSON.stringify(parsedResult, null, 2));

    // Validate expected structure
    if (!parsedResult.issueType || !parsedResult.title || !parsedResult.description || parsedResult.severity === undefined || parsedResult.confidence === undefined) {
      throw new Error("Invalid output structure received from AI model.");
    }

    // Log Gemini Response Received
    console.log("\n✅ ==================================================");
    console.log("✅ [GEMINI DIAGNOSTICS] Gemini Response Processed Successfully!");
    console.log(`- Time: ${new Date().toISOString()}`);
    console.log("- Status: SUCCESS (No Fallback Required)");
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
    const errorMessage = err.message || String(err);
    const errorStack = err.stack || "No stack trace available";
    const errorStatus = err.status || err.statusCode || (err.response ? err.response.status : undefined);

    // Classify the precise error type
    let errorCategory = "Unknown Error";
    if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT") || errorMessage.includes("API key") || errorMessage.includes("unauthorized") || errorStatus === 401 || errorStatus === 403) {
      errorCategory = "Authentication error";
    } else if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("model not found") || errorMessage.includes("not found") || errorStatus === 503 || errorStatus === 404) {
      errorCategory = "Model unavailable";
    } else if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Rate limit") || errorMessage.includes("quota") || errorStatus === 429) {
      errorCategory = "Rate limit";
    } else if (errorMessage.includes("SAFETY") || errorMessage.includes("blocked") || errorMessage.includes("finishReason") || errorMessage.includes("safety")) {
      errorCategory = "Safety block";
    } else if (err instanceof SyntaxError || errorMessage.includes("JSON") || errorMessage.includes("parse") || errorMessage.includes("Invalid output structure")) {
      errorCategory = "Parsing error";
    } else if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("ETIMEDOUT") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
      errorCategory = "Network error";
    } else if (errorStatus === 400 || errorMessage.includes("400") || errorMessage.includes("bad request") || errorMessage.includes("Invalid request")) {
      errorCategory = "Invalid request";
    }

    // Log Fallback Activated with extremely rich diagnostic data
    console.error("\n❌ ==================================================");
    console.error("⚠️ [GEMINI DIAGNOSTICS] Pipeline Error Caught!");
    console.error(`- Classification: ${errorCategory}`);
    console.error(`- Trigger Time: ${new Date().toISOString()}`);
    console.error(`- Exception Type: ${err.constructor ? err.constructor.name : "Unknown"}`);
    console.error(`- Message: ${errorMessage}`);
    console.error(`- HTTP Status Code: ${errorStatus || "N/A"}`);
    console.error(`- Request Dispatched to Gemini: ${requestInitiated ? "Yes (Failed during API call or Parsing)" : "No (Failed before request)"}`);
    console.error(`- Fallback Category Selection: ${fallbackResponse.issueType}`);
    console.error("- Stack Trace:\n", errorStack);
    console.error("==================================================\n");

    return res.json({ 
      success: true, 
      analysis: {
        ...fallbackResponse,
        isFallback: true
      }, 
      isDemoMode: true,
      fallbackWarning: `Gemini pipeline encountered ${errorCategory} (${errorMessage}). Resolved seamlessly using client fallback mapping.`
    });
  }
});

// POST /api/issues/report - Save a validated reported issue to the database
app.post("/api/issues/report", async (req, res) => {
  const { issue } = req.body;
  if (!issue) {
    return res.status(400).json({ error: "Missing issue object in request body" });
  }

  // Pune center coordinates: Lat 18.5204, Lng 73.8567
  const generatePuneCoordinate = () => {
    const centerLat = 18.5204;
    const centerLng = 73.8567;
    const spreadLat = (Math.random() - 0.5) * 0.04;
    const spreadLng = (Math.random() - 0.5) * 0.04;
    return {
      latitude: Number((centerLat + spreadLat).toFixed(6)),
      longitude: Number((centerLng + spreadLng).toFixed(6))
    };
  };

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
    createdAt: new Date().toISOString(),
    location: (issue.location && typeof issue.location.latitude === "number" && typeof issue.location.longitude === "number")
      ? { latitude: issue.location.latitude, longitude: issue.location.longitude }
      : generatePuneCoordinate()
  };

  console.log("\n==================================================");
  console.log("📥 [CIVICOS SAVE PIPELINE] Backend Request Received");
  console.log(`- Time: ${new Date().toISOString()}`);
  console.log(`- ID: ${newIssue.id}`);
  console.log(`- Category: ${newIssue.issueType}`);
  console.log(`- Title: ${newIssue.title}`);
  console.log("==================================================\n");

  if (!isFirestoreAvailable || !db) {
    const errorMsg = "Firestore is not configured or unavailable.";
    console.error("\n==================================================");
    console.error("❌ [CIVICOS SAVE PIPELINE] Firestore Write Failed");
    console.error(`- Reason: ${errorMsg}`);
    console.error("==================================================\n");
    return res.status(503).json({
      success: false,
      error: errorMsg
    });
  }

  try {
    console.log("\n==================================================");
    console.log("💾 [CIVICOS SAVE PIPELINE] Firestore Write Started");
    console.log(`- Target Collection: issues`);
    console.log(`- Firestore Document ID: ${newIssue.id}`);
    console.log("==================================================\n");

    const docRef = doc(db, "issues", newIssue.id);
    await setDoc(docRef, newIssue);

    console.log("\n==================================================");
    console.log("✅ [CIVICOS SAVE PIPELINE] Firestore Write Successful");
    console.log(`- Firestore Document ID: ${newIssue.id}`);
    console.log("==================================================\n");

    // Immediately fetch the document and verify that it exists
    console.log("\n==================================================");
    console.log("🔍 [CIVICOS SAVE PIPELINE] Verification: Fetching written document...");
    console.log("==================================================\n");

    const verifySnap = await getDoc(docRef);
    if (verifySnap.exists()) {
      const verifyData = verifySnap.data();
      console.log("\n==================================================");
      console.log("🏆 [CIVICOS SAVE PIPELINE] Verification Successful");
      console.log(`- Document ID "${verifySnap.id}" verified in Firestore.`);
      console.log(`- Fields Match: ${verifyData.title === newIssue.title && verifyData.issueType === newIssue.issueType ? "YES" : "NO"}`);
      console.log("==================================================\n");
      
      return res.status(201).json({ 
        success: true, 
        issue: newIssue,
        verifiedInFirestore: true,
        firestorePath: `issues/${newIssue.id}`
      });
    } else {
      throw new Error("Immediately-fetched document does not exist in Firestore after successful write.");
    }

  } catch (error: any) {
    console.error("\n==================================================");
    console.error("❌ [CIVICOS SAVE PIPELINE] Firestore Write Failed");
    console.error(`- Firestore Document ID: ${newIssue.id}`);
    console.error(`- Reason: ${error.message || error}`);
    console.error("==================================================\n");

    return res.status(500).json({
      success: false,
      error: `Firestore Write Failed: ${error.message || error}`
    });
  }
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
