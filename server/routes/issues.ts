import { Request, Response } from "express";
import { Type } from "@google/genai";
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs, runTransaction } from "firebase/firestore";
import { systemInstruction, promptText, visionPromptSchema } from "../prompts/visionPrompt";
import { computeTechnicalSeverity, computeDeterministicConfidence } from "../engines/scoringEngine";
import { computeOperationalPriority } from "../engines/priorityEngine";
import { getResponsibleDepartment } from "../engines/departmentEngine";
import { getResponseSLA } from "../engines/slaEngine";
import { computeCostOfInaction } from "../engines/costEngine";
import { buildDispatchPackage, runAutonomousDispatchPipeline } from "../engines/dispatchEngine";
import { sendDispatchEmail } from "../services/gmailService";

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
        const issues = querySnapshot.docs.map((doc: any) => {
          const data = doc.data();
          let costOfInaction = data.costOfInaction;
          if (!costOfInaction || !costOfInaction.baseCost) {
            costOfInaction = computeCostOfInaction({
              issueType: data.issueType || (data.perceptionData?.issueType) || "other",
              affectedAsset: data.affectedAsset || (data.perceptionData?.affectedAsset) || "other",
              estimatedRepairType: data.estimatedRepairType || (data.perceptionData?.estimatedRepairType) || "inspect",
              technicalSeverity: data.severity || 5,
              perceptionData: data.perceptionData || {
                damageExtent: data.damageExtent || "moderate",
                estimatedAffectedArea: data.estimatedAffectedArea || "medium"
              },
              title: data.title || "",
              description: data.description || ""
            });
          }
          let dispatch = data.dispatch;
          if (!dispatch) {
            let hash = 0;
            const idStr = String(doc.id || "");
            for (let i = 0; i < idStr.length; i++) {
              hash += idStr.charCodeAt(i);
            }
            const sequenceNumber = (hash % 1000) + 1;
            dispatch = runAutonomousDispatchPipeline({ id: doc.id, ...data, costOfInaction }, sequenceNumber);
          }
          return { id: doc.id, ...data, costOfInaction, dispatch };
        });
        return res.json({ success: true, issues });
      }
    } catch (error) {
      console.error("Failed to read from Firestore, returning in-memory store", error);
    }
    const sortedInMemory = [...inMemoryIssues].map(data => {
      let costOfInaction = data.costOfInaction;
      if (!costOfInaction || !costOfInaction.baseCost) {
        costOfInaction = computeCostOfInaction({
          issueType: data.issueType || (data.perceptionData?.issueType) || "other",
          affectedAsset: data.affectedAsset || (data.perceptionData?.affectedAsset) || "other",
          estimatedRepairType: data.estimatedRepairType || (data.perceptionData?.estimatedRepairType) || "inspect",
          technicalSeverity: data.severity || 5,
          perceptionData: data.perceptionData || {
            damageExtent: data.damageExtent || "moderate",
            estimatedAffectedArea: data.estimatedAffectedArea || "medium"
          },
          title: data.title || "",
          description: data.description || ""
        });
      }
      let dispatch = data.dispatch;
      if (!dispatch) {
        let hash = 0;
        const idStr = String(data.id || "");
        for (let i = 0; i < idStr.length; i++) {
          hash += idStr.charCodeAt(i);
        }
        const sequenceNumber = (hash % 1000) + 1;
        dispatch = runAutonomousDispatchPipeline({ ...data, costOfInaction }, sequenceNumber);
      }
      return { ...data, costOfInaction, dispatch };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

      const tempAnalysisForCost = {
        issueType: perceptionData.issueType || "other",
        affectedAsset: perceptionData.affectedAsset || "other",
        estimatedRepairType: perceptionData.estimatedRepairType || "inspect",
        technicalSeverity: technicalSeverity,
        perceptionData: perceptionData
      };
      const costOfInaction = computeCostOfInaction(tempAnalysisForCost);

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
        estimatedRepairType: perceptionData.estimatedRepairType || "inspect",
        costOfInaction: costOfInaction
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

    const costOfInaction = issue.costOfInaction || computeCostOfInaction({
      issueType: issue.issueType || basicPerception.issueType || "other",
      affectedAsset: issue.affectedAsset || basicPerception.affectedAsset || "other",
      estimatedRepairType: issue.estimatedRepairType || basicPerception.estimatedRepairType || "inspect",
      technicalSeverity: techSeverity,
      perceptionData: basicPerception
    });

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
      estimatedRepairType: issue.estimatedRepairType || basicPerception.estimatedRepairType || "inspect",
      costOfInaction: costOfInaction
    };

    console.log("\n==================================================");
    console.log("📥 [CIVICOS SAVE PIPELINE] Processing Write (Refactored)");
    console.log(`- Document ID: ${newIssue.id}`);
    console.log(`- Responsible Department: ${newIssue.responsibleDepartment}`);
    console.log(`- Response SLA: ${newIssue.responseSLA}`);
    console.log("==================================================\n");

    if (!isFirestoreAvailable || !db) {
      console.warn("Firestore is not configured. Saving issue locally in-memory.");
      const sequenceNumber = inMemoryIssues.length + 1;
      const dispatch = runAutonomousDispatchPipeline(newIssue, sequenceNumber);
      (newIssue as any).dispatch = dispatch;
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
      
      let sequenceNumber = 1;
      try {
        const counterRef = doc(db, "registryCounters", "issues");
        sequenceNumber = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
            transaction.set(counterRef, { current: 1 });
            return 1;
          }
          const nextVal = (counterDoc.data().current || 0) + 1;
          transaction.update(counterRef, { current: nextVal });
          return nextVal;
        });
      } catch (e) {
        console.warn("[CIVICOS SERVER SEQUENCE] Counter transaction failed, falling back to random:", e);
        sequenceNumber = Math.floor(Math.random() * 1000) + 100;
      }
      
      const dispatch = runAutonomousDispatchPipeline(newIssue, sequenceNumber);
      (newIssue as any).dispatch = dispatch;

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

  // PATCH /api/issues/:id
  app.patch("/api/issues/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, afterImageUrl, inspectionResult, verifiedBy, completionTime, verifications, disputes } = req.body;

    console.log(`\n==================================================`);
    console.log(`📥 [CIVICOS UPDATE PIPELINE] PATCH /api/issues/${id}`);
    console.log(`- New Status: ${status}`);
    console.log(`- Verifications: ${verifications}, Disputes: ${disputes}`);
    console.log(`==================================================\n`);

    if (!isFirestoreAvailable || !db) {
      const idx = inMemoryIssues.findIndex(i => i.id === id);
      if (idx !== -1) {
        inMemoryIssues[idx] = {
          ...inMemoryIssues[idx],
          ...(status !== undefined && { status }),
          ...(afterImageUrl !== undefined && { afterImageUrl }),
          ...(inspectionResult !== undefined && { inspectionResult }),
          ...(verifiedBy !== undefined && { verifiedBy }),
          ...(completionTime !== undefined && { completionTime }),
          ...(verifications !== undefined && { verifications }),
          ...(disputes !== undefined && { disputes }),
        };
        return res.json({ success: true, issue: inMemoryIssues[idx] });
      }
      return res.status(404).json({ error: "Issue not found" });
    }

    try {
      const docRef = doc(db, "issues", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ error: "Issue not found in Firestore" });
      }

      const currentData = docSnap.data();
      const updatedData = {
        ...currentData,
        ...(status !== undefined && { status }),
        ...(afterImageUrl !== undefined && { afterImageUrl }),
        ...(inspectionResult !== undefined && { inspectionResult }),
        ...(verifiedBy !== undefined && { verifiedBy }),
        ...(completionTime !== undefined && { completionTime }),
        ...(verifications !== undefined && { verifications }),
        ...(disputes !== undefined && { disputes }),
      };

      await setDoc(docRef, updatedData);
      return res.json({ success: true, issue: updatedData });
    } catch (error: any) {
      console.error("❌ [CIVICOS UPDATE PIPELINE] Firestore Patch Failed:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/dispatch/send-email (Sprint 11 Real Gmail Dispatch)
  app.post("/api/dispatch/send-email", async (req: Request, res: Response) => {
    const { issueId, dispatchPackage, costOfInaction, pdfBase64 } = req.body;

    console.log(`\n==================================================`);
    console.log(`📥 [CIVICOS DISPATCH ROUTE] POST /api/dispatch/send-email`);
    console.log(`- Issue ID: ${issueId}`);
    console.log(`- Dispatch ID: ${dispatchPackage?.dispatchId}`);
    console.log(`==================================================\n`);

    if (!issueId || !dispatchPackage) {
      return res.status(400).json({ success: false, error: "Missing issueId or dispatchPackage" });
    }

    let issue: any = null;

    // 1. Fetch issue details from db or in-memory
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "issues", issueId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          issue = docSnap.data();
        }
      } catch (err: any) {
        console.error("Warning: Failed to fetch issue from Firestore, constructing fallback:", err);
      }
    } else {
      issue = inMemoryIssues.find(i => i.id === issueId);
    }

    // Fallback if issue not in DB
    if (!issue) {
      issue = {
        id: issueId,
        title: dispatchPackage.recommendedAction ? `Remediation for Incident ${issueId}` : "Municipal Incident",
        issueType: dispatchPackage.department || "Other",
        severity: dispatchPackage.technicalSeverity || 5,
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        description: "Official municipal ticket assigned for dispatch action."
      };
    }

    // 2. Call Gmail Service
    const emailResult = await sendDispatchEmail(dispatchPackage, issue, pdfBase64 || "");

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Failed to dispatch email",
        errorType: emailResult.errorType || "UNKNOWN"
      });
    }

    // 3. Update issue record in DB with the required firestore delivery fields
    const dispatchUpdates = {
      ...dispatchPackage,
      emailSent: true,
      emailRecipient: emailResult.recipient,
      emailMessageId: emailResult.gmailMessageId || "mock_gmail_msg_id",
      emailDeliveredAt: emailResult.sentTimestamp,
      dispatchStatus: "SENT",
      workflowStage: "EMAIL_SENT"
    };

    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "issues", issueId);
        const docSnap = await getDoc(docRef);
        const currentData = docSnap.exists() ? docSnap.data() : {};
        
        const updatedData = {
          ...currentData,
          dispatch: {
            ...(currentData.dispatch || {}),
            ...dispatchUpdates
          }
        };

        await setDoc(docRef, updatedData);
        console.log(`✅ [CIVICOS DISPATCH ROUTE] Updated Firestore issue ${issueId} with dispatch info.`);
      } catch (dbError: any) {
        console.error("❌ [CIVICOS DISPATCH ROUTE] Failed to update Firestore with dispatch delivery data:", dbError);
      }
    } else {
      const idx = inMemoryIssues.findIndex(i => i.id === issueId);
      if (idx !== -1) {
        inMemoryIssues[idx] = {
          ...inMemoryIssues[idx],
          dispatch: {
            ...(inMemoryIssues[idx].dispatch || {}),
            ...dispatchUpdates
          }
        };
        console.log(`✅ [CIVICOS DISPATCH ROUTE] Updated in-memory issue ${issueId} with dispatch info.`);
      }
    }

    return res.json({
      success: true,
      recipient: emailResult.recipient,
      gmailMessageId: emailResult.gmailMessageId,
      sentTimestamp: emailResult.sentTimestamp
    });
  });

  // POST /api/copilot/chat (Chief of Staff Intelligence Advisor Endpoint)
  app.post("/api/copilot/chat", async (req: Request, res: Response) => {
    try {
      const { query: userQuery, history: chatHistory } = req.body;
      if (!userQuery) {
        return res.status(400).json({ success: false, error: "Missing query in request body" });
      }

      console.log(`\n🤖 ==================================================`);
      console.log(`🤖 [COPILOT API] Received user query: "${userQuery}"`);
      console.log(`🤖 ==================================================\n`);

      // 1. Fetch live issues (from Firestore if available, otherwise in-memory)
      let issuesList: any[] = [];
      if (isFirestoreAvailable && db) {
        try {
          const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(q);
          issuesList = querySnapshot.docs.map((doc: any) => {
            const data = doc.data();
            let costOfInaction = data.costOfInaction;
            if (!costOfInaction || !costOfInaction.baseCost) {
              costOfInaction = computeCostOfInaction({
                issueType: data.issueType || (data.perceptionData?.issueType) || "other",
                affectedAsset: data.affectedAsset || (data.perceptionData?.affectedAsset) || "other",
                estimatedRepairType: data.estimatedRepairType || (data.perceptionData?.estimatedRepairType) || "inspect",
                technicalSeverity: data.severity || 5,
                perceptionData: data.perceptionData || {
                  damageExtent: data.damageExtent || "moderate",
                  estimatedAffectedArea: data.estimatedAffectedArea || "medium"
                },
                title: data.title || "",
                description: data.description || ""
              });
            }
            let dispatch = data.dispatch;
            if (!dispatch) {
              let hash = 0;
              const idStr = String(doc.id || "");
              for (let i = 0; i < idStr.length; i++) {
                hash += idStr.charCodeAt(i);
              }
              const sequenceNumber = (hash % 1000) + 1;
              dispatch = runAutonomousDispatchPipeline({ id: doc.id, ...data, costOfInaction }, sequenceNumber);
            }
            return { id: doc.id, ...data, costOfInaction, dispatch };
          });
        } catch (dbError) {
          console.error("Firestore read failed in Copilot API, falling back to in-memory:", dbError);
        }
      }

      if (issuesList.length === 0) {
        issuesList = [...inMemoryIssues].map(data => {
          let costOfInaction = data.costOfInaction;
          if (!costOfInaction || !costOfInaction.baseCost) {
            costOfInaction = computeCostOfInaction({
              issueType: data.issueType || (data.perceptionData?.issueType) || "other",
              affectedAsset: data.affectedAsset || (data.perceptionData?.affectedAsset) || "other",
              estimatedRepairType: data.estimatedRepairType || (data.perceptionData?.estimatedRepairType) || "inspect",
              technicalSeverity: data.severity || 5,
              perceptionData: data.perceptionData || {
                damageExtent: data.damageExtent || "moderate",
                estimatedAffectedArea: data.estimatedAffectedArea || "medium"
              },
              title: data.title || "",
              description: data.description || ""
            });
          }
          let dispatch = data.dispatch;
          if (!dispatch) {
            let hash = 0;
            const idStr = String(data.id || "");
            for (let i = 0; i < idStr.length; i++) {
              hash += idStr.charCodeAt(i);
            }
            const sequenceNumber = (hash % 1000) + 1;
            dispatch = runAutonomousDispatchPipeline({ ...data, costOfInaction }, sequenceNumber);
          }
          return { ...data, costOfInaction, dispatch };
        });
      }

      // 2. Classify semantic intent programmatically to retrieve only the relevant subset of records
      const kw = userQuery.toLowerCase().trim();
      let selectedContext = "";
      let topic = "general";

      // Helper to format rupees
      const formatRupees = (amount: number): string => {
        return "₹" + Math.round(amount).toLocaleString("en-IN");
      };

      // Helper to compute SLA compliance
      const getSLAComplianceOnServer = (createdAt: string, responseSLA: any, completionTime?: string) => {
        const createdDate = new Date(createdAt);
        const endDate = completionTime ? new Date(completionTime) : new Date();
        const elapsedMs = Math.max(0, endDate.getTime() - createdDate.getTime());
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        let targetHours = 24;
        const slaStr = String(responseSLA || "24 Hours").toLowerCase();
        if (slaStr.includes("24 hours") || slaStr.includes("critical")) targetHours = 24;
        else if (slaStr.includes("72 hours") || slaStr.includes("high")) targetHours = 72;
        else if (slaStr.includes("7 days") || slaStr.includes("medium")) targetHours = 168;
        else if (slaStr.includes("14 days") || slaStr.includes("low")) targetHours = 336;

        return elapsedHours <= targetHours;
      };

      if (kw.includes("water") || kw.includes("leak") || kw.includes("drain")) {
        topic = "department";
        const waterIssues = issuesList.filter(i => 
          (i.issueType && i.issueType.toLowerCase().includes("water")) ||
          (i.dispatch?.department && i.dispatch.department.toLowerCase().includes("water")) ||
          (i.title && i.title.toLowerCase().includes("water"))
        );
        selectedContext = `Water Supply & Drainage Department context:\n` +
          `- Total water issues registered: ${waterIssues.length}\n` +
          `- Active water issues: ${waterIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").length}\n` +
          `Active Water issues details:\n` +
          waterIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").slice(0, 5).map(i => 
            `  * ID: ${i.id}, Title: "${i.title}", Severity: ${i.severity}/10, Ward: "${i.ward || "Pune"}", SLA: "${i.dispatch?.responseSLA || "24 Hours"}", Cost of Inaction: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}`
          ).join("\n");
      } 
      else if (kw.includes("road") || kw.includes("pothole") || kw.includes("asphalt") || kw.includes("pavement")) {
        topic = "department";
        const roadIssues = issuesList.filter(i => 
          (i.issueType && i.issueType.toLowerCase().includes("pothole")) ||
          (i.issueType && i.issueType.toLowerCase().includes("road")) ||
          (i.dispatch?.department && i.dispatch.department.toLowerCase().includes("road")) ||
          (i.title && i.title.toLowerCase().includes("road"))
        );
        selectedContext = `Roads & Asphalt Department context:\n` +
          `- Total road issues registered: ${roadIssues.length}\n` +
          `- Active road issues: ${roadIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").length}\n` +
          `Active Road issues details:\n` +
          roadIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").slice(0, 5).map(i => 
            `  * ID: ${i.id}, Title: "${i.title}", Severity: ${i.severity}/10, Ward: "${i.ward || "Pune"}", SLA: "${i.dispatch?.responseSLA || "24 Hours"}", Cost of Inaction: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}`
          ).join("\n");
      }
      else if (kw.includes("waste") || kw.includes("garbage") || kw.includes("bin") || kw.includes("dump") || kw.includes("swm")) {
        topic = "department";
        const wasteIssues = issuesList.filter(i => 
          (i.issueType && i.issueType.toLowerCase().includes("waste")) ||
          (i.issueType && i.issueType.toLowerCase().includes("litter")) ||
          (i.dispatch?.department && i.dispatch.department.toLowerCase().includes("waste")) ||
          (i.title && i.title.toLowerCase().includes("garbage"))
        );
        selectedContext = `Solid Waste Management (SWM) Department context:\n` +
          `- Total waste issues registered: ${wasteIssues.length}\n` +
          `- Active waste issues: ${wasteIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").length}\n` +
          `Active Waste issues details:\n` +
          wasteIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").slice(0, 5).map(i => 
            `  * ID: ${i.id}, Title: "${i.title}", Severity: ${i.severity}/10, Ward: "${i.ward || "Pune"}", SLA: "${i.dispatch?.responseSLA || "24 Hours"}", Cost of Inaction: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}`
          ).join("\n");
      }
      else if (kw.includes("budget") || kw.includes("cost") || kw.includes("exposure") || kw.includes("financial") || kw.includes("approve") || kw.includes("money") || kw.includes("authorize")) {
        topic = "budget";
        const activeIssues = issuesList.filter(i => i.status !== "Resolved" && i.status !== "Closed");
        const totalCostNow = activeIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
        const totalCost30Days = activeIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost30Days || 9400), 0);
        const totalCost90Days = activeIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCost90Days || 24800), 0);
        const costEscalationGap = totalCost90Days - totalCostNow;

        selectedContext = `Financial & Budget Impact context:\n` +
          `- Total Active Incidents needing approval: ${activeIssues.length}\n` +
          `- Immediate Repair Cost Liability (Current): ${formatRupees(totalCostNow)}\n` +
          `- Deferred Cost in 30 Days: ${formatRupees(totalCost30Days)} (Increase of ${formatRupees(totalCost30Days - totalCostNow)})\n` +
          `- Deferred Cost in 90 Days: ${formatRupees(totalCost90Days)} (Escalation gap of ${formatRupees(costEscalationGap)})\n` +
          `Top 5 Highest Immediate Financial Liabilities:\n` +
          activeIssues.sort((a,b) => (b.costOfInaction?.repairCostNow || 0) - (a.costOfInaction?.repairCostNow || 0)).slice(0, 5).map(i =>
            `  * ID: ${i.id}, Title: "${i.title}", Department: "${i.dispatch?.department || "Unassigned"}", Ward: "${i.ward || "Pune"}", Current Repair: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}, 90-Day Repair: ${formatRupees(i.costOfInaction?.repairCost90Days || 24800)}`
          ).join("\n");
      }
      else if (kw.includes("ward") || kw.includes("hotspot") || kw.includes("cluster") || kw.includes("concentration") || kw.includes("density") || kw.includes("geographic") || kw.includes("risk")) {
        topic = "ward";
        const wardStats: Record<string, { count: number; active: number; totalCost: number; maxSeverity: number }> = {};
        issuesList.forEach(i => {
          const w = i.ward || "Unknown Ward";
          if (!wardStats[w]) {
            wardStats[w] = { count: 0, active: 0, totalCost: 0, maxSeverity: 0 };
          }
          wardStats[w].count += 1;
          const isActive = i.status !== "Resolved" && i.status !== "Closed";
          if (isActive) {
            wardStats[w].active += 1;
            wardStats[w].totalCost += (i.costOfInaction?.repairCostNow || 4500);
          }
          if ((i.severity || 0) > wardStats[w].maxSeverity) {
            wardStats[w].maxSeverity = i.severity || 0;
          }
        });

        const activeAndDispatched = issuesList.filter(i => i.dispatch);
        const breachedIssues = activeAndDispatched.filter(i => {
          return !getSLAComplianceOnServer(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime);
        });

        selectedContext = `Geographic & Spatial Ward Hotspots context:\n` +
          `- Ward Distribution of Incidents:\n` +
          Object.entries(wardStats).map(([name, stat]) => 
            `  * Ward: "${name}", Active Incidents: ${stat.active}, Total Registered: ${stat.count}, Max Incident Severity: ${stat.maxSeverity}/10, Cumulative Repair Liability: ${formatRupees(stat.totalCost)}`
          ).join("\n") + `\n- SLA Breaches: ${breachedIssues.length} active breaches across wards.`;
      }
      else if (kw.includes("sla") || kw.includes("breach") || kw.includes("overdue") || kw.includes("compliant") || kw.includes("compliance") || kw.includes("turnaround")) {
        topic = "sla";
        const activeAndDispatched = issuesList.filter(i => i.dispatch);
        const activePending = activeAndDispatched.filter(i => i.status !== "Resolved" && i.status !== "Closed");
        const breachedIssues = activeAndDispatched.filter(i => {
          return !getSLAComplianceOnServer(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime);
        });
        const complianceRate = activeAndDispatched.length > 0
          ? Math.round(((activeAndDispatched.length - breachedIssues.length) / activeAndDispatched.length) * 100)
          : 100;

        selectedContext = `SLA Operational Performance & Overdue Tasks:\n` +
          `- SLA Compliance Rate: ${complianceRate}%\n` +
          `- Total Dispatched/Monitored Issues: ${activeAndDispatched.length}\n` +
          `- Active SLA Breaches (Action Required!): ${breachedIssues.length}\n` +
          `- Active Pending Tasks: ${activePending.length}\n` +
          `List of current Active SLA Breached Issues:\n` +
          breachedIssues.filter(i => i.status !== "Resolved" && i.status !== "Closed").slice(0, 5).map(i =>
            `  * ID: ${i.id}, Title: "${i.title}", Department: "${i.dispatch?.department || "Unassigned"}", Ward: "${i.ward || "Pune"}", SLA Allowed: "${i.dispatch?.responseSLA || "24 Hours"}", Created At: ${i.createdAt}`
          ).join("\n");
      }
      else if (kw.includes("brief") || kw.includes("today") || kw.includes("overview") || kw.includes("summary") || kw.includes("24 hour") || kw.includes("happen")) {
        topic = "brief";
        const activeIssues = issuesList.filter(i => i.status !== "Resolved" && i.status !== "Closed");
        const resolvedIssues = issuesList.filter(i => i.status === "Resolved" || i.status === "Closed");
        const activeAndDispatched = issuesList.filter(i => i.dispatch);
        const breachedIssues = activeAndDispatched.filter(i => {
          return !getSLAComplianceOnServer(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime);
        });
        const complianceRate = activeAndDispatched.length > 0
          ? Math.round(((activeAndDispatched.length - breachedIssues.length) / activeAndDispatched.length) * 100)
          : 100;

        selectedContext = `Today's Executive Operations Summary context:\n` +
          `- Total Registered Citizen Reports: ${issuesList.length}\n` +
          `- Unresolved Active Queue: ${activeIssues.length} incidents\n` +
          `- Successfully Resolved Issues: ${resolvedIssues.length} incidents\n` +
          `- Monitored Dispatched Work Orders: ${activeAndDispatched.length}\n` +
          `- Outstanding SLA Breaches: ${breachedIssues.length}\n` +
          `- Target SLA Compliance: ${complianceRate}%\n` +
          `Most Urgent Unresolved Incidents:\n` +
          activeIssues.sort((a,b) => (b.severity || 0) - (a.severity || 0)).slice(0, 5).map(i =>
            `  * ID: ${i.id}, Title: "${i.title}", Department: "${i.dispatch?.department || "Unassigned"}", Ward: "${i.ward || "Pune"}", Severity: ${i.severity}/10, Cost of Inaction: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}`
          ).join("\n");
      }
      else {
        // Fallback / General / priorities
        topic = "general";
        const activeIssues = issuesList.filter(i => i.status !== "Resolved" && i.status !== "Closed");
        const activeAndDispatched = issuesList.filter(i => i.dispatch);
        const breachedIssues = activeAndDispatched.filter(i => {
          return !getSLAComplianceOnServer(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime);
        });

        selectedContext = `General Pune Operations context:\n` +
          `- Total active incidents: ${activeIssues.length}\n` +
          `- Total resolved incidents: ${issuesList.filter(i => i.status === "Resolved" || i.status === "Closed").length}\n` +
          `- SLA Breached counts: ${breachedIssues.length}\n` +
          `Top 5 critical active issues:\n` +
          activeIssues.sort((a,b) => (b.severity || 0) - (a.severity || 0)).slice(0, 5).map(i =>
            `  * ID: ${i.id}, Title: "${i.title}", Department: "${i.dispatch?.department || "Unassigned"}", Ward: "${i.ward || "Pune"}", Severity: ${i.severity}/10, Cost of Inaction: ${formatRupees(i.costOfInaction?.repairCostNow || 4500)}`
          ).join("\n");
      }

      // Check if history is present and build a short summary of previous turns
      let conversationMemoryText = "";
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        conversationMemoryText = `Recent Chat History (short-term conversational memory):\n` +
          chatHistory.slice(-5).map(turn => 
            `  - Sender: ${turn.sender === "commissioner" ? "Commissioner" : "Chief of Staff"}\n    Text: "${turn.text || ""}"`
          ).join("\n") + `\n-----------------------\n`;
      }

      // If no API key, return a mock response matching the grounding data
      if (!process.env.GEMINI_API_KEY || !ai) {
        console.warn("⚠️ [COPILOT API] Local Fallback Activated (No API Key)");
        // Construct a realistic response structured identical to the expected schema
        const activeIssues = issuesList.filter(i => i.status !== "Resolved" && i.status !== "Closed");
        const totalActiveRepairCost = activeIssues.reduce((sum, i) => sum + (i.costOfInaction?.repairCostNow || 4500), 0);
        const activeAndDispatched = issuesList.filter(i => i.dispatch);
        const breachedIssues = activeAndDispatched.filter(i => {
          return !getSLAComplianceOnServer(i.createdAt, i.dispatch?.responseSLA || "24 Hours", i.completionTime);
        });

        const mockReply = {
          executiveSummary: `Commissioner, I have analyzed the live incident ledger. We are managing ${activeIssues.length} unresolved incidents across the Corporation. Total remediation liabilities stand at ${formatRupees(totalActiveRepairCost)}, requiring tactical crew assignments.`,
          reasoning: `Operational audits indicate that roads and water pipes are the main drivers of physical decay. Shivaji Nagar has the highest active incident density, leading to cumulative risk. Postponing these repairs will double our financial liabilities within 30 days.`,
          recommendation: `My recommendation is to instruct the Roads Department and Water Supply units to immediately authorize tactical field-work dispatch packages to Shivaji Nagar.`,
          supportingEvidence: [
            `Active Cases: ${activeIssues.length} incidents in progress`,
            `Exposure Liabilities: ${formatRupees(totalActiveRepairCost)} immediate cost`,
            `Outstanding SLA Breaches: ${breachedIssues.length} requiring immediate escalations`
          ],
          followUpQuestions: [
            `Why is Shivaji Nagar ranked highest?`,
            `Which department needs additional staffing today?`,
            `Estimate financial exposure.`
          ],
          topic: topic
        };
        return res.json({ success: true, result: mockReply, fallback: true });
      }

      // Call Gemini using structured JSON output
      const copilotResponseSchema = {
        type: Type.OBJECT,
        properties: {
          executiveSummary: {
            type: Type.STRING,
            description: "A 2 to 4 sentence high-level executive briefing answering the user's question directly."
          },
          reasoning: {
            type: Type.STRING,
            description: "Detailed strategic reasoning explaining the 'why', identifying patterns, consequences of inaction, and connecting multiple operational observations."
          },
          recommendation: {
            type: Type.STRING,
            description: "Chief of Staff recommendation. Must begin with 'My recommendation is to [actionable next steps for the Commissioner]'."
          },
          supportingEvidence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 2 to 4 concrete facts, numbers, departments, ward names, budgets, or incident counts grounded strictly in the provided data."
          },
          followUpQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly three suggested contextual follow-up questions for the Commissioner, based on the current context."
          },
          topic: {
            type: Type.STRING,
            description: "The topic area of the response. Must be one of: 'brief', 'budget', 'sla', 'department', 'ward', 'general'."
          }
        },
        required: ["executiveSummary", "reasoning", "recommendation", "supportingEvidence", "followUpQuestions", "topic"]
      };

      const sysInstruction = `You are an experienced Municipal Chief of Staff and Executive Advisor to the Municipal Commissioner of Pune, Maharashtra.
Your style of writing must be direct, highly professional, polished, objective, fluent, and commanding. Speak with professional authority and confidence.
Avoid friendly conversational filler, emojis, or typical AI robotic phrases.
You must strictly base all facts, figures, counts, and recommendations on the provided grounded municipal data. 
Never hallucinate or invent fake cases, numbers, departments, or wards.
If you do not have information in the provided data to answer a question, explicitly state so while still providing a professional response based on the available registry data.`;

      const prompt = `Grounded Municipal Data Context:
=======================================
${selectedContext}
=======================================

${conversationMemoryText}Commissioner's Question:
"${userQuery}"

Based on the provided grounded municipal context and chat history, formulate your Executive Advisor response in the required JSON schema. Keep the tone human, professional, and authoritative. Set the topic to matches the category ('brief', 'budget', 'sla', 'department', 'ward', 'general').`;

      console.log("🚀 [COPILOT API] Dispatching Request to Gemini 2.5 API...");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: copilotResponseSchema,
          systemInstruction: sysInstruction
        }
      });

      const text = response.text;
      console.log(`- Raw Copilot Response Output:\n--------------------\n${text}\n--------------------`);

      if (!text) {
        throw new Error("Empty response from Gemini.");
      }

      const parsedResult = JSON.parse(text);
      return res.json({ success: true, result: parsedResult });

    } catch (err: any) {
      console.error("❌ [COPILOT API] Execution Failed:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });
}
