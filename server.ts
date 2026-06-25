import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import dotenv from "dotenv";
import { registerIssuesRoutes } from "./server/routes/issues";

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

// Register refactored modular issue routes
registerIssuesRoutes(app, { db, isFirestoreAvailable, inMemoryIssues, ai });

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
