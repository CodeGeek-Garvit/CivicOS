import { Type } from "@google/genai";

export const systemInstruction = `You are CivicOS Vision Engine v2.
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
Determine factors like standing water, pedestrian/vehicle hazards, electrical hazards, structural damage, blocked roads, and damage extent.
Evaluate the visual clarity to assign imageQuality and geminiConfidenceRaw.
Examples:
Clear image: 0.95–1.00
Slight blur: 0.80
Night image: 0.65
Partially hidden object: 0.60
Unknown object: 0.45

-----------------------------------------
STEP 4 — Explain the Decision
-----------------------------------------
Provide exactly 3 concise reasoning bullets.
Each bullet must reference something actually visible.

-----------------------------------------
OUTPUT
-----------------------------------------
Return ONLY valid JSON.`;

export const promptText = "Analyze the uploaded image of a municipal/civic issue according to engineering guidelines and output structured assessment JSON.";

export const visionPromptSchema = {
  type: Type.OBJECT,
  properties: {
    issueType: {
      type: Type.STRING,
      description: "Identify the single most appropriate issue category. Allowed values: pothole, waste_overflow, damaged_streetlight, water_leakage, infrastructure_damage, illegal_dumping, drainage_issue, road_damage, fallen_tree, traffic_signal_damage, unknown."
    },
    title: {
      type: Type.STRING,
      description: "A short, descriptive, professional title for the issue (max 6 words)."
    },
    description: {
      type: Type.STRING,
      description: "Describe ONLY what is actually visible. No invented objects or assumed hidden details. Under 80 words."
    },
    affectedAsset: {
      type: Type.STRING,
      enum: ["road", "streetlight", "footpath", "drainage", "water_pipe", "electrical", "waste_bin", "other"],
      description: "The primary asset affected."
    },
    estimatedRepairType: {
      type: Type.STRING,
      enum: ["patch", "replace", "clean", "inspect", "emergency"],
      description: "Estimated type of repair needed."
    },
    damageExtent: {
      type: Type.STRING,
      enum: ["minor", "moderate", "severe"],
      description: "Extent of physical damage."
    },
    roadBlocked: {
      type: Type.BOOLEAN,
      description: "Is the road blocked by the issue?"
    },
    pedestrianHazard: {
      type: Type.BOOLEAN,
      description: "Is it a hazard for pedestrians?"
    },
    vehicleHazard: {
      type: Type.BOOLEAN,
      description: "Is it a hazard for vehicles?"
    },
    standingWater: {
      type: Type.BOOLEAN,
      description: "Is there standing water?"
    },
    activeLeak: {
      type: Type.BOOLEAN,
      description: "Is there an active leak?"
    },
    electricalHazard: {
      type: Type.BOOLEAN,
      description: "Is there an electrical hazard?"
    },
    structuralDamage: {
      type: Type.BOOLEAN,
      description: "Is there structural damage?"
    },
    estimatedAffectedArea: {
      type: Type.STRING,
      enum: ["small", "medium", "large"],
      description: "Estimated physical size/area affected."
    },
    imageQuality: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Perceived image quality."
    },
    multipleIssuesDetected: {
      type: Type.BOOLEAN,
      description: "Are multiple issues visible in the image?"
    },
    visibleObjects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of key visible physical objects."
    },
    geminiConfidenceRaw: {
      type: Type.NUMBER,
      description: "Your certainty confidence of the analysis from 0.0 to 1.0 based strictly on visual clarity."
    },
    reasoning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 3 concise reasoning bullets referencing visible facts."
    }
  },
  required: [
    "issueType",
    "title",
    "description",
    "affectedAsset",
    "estimatedRepairType",
    "damageExtent",
    "roadBlocked",
    "pedestrianHazard",
    "vehicleHazard",
    "standingWater",
    "activeLeak",
    "electricalHazard",
    "structuralDamage",
    "estimatedAffectedArea",
    "imageQuality",
    "multipleIssuesDetected",
    "visibleObjects",
    "geminiConfidenceRaw",
    "reasoning"
  ]
};
