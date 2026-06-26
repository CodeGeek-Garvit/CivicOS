import { Request, Response } from "express";
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { systemInstruction, promptText, visionPromptSchema } from "../prompts/visionPrompt";
import { computeTechnicalSeverity, computeDeterministicConfidence } from "../engines/scoringEngine";
import { computeOperationalPriority } from "../engines/priorityEngine";
import { getResponsibleDepartment } from "../engines/departmentEngine";
import { getResponseSLA } from "../engines/slaEngine";

// Fallback logic representing a realistic perception engine response
function getCategoryAwareFallbackPerception(fileName: string = "") {
  const name = fileName.toLowerCase();
  
  if (name.includes("pothole") || name.includes("hole") || name.includes("asphalt") || name.includes("road") || name.includes("street") || name.includes("pavement")) {
    return {
      issueType: "pothole",
      title: "Arterial Road Pothole",
      description: "A deep and wide asphalt pothole located in the primary traffic lane. Sharp edges pose immediate safety hazards for local vehicles and cyclists.",
      affectedAsset: "road",
      estimatedRepairType: "patch",
      damageExtent: "moderate",
      roadBlocked: false,
      pedestrianHazard: false,
      vehicleHazard: true,
      standingWater: false,
      activeLeak: false,
      electricalHazard: false,
      structuralDamage: false,
      estimatedAffectedArea: "medium",
      estimatedScale: "medium",
      obstructionLevel: "partial",
      repairComplexity: "moderate",
      publicExposure: "busy road",
      hazardDurationEstimate: "ongoing",
      objectStability: "deteriorating",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "high",
      multipleIssuesDetected: false,
      visibleObjects: ["pothole", "asphalt", "road marking"],
      geminiConfidenceRaw: 0.95,
      reasoning: [
        "Depth exceeds 8cm, presenting a severe suspension risk to vehicles",
        "Located in a high-speed travel lane of a major arterial road",
        "Pavement fatigue cracking surrounds the primary point of failure"
      ]
    };
  } else if (name.includes("leak") || name.includes("water") || name.includes("pipe") || name.includes("burst") || name.includes("hydrant") || name.includes("flow")) {
    return {
      issueType: "water_leakage",
      title: "Water Service Line Leak",
      description: "Substantial water bubbling up through road pavement joints, causing local pooling and soil erosion along the sidewalk curb.",
      affectedAsset: "water_pipe",
      estimatedRepairType: "replace",
      damageExtent: "moderate",
      roadBlocked: false,
      pedestrianHazard: true,
      vehicleHazard: false,
      standingWater: true,
      activeLeak: true,
      electricalHazard: false,
      structuralDamage: false,
      estimatedAffectedArea: "medium",
      estimatedScale: "medium",
      obstructionLevel: "partial",
      repairComplexity: "moderate",
      publicExposure: "commercial",
      hazardDurationEstimate: "recent",
      objectStability: "stable",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "high",
      multipleIssuesDetected: false,
      visibleObjects: ["flowing water", "pavement", "curb"],
      geminiConfidenceRaw: 0.91,
      reasoning: [
        "Continuous non-revenue municipal water wastage",
        "Potential risk of localized sinkhole formation due to soil washaway",
        "Surface water accumulation causes slick driving conditions"
      ]
    };
  } else if (name.includes("light") || name.includes("lamp") || name.includes("street_light") || name.includes("streetlight") || name.includes("bulb")) {
    return {
      issueType: "damaged_streetlight",
      title: "Unlit Streetlight Fixture",
      description: "A municipal streetlight on a neighborhood thoroughfare is completely unlit. Structural inspection reveals weathered electrical access door at base.",
      affectedAsset: "streetlight",
      estimatedRepairType: "inspect",
      damageExtent: "minor",
      roadBlocked: false,
      pedestrianHazard: true,
      vehicleHazard: false,
      standingWater: false,
      activeLeak: false,
      electricalHazard: true,
      structuralDamage: false,
      estimatedAffectedArea: "small",
      estimatedScale: "small",
      obstructionLevel: "none",
      repairComplexity: "routine",
      publicExposure: "residential",
      hazardDurationEstimate: "ongoing",
      objectStability: "stable",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "medium",
      multipleIssuesDetected: false,
      visibleObjects: ["lamp post", "luminaire", "junction box"],
      geminiConfidenceRaw: 0.88,
      reasoning: [
        "No illumination in a dense residential walking corridor at night",
        "Partially open electrical junction box at the utility pole base",
        "Reduced neighborhood security due to complete blackouts"
      ]
    };
  } else if (name.includes("waste") || name.includes("garbage") || name.includes("bin") || name.includes("trash") || name.includes("overflow") || name.includes("dump")) {
    return {
      issueType: "waste_overflow",
      title: "Overflowing Commercial Bin",
      description: "A public waste bin is overflowing heavily with loose plastic trash, cardboard, and organic waste, which has begun spilling onto the walking path.",
      affectedAsset: "waste_bin",
      estimatedRepairType: "clean",
      damageExtent: "moderate",
      roadBlocked: false,
      pedestrianHazard: true,
      vehicleHazard: false,
      standingWater: false,
      activeLeak: false,
      electricalHazard: false,
      structuralDamage: false,
      estimatedAffectedArea: "medium",
      estimatedScale: "medium",
      obstructionLevel: "partial",
      repairComplexity: "routine",
      publicExposure: "commercial",
      hazardDurationEstimate: "recent",
      objectStability: "stable",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "high",
      multipleIssuesDetected: false,
      visibleObjects: ["waste bin", "spilled garbage", "plastic packaging"],
      geminiConfidenceRaw: 0.94,
      reasoning: [
        "Sanitation risk in a high-pedestrian commercial district",
        "Blocking public right of way, forcing foot traffic onto active lanes",
        "Attracts pests and creates visual blight in the municipal precinct"
      ]
    };
  } else if (name.includes("bridge") || name.includes("wall") || name.includes("concrete") || name.includes("structure") || name.includes("crack") || name.includes("column")) {
    return {
      issueType: "infrastructure_damage",
      title: "Pedestrian Bridge Spalling",
      description: "Visible concrete spalling on a pedestrian bridge load support pillar, exposing rusty reinforcing rebar and showing signs of structural weathering.",
      affectedAsset: "footpath",
      estimatedRepairType: "inspect",
      damageExtent: "severe",
      roadBlocked: false,
      pedestrianHazard: true,
      vehicleHazard: false,
      standingWater: false,
      activeLeak: false,
      electricalHazard: false,
      structuralDamage: true,
      estimatedAffectedArea: "large",
      estimatedScale: "large",
      obstructionLevel: "none",
      repairComplexity: "major",
      publicExposure: "residential",
      hazardDurationEstimate: "long_term",
      objectStability: "deteriorating",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "high",
      multipleIssuesDetected: false,
      visibleObjects: ["support column", "exposed rebar", "fractured concrete"],
      geminiConfidenceRaw: 0.92,
      reasoning: [
        "Exposed structural steel rebar undergoes accelerated oxidation",
        "Fallen chunks of heavy concrete pose danger to walkways below",
        "Micro-fracturing propagates further under static dead load"
      ]
    };
  } else {
    return {
      issueType: "unknown",
      title: "Unclassified Public Issue",
      description: "A generic public safety or infrastructure issue requiring manual review by municipal field staff.",
      affectedAsset: "other",
      estimatedRepairType: "inspect",
      damageExtent: "minor",
      roadBlocked: false,
      pedestrianHazard: false,
      vehicleHazard: false,
      standingWater: false,
      activeLeak: false,
      electricalHazard: false,
      structuralDamage: false,
      estimatedAffectedArea: "small",
      estimatedScale: "small",
      obstructionLevel: "none",
      repairComplexity: "cosmetic",
      publicExposure: "isolated",
      hazardDurationEstimate: "recent",
      objectStability: "stable",
      visibility: "fully_visible",
      lightingCondition: "good",
      cameraAngle: "optimal",
      motionBlur: false,
      complexScene: false,
      imageQuality: "medium",
      multipleIssuesDetected: false,
      visibleObjects: ["unknown object"],
      geminiConfidenceRaw: 0.75,
      reasoning: [
        "Unrecognized file naming signature prevents automated routing",
        "Requires human inspection for appropriate categorization",
        "Default fallback template activated for logging purposes"
      ]
    };
  }
}

export function registerIssuesRoutes(app: any, context: { db: any; isFirestoreAvailable: boolean; inMemoryIssues: any[]; ai: any }) {
  const { db, isFirestoreAvailable, inMemoryIssues, ai } = context;

  // GET /api/issues
  app.get("/api/issues", async (req: Request, res: Response) => {
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
    const sortedInMemory = [...inMemoryIssues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, issues: sortedInMemory, isDemoMode: true });
  });

  // POST /api/issues/analyze
  app.post("/api/issues/analyze", async (req: Request, res: Response) => {
    const { image, fileName } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image in request body" });
    }

    let base64Data = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const apiKeyExists = !!process.env.GEMINI_API_KEY;
    const maskedApiKey = apiKeyExists 
      ? `${process.env.GEMINI_API_KEY!.slice(0, 8)}...${process.env.GEMINI_API_KEY!.slice(-4)}`
      : "NOT_CONFIGURED";

    const payloadSizeKb = Math.round(image.length / 1024);

    console.log("\n🔍 ==================================================");
    console.log("🚩 [GEMINI DIAGNOSTICS] Pipeline Execution Started (Refactored)");
    console.log(`- Trigger Time: ${new Date().toISOString()}`);
    console.log(`- File Name: ${fileName || "N/A"}`);
    console.log(`- Mime Type: ${mimeType}`);
    console.log(`- Payload Size: ${payloadSizeKb} KB`);
    console.log(`- Is API Key Configured: ${apiKeyExists} (Masked: ${maskedApiKey})`);
    console.log(`- Model Selected: gemini-2.5-flash`);
    console.log("==================================================\n");

    const handleSuccessResponse = (perceptionData: any, isFallback: boolean = false, fallbackWarning?: string) => {
      // Print Raw Perception JSON (Step 6)
      console.log("\n📷 [GEMINI DIAGNOSTICS] RAW PERCEPTION JSON RECEIVED:");
      console.log(JSON.stringify(perceptionData, null, 2));
      console.log("📷 ==================================================\n");

      // Deterministic processing using core engines
      const technicalSeverity = computeTechnicalSeverity(perceptionData);
      const { priorityScore, priorityLevel } = computeOperationalPriority({ technicalSeverity });
      const responsibleDepartment = getResponsibleDepartment(perceptionData.affectedAsset);
      const responseSLA = getResponseSLA(priorityLevel);
      const analysisConfidence = computeDeterministicConfidence(perceptionData);

      const analysis = {
        // Backward compatibility properties for the frontend
        issueType: perceptionData.issueType || "other",
        title: perceptionData.title || "Untitled Issue",
        description: perceptionData.description || "",
        severity: technicalSeverity,
        confidence: analysisConfidence,
        reasoning: Array.isArray(perceptionData.reasoning) ? perceptionData.reasoning : [],
        isFallback,

        // Extended perception & structural parameters
        perceptionData: perceptionData,
        technicalSeverity: technicalSeverity,
        priorityScore: priorityScore,
        priorityLevel: priorityLevel,
        analysisConfidence: analysisConfidence,
        responseSLA: responseSLA,
        responsibleDepartment: responsibleDepartment,
        affectedAsset: perceptionData.affectedAsset || "other",
        estimatedRepairType: perceptionData.estimatedRepairType || "inspect"
      };

      console.log("\n✅ ==================================================");
      console.log("✅ [GEMINI DIAGNOSTICS] Analysis Complete (Engines Evaluated)");
      console.log(`- Technical Severity: ${technicalSeverity}`);
      console.log(`- Priority Score: ${priorityScore} (${priorityLevel})`);
      console.log(`- Department: ${responsibleDepartment}`);
      console.log(`- SLA: ${responseSLA}`);
      console.log(`- Deterministic Confidence: ${analysisConfidence}`);
      console.log("==================================================\n");

      return res.json({
        success: true,
        analysis,
        isDemoMode: isFallback,
        fallbackWarning
      });
    };

    if (!apiKeyExists || !ai) {
      console.warn("\n⚠️ ==================================================");
      console.warn("⚠️ [GEMINI DIAGNOSTICS] Local Fallback Activated (No API Key)");
      console.warn("==================================================\n");
      const fallbackPerception = getCategoryAwareFallbackPerception(fileName);
      return handleSuccessResponse(fallbackPerception, true, "Gemini API key is not configured. Local fallback engines used.");
    }

    let requestInitiated = false;
    try {
      console.log("🚀 [GEMINI DIAGNOSTICS] Dispatching Request to Gemini 2.5 API...");
      requestInitiated = true;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: promptText
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
          responseSchema: visionPromptSchema,
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
      return handleSuccessResponse(parsedResult, false);

    } catch (err: any) {
      const errorMessage = err.message || String(err);
      const errorStack = err.stack || "No stack trace available";
      const errorStatus = err.status || err.statusCode || (err.response ? err.response.status : undefined);

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

      console.error("\n❌ ==================================================");
      console.error(`⚠️ [GEMINI DIAGNOSTICS] Pipeline Error: ${errorCategory}`);
      console.error(`- Message: ${errorMessage}`);
      console.error(`- Request Dispatched: ${requestInitiated}`);
      console.error("==================================================\n");

      const fallbackPerception = getCategoryAwareFallbackPerception(fileName);
      return handleSuccessResponse(
        fallbackPerception,
        true,
        `Gemini API returned ${errorCategory} (${errorMessage}). Local engines dynamically resolved the request.`
      );
    }
  });

  // POST /api/issues/report
  app.post("/api/issues/report", async (req: Request, res: Response) => {
    const { issue } = req.body;
    if (!issue) {
      return res.status(400).json({ error: "Missing issue object in request body" });
    }

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

    // Reconstruct/compute engine outputs if they are not already filled in the request
    const basicPerception = issue.perceptionData || {
      issueType: issue.issueType || "other",
      title: issue.title || "Untitled Issue",
      description: issue.description || "",
      affectedAsset: issue.affectedAsset || "other",
      estimatedRepairType: issue.estimatedRepairType || "inspect",
      damageExtent: "moderate",
      roadBlocked: false,
      pedestrianHazard: false,
      vehicleHazard: false,
      standingWater: false,
      activeLeak: false,
      electricalHazard: false,
      structuralDamage: false,
      estimatedAffectedArea: "medium",
      imageQuality: "high",
      multipleIssuesDetected: false,
      visibleObjects: [],
      geminiConfidenceRaw: issue.confidence || 0.8,
      reasoning: Array.isArray(issue.reasoning) ? issue.reasoning : []
    };

    const techSeverity = issue.technicalSeverity !== undefined
      ? Number(issue.technicalSeverity)
      : computeTechnicalSeverity(basicPerception);

    const { priorityScore, priorityLevel } = computeOperationalPriority({ technicalSeverity: techSeverity });
    const responsibleDept = issue.responsibleDepartment || getResponsibleDepartment(issue.affectedAsset || basicPerception.affectedAsset);
    const responseSLA = issue.responseSLA || getResponseSLA(priorityLevel);
    const analysisConfidence = issue.analysisConfidence !== undefined
      ? Number(issue.analysisConfidence)
      : computeDeterministicConfidence(basicPerception);

    const newIssue = {
      id: issue.id || `issue_${Math.random().toString(36).substring(2, 11)}`,
      issueType: issue.issueType || basicPerception.issueType || "other",
      title: issue.title || basicPerception.title || "Untitled Issue",
      description: issue.description || basicPerception.description || "",
      severity: techSeverity, // Backwards compatible mapped field
      confidence: analysisConfidence, // Backwards compatible mapped field
      reasoning: Array.isArray(issue.reasoning) ? issue.reasoning : (basicPerception.reasoning || []),
      imageUrl: issue.imageUrl || "",
      isFallback: issue.isFallback ?? false,
      status: issue.status || "reported",
      createdAt: issue.createdAt || new Date().toISOString(),
      location: (issue.location && typeof issue.location.latitude === "number" && typeof issue.location.longitude === "number")
        ? { latitude: issue.location.latitude, longitude: issue.location.longitude }
        : generatePuneCoordinate(),
      city: issue.city || "Pune",
      state: issue.state || "Maharashtra",
      country: issue.country || "India",
      locationSource: issue.locationSource || (issue.location ? "GPS" : "DemoSeed"),
      markerSource: issue.markerSource || "FIRESTORE",
      isDemoMode: issue.isDemoMode ?? false,

      // Extended perception & structural parameters (Step 8)
      perceptionData: basicPerception,
      technicalSeverity: techSeverity,
      priorityScore,
      priorityLevel,
      analysisConfidence,
      responseSLA,
      responsibleDepartment: responsibleDept,
      affectedAsset: issue.affectedAsset || basicPerception.affectedAsset || "other",
      estimatedRepairType: issue.estimatedRepairType || basicPerception.estimatedRepairType || "inspect"
    };

    console.log("\n==================================================");
    console.log("📥 [CIVICOS SAVE PIPELINE] Processing Write (Refactored)");
    console.log(`- Document ID: ${newIssue.id}`);
    console.log(`- Responsible Department: ${newIssue.responsibleDepartment}`);
    console.log(`- Response SLA: ${newIssue.responseSLA}`);
    console.log("==================================================\n");

    if (!isFirestoreAvailable || !db) {
      console.warn("Firestore is not configured. Saving issue locally in-memory.");
      inMemoryIssues.push(newIssue);
      return res.status(201).json({
        success: true,
        issue: newIssue,
        verifiedInFirestore: false,
        isInMemory: true
      });
    }

    try {
      const docRef = doc(db, "issues", newIssue.id);
      await setDoc(docRef, newIssue);

      const verifySnap = await getDoc(docRef);
      if (verifySnap.exists()) {
        console.log(`🏆 [CIVICOS SAVE PIPELINE] Firestore verification passed for doc: ${newIssue.id}`);
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
      console.error("❌ [CIVICOS SAVE PIPELINE] Firestore Write Failed:", error);
      return res.status(500).json({
        success: false,
        error: `Firestore Write Failed: ${error.message || error}`
      });
    }
  });
}
