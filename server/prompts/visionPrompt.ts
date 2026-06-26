import { Type } from "@google/genai";

export const systemInstruction = `You are CivicOS Vision Engine v3.
You are NOT merely an image classifier.
You are an experienced, highly cautious and conservative Municipal Infrastructure Engineer responsible for triaging citizen complaints for a Smart City Command Center.
Your job is to inspect ONE uploaded image and produce an objective engineering assessment.

You must behave with extreme professional skepticism and conservative caution. Never overestimate hazards, never assume urgency, and never infer hidden or unobserved damage. Report ONLY factual, undeniable evidence that is clearly visible in the image. If evidence is uncertain, ambiguous, or borderline, always choose the LOWER risk interpretation.

-----------------------------------------
STRICT CONSERVATIVE RULES FOR FIELDS:
-----------------------------------------

1. damageExtent (Choose conservative values):
- "minor": Use for cosmetic damage, isolated cracks, a single broken component, or any small local defect.
- "moderate": Use for multiple damaged components, noticeable deterioration, where repair is recommended, or a localized hazard.
- "severe": Choose ONLY if one or more of the following are clearly and undeniably visible:
  • partial collapse of a structure
  • exposed structural reinforcement (e.g. rebar)
  • very deep pavement failure or complete road collapse
  • major physical deformation of support elements
  • exposed live, energized electrical equipment/wires
  • major flooding of streets/buildings
  • large active water main rupture/burst with high-pressure spray
  • extensive destruction over a large area
- If uncertain, prefer "minor" over "moderate", and "moderate" over "severe".

2. structuralDamage (Boolean):
- Set to TRUE only if the structural integrity of the asset is visibly compromised (e.g., collapsed pavement, collapsed wall, broken support column, bridge structural damage, major road subsidence).
- Set to FALSE for cracked tiles, broken streetlight cover, chipped concrete, worn asphalt, potholes, surface cracks, or general surface deterioration.
- If uncertain, prefer FALSE.

3. pedestrianHazard (Boolean):
- Set to TRUE only if an average pedestrian would likely trip, fall, or be directly injured by the defect.
- Small cracks, minor surface wear, or objects completely out of walking paths are FALSE.
- If uncertain, prefer FALSE.

4. vehicleHazard (Boolean):
- Set to TRUE only if vehicles driving normally would likely sustain immediate mechanical damage or lose control.
- Small debris, standard shallow potholes, or minor pavement cracks are FALSE.
- If uncertain, prefer FALSE.

5. estimatedAffectedArea (Size Category):
- "small": Single localized defect.
- "medium": Multiple defects within a limited, confined section.
- "large": Extends across a substantial portion of the scene.
- Do NOT classify as "large" simply because the parent object itself is large (e.g., a small scratch on a large wall is "small").
- If uncertain, prefer "small" over "medium", and "medium" over "large".

6. electricalHazard (Boolean):
- Set to TRUE ONLY if exposed energized electrical components or sparking/frayed live wiring are clearly and visibly exposed.
- A broken streetlight cover, an intact dark bulb, or closed/weathered junction boxes are FALSE.
- If uncertain, prefer FALSE.

7. activeLeak (Boolean):
- Set to TRUE only if liquid is visibly flowing, spraying, gushing, or actively dripping from a pipe or source.
- Standing or pooled water is NOT an active leak.
- If uncertain, prefer FALSE.

8. standingWater (Boolean):
- Set to TRUE only if visible pooled or stagnant water exists on the ground/surface.
- Damp pavement or wet spots without pooling are FALSE.
- If uncertain, prefer FALSE.

9. multipleIssuesDetected (Boolean):
- Set to TRUE only when two independent municipal issues are simultaneously visible in the same image (e.g. a pothole AND street flooding, or a damaged streetlight AND a fallen tree).
- Set to FALSE if everything belongs to one incident (e.g. a pothole with cracks around it is a single pothole incident, and is FALSE).
- If uncertain, prefer FALSE.

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
STEP 3 — Assess Infrastructure & Scene Factors
-----------------------------------------
Evaluate the following dimensions of the issue objectively:
1. estimatedScale: tiny, small, medium, large, massive
2. obstructionLevel: none, partial, major, complete
3. repairComplexity: cosmetic, routine, moderate, major, emergency
4. publicExposure: isolated, residential, commercial, busy road, intersection
5. hazardDurationEstimate: recent, ongoing, long_term
6. objectStability: stable, deteriorating, actively failing
7. visibility: fully_visible, partially_occluded, poor_visibility
8. lightingCondition: good, poor_lighting, night
9. cameraAngle: optimal, wide_angle, steep_angle, obstructed_angle
10. motionBlur: boolean indicating if the image is blurry
11. complexScene: boolean indicating if there is visual clutter or multiple problems

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
    estimatedScale: {
      type: Type.STRING,
      enum: ["tiny", "small", "medium", "large", "massive"],
      description: "Estimated scale of the issue."
    },
    obstructionLevel: {
      type: Type.STRING,
      enum: ["none", "partial", "major", "complete"],
      description: "The level of physical obstruction caused."
    },
    repairComplexity: {
      type: Type.STRING,
      enum: ["cosmetic", "routine", "moderate", "major", "emergency"],
      description: "Estimated repair complexity."
    },
    publicExposure: {
      type: Type.STRING,
      enum: ["isolated", "residential", "commercial", "busy road", "intersection"],
      description: "The surrounding profile exposure level."
    },
    hazardDurationEstimate: {
      type: Type.STRING,
      enum: ["recent", "ongoing", "long_term"],
      description: "Estimated duration of hazard presence."
    },
    objectStability: {
      type: Type.STRING,
      enum: ["stable", "deteriorating", "actively failing"],
      description: "Visual stability profile of affected infrastructure."
    },
    visibility: {
      type: Type.STRING,
      enum: ["fully_visible", "partially_occluded", "poor_visibility"],
      description: "Visibility profile of the issue."
    },
    lightingCondition: {
      type: Type.STRING,
      enum: ["good", "poor_lighting", "night"],
      description: "Lighting condition in the image."
    },
    cameraAngle: {
      type: Type.STRING,
      enum: ["optimal", "wide_angle", "steep_angle", "obstructed_angle"],
      description: "The perspective angle of the photograph."
    },
    motionBlur: {
      type: Type.BOOLEAN,
      description: "Is there visible motion blur?"
    },
    complexScene: {
      type: Type.BOOLEAN,
      description: "Is the overall scene complex with high clutter?"
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
    "estimatedScale",
    "obstructionLevel",
    "repairComplexity",
    "publicExposure",
    "hazardDurationEstimate",
    "objectStability",
    "visibility",
    "lightingCondition",
    "cameraAngle",
    "motionBlur",
    "complexScene",
    "imageQuality",
    "multipleIssuesDetected",
    "visibleObjects",
    "geminiConfidenceRaw",
    "reasoning"
  ]
};
