# CivicOS: System Architecture Blueprint (Final Production Spec)
**The AI-Powered Autonomous Civic Intelligence Platform**

This document serves as the master architectural design specification for **CivicOS**, a production-grade hackathon-winning civic intelligence platform. It has been updated to integrate rigorous architectural enhancements including an advanced Gemini-driven Priority Engine, strict lifecycle state tracking, geospatial duplicate thresholds, a streamlined gamification ledger, a structured Copilot Context Builder, a unified explainability framework, and a resilient seeded demo dataset strategy.

---

## 1. Final Architecture Diagram

CivicOS is structured as a robust full-stack application running inside an autonomous, containerized environment (Cloud Run). It manages clean separations of concern between citizen inputs, system algorithms, the Gemini agentic pipeline, and legacy spreadsheets/dispatch logs.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (React)                                 │
├───────────────────────────────┬───────────────────────────────┬────────────────────────┤
│       Citizen Dashboard       │      Authority Command        │     Civic Copilot      │
│  - Multimodal Reporter (AV/I) │  - Interactive Heatmaps       │  - Conversational Box  │
│  - Spatial Verification Hub   │  - Priority Action Queue      │  - Trigger Actions     │
│  - Live Civic Karma Widget   │  - Anomaly Indicators         │  - Highlight Canvas    │
└───────────────┬───────────────┴───────────────┬───────────────┴───────────┬────────────┘
                │                               │                           │
                └───────────────────────────────┼───────────────────────────┘
                                                │ (HTTPS/JSON Requests + Bearer JWT ID Token)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION SERVER (Express.js)                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Auth Filter ] -> Validates incoming ID tokens against Firebase Admin SDK            │
│  [ Core API Router ] -> Maps endpoints (Issues, Verification, Analytics, Chat)          │
│  [ Context Builder ] -> Assembles spatial/temporal aggregates (Cache Layer with TTL)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                          Agentic & Algorithmic Orchestration Core                      │
│                                                                                        │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐  │
│  │     AI Vision Agent      │  │     Duplicate Agent      │  │   Priority Engine    │  │
│  │ (Image/Voice Processing) │  │ (Category Geospatial API)│  │ (Weighted S100 Algorithm)│
│  └────────────┬─────────────┘  └────────────┬─────────────┘  └──────────┬───────────┘  │
│               │                             │                           │              │
│  ┌────────────▼─────────────┐  ┌────────────▼─────────────┐  ┌──────────▼───────────┐  │
│  │ Cost of Inaction Agent   │  │  Shadow Problem Agent    │  │   Dispatch Agent     │  │
│  │ (Gemini Economics Expert)│  │  (Systemic Cluster Cron) │  │(Gmail & Sheets Sync) │  │
│  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────┘  │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │ (Secure Native SDK Connections)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                DATA & INTEGRATIONS LAYER                               │
├───────────────────────────────┬───────────────────────────────┬────────────────────────┤
│       Cloud Firestore         │           Gmail API           │    Google Sheets API   │
│ - Users, Issues, Shadows,     │ - Department Dispatch Alerts  │ - Operational Ledger   │
│   Metrics, and Demo Seeders   │ - Citizen Upvote Updates      │   (Status Updates)     │
└───────────────────────────────┴───────────────────────────────┴────────────────────────┘
```

---

## 2. Firestore Database Architecture

To ensure speed, horizontal scalability, and reliable persistence, the Firestore database is modeled as a series of shallow root collections with nested transactional logs.

```text
  /users
    └── {uid}  --> Profile details, simplified karma, submission counts
  /issues
    ├── {issueId} --> Categorized reports, priority scores, spatial coords, asset ties
    └── /statusHistory
          └── {historyId} --> Operational state-change logs (Audit trail)
  /shadow_problems
    └── {shadowId} --> Clustered regional failures (e.g. corroded pipelines)
  /system_metrics
    └── {wardId} --> Dynamic Ward KPIs, Road indexes, and general Health scores
```

### JSON Schemas & TypeScript Data Models

#### Collection: `users`
Tracks individual contributor reputation metrics without rigid role hierarches or complex tier logic.

```typescript
interface UserProfile {
  uid: string;                 // Matches Firebase Authentication unique identifier
  email: string;               // Registered Gmail address
  displayName: string;         // User's full name
  karmaPoints: number;         // Current running balance (Calculated via simplified MVP rules)
  reportedIssues: number;      // Total unique incidents created
  verifiedIssues: number;      // Total valid verification actions completed
  resolvedConfirmations: number;// Total confirmations submitted on resolved work orders
  createdAt: string;           // ISO 8601 UTC timestamp
  updatedAt: string;           // ISO 8601 UTC timestamp
}
```

#### Collection: `issues`
The core document representing detected and analyzed civic anomalies. It optionally includes asset tracking for infrastructure management and an explainability layer for AI-driven parameters.

```typescript
interface IssueDocument {
  id: string;                  // System-generated UUID or custom Firestore document ID
  reporterId: string;          // Link reference to user's uid
  title: string;               // AI-generated Title (max 6 words)
  description: string;         // Detailed descriptive summary generated via Vision/Voice parsing
  category: 'pothole' | 'water_leakage' | 'damaged_streetlight' | 'waste_overflow' | 'infrastructure_damage' | 'other';
  status: 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  
  // Advanced Asset Tracking
  assetType?: 'road' | 'streetlight' | 'drainage' | 'water_pipeline' | 'other_infrastructure';
  assetId?: string;            // System code of physical asset (supports Digital Twin matches)

  // Location Details
  location: {
    lat: number;
    lng: number;
    address: string;
    wardId: string;            // Reference to local municipal ward geometry
  };

  media: {
    imageUrl?: string;         // Firebase Storage or CDN address of captured photo
    audioUrl?: string;         // Optional path to captured audio voice complaints
    capturedAt: string;        // UTC creation timestamp
  };

  // AI Orchestration and Analysis Results (Explainability Layer)
  analysis: {
    severity: {
      score: number;           // Scale of 1 to 10 computed via Gemini Vision
      reasoning: string[];     // Human-readable factors supporting assessment
    };
    costOfInaction: {
      repairCostToday: number; // Low-complexity correction cost in localized currency (INR/USD)
      futureCost: number;      // Compound degradation cost after 90 days
      riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
      reasoning: string[];     // Material degradation and environmental considerations
    };
    priority: {
      score: number;           // Computed Priority Score (0-100)
      level: 'Low' | 'Medium' | 'High' | 'Critical';
      reasoning: string[];     // Multi-factor reasoning engine output
    };
  };

  // Spatial Verification and Consolidation Metrics
  verification: {
    upvotes: number;
    downvotes: number;
    verifiedBy: string[];      // Array of users.uid upvoting
    disputedBy: string[];      // Array of users.uid downvoting
    isDuplicateOf?: string;    // Reference to parent issues.id if duplicate
    duplicateConfidence: number; // Strength coefficient (0.00 to 1.00)
  };

  // Workflow Dispatch Targets
  workOrder?: {
    assignedDepartment: string;
    assignedTo?: string;       // Dispatch unit contractor reference
    dispatchedAt?: string;
    scheduledResolutionDate?: string;
    completedAt?: string;
    sheetsRowIndex?: number;   // Index mapping to Google Sheets integration ledger
  };

  createdAt: string;
  updatedAt: string;
}
```

##### Nested Transaction Sub-Collection: `statusHistory`
Located at `/issues/{issueId}/statusHistory/{historyId}`. This collection ensures complete operational trace logs for compliance auditing.

```typescript
interface StatusHistoryLog {
  id: string;
  fromStatus: 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'initial';
  toStatus: 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  updatedBy: string;           // Refers to active actor (auth user ID, system trigger, etc)
  role: 'citizen' | 'authority' | 'system';
  comment: string;             // Reasoning or explanation for the state change
  timestamp: string;           // ISO 8601 timestamp
}
```

#### Collection: `shadow_problems`
Synthesized macro-problems identified across localized micro-anomalies over temporal spans.

```typescript
interface ShadowProblem {
  id: string;
  title: string;               // e.g. "Main Trunk Water Conduit Corrosive Deterioration"
  predictedAnomalyType: 'structural_failure' | 'drainage_gridlock' | 'grid_collapse';
  confidenceScore: number;     // Statistical confidence (0.00 to 1.00)
  triggeringIssueIds: string[];// Associated report instances in issues collection
  location: {
    lat: number;
    lng: number;
    radiusMeters: number;      // Geographically computed influence zone
  };
  status: 'active' | 'investigating' | 'mitigated';
  createdAt: string;
  updatedAt: string;
}
```

#### Collection: `system_metrics`
Dynamic scorecards reflecting municipal performance metrics aggregated at the individual ward level.

```typescript
interface WardHealthMetrics {
  wardId: string;              // e.g. "ward_01"
  wardName: string;            // e.g. "Outer Ring Corridor"
  cityHealthScore: number;     // Normalized KPI composite score (0 to 100)
  categoryScores: {
    infrastructure: number;    // 0 to 100
    roads: number;             // 0 to 100
    water: number;             // 0 to 100
    citizenParticipation: number; // 0 to 100
  };
  activeIssuesCount: number;
  resolvedIssues30Days: number;
  averageResolutionHours: number;
  timestamp: string;
}
```

---

## 3. Required Firestore Indexes

To avoid Firestore performance warnings or query exceptions during dashboard rendering, the following indexes are defined:

### Single-Field Index Overrides
- **Collection**: `issues`
  - Field: `location.wardId` (Array-Contains)
  - Field: `analysis.priority.score` (Descending)
  - Field: `createdAt` (Descending)

### Composite Indexes
1. **Querying Priority Queues by Status**:
   - Collection: `issues`
   - Fields: `status` (Ascending) + `analysis.priority.score` (Descending)
2. **Ward Specific Priority Triage**:
   - Collection: `issues`
   - Fields: `location.wardId` (Ascending) + `status` (Ascending) + `analysis.priority.score` (Descending)
3. **Temporal Mapping Dashboard Rendering**:
   - Collection: `issues`
   - Fields: `category` (Ascending) + `createdAt` (Descending)
4. **Duplicate Location Scanning**:
   - Collection: `issues`
   - Fields: `category` (Ascending) + `status` (Ascending) + `createdAt` (Descending)

---

## 4. Priority Engine & Logic Design (CR #1 & CR #4)

Priority is managed via a deterministic, multi-factor numerical engine rather than raw heuristics. Every reported incident is parsed across spatial, mechanical, financial, and temporal scales to yield a standardized score ($P_{score}$) between $0$ and $100$.

### Priority Formula Matrix

$$\text{Priority Score } (P_{score}) = \min\left(100, \left( \alpha \cdot S_{v} \right) + \left( \beta \cdot F_{deg} \right) + \left( \gamma \cdot C_{eng} \right) + \left( \delta \cdot T_{age} \right)\right)$$

Where:
* **Severity Coefficient ($\alpha = 3.5$)**: Scaled Gemini Vision assessment score ($S_{v} \in [1, 10]$).
* **Cost Degradation Index ($\beta = 2.0$)**: Normalized ratio of cost increase over a 90-day inaction span ($F_{deg} = \min(10, \frac{\text{futureCost}}{\text{repairCostToday}} \times 2.0)$).
* **Crowd Engagement Score ($\gamma = 1.5$)**: Reflects citizen feedback and confirmations ($C_{eng} = \min(10, \log_{2}(1 + U_{votes} + D_{dup}))$), where $U_{votes}$ represents verification upvotes and $D_{dup}$ matches linked duplicate reports.
* **Temporal Aging Factor ($\delta = 2.0$)**: Dynamic scale preventing unaddressed low-priority items from being indefinitely neglected ($T_{age} = \min(15, \text{Hours since creation} \times 0.15)$).

### Score Ranges & Action Thresholds
* **0 - 39 (Low)**: Handled on standard scheduled maintenance cycles.
* **40 - 69 (Medium)**: Targeted for regional resource dispatching within 5-7 days.
* **70 - 84 (High)**: Escalated to local area supervisors; scheduled completion within 48 hours.
* **85 - 100 (Critical)**: Immediate automated trigger sequences. Initiates dispatch warnings, appends spreadsheet records, and sends Gmail notifications.

---

## 5. Issue Lifecycle & Status Transitions (CR #2)

Incidents progress through a strict transactional lifecycle. Changes to the core document must be accompanied by a log entry in the `statusHistory` nested sub-collection to maintain strict system auditability.

```text
       ┌───────────┐         ┌───────────┐         ┌───────────┐
       │ reported  ├────────>│ verified  ├────────>│ assigned  │
       └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
             │                     │                     │
             │ (Manual Flag)       │ (Auto/Threshold)    │ (Dept Assign)
             ▼                     ▼                     ▼
       ┌───────────┐         ┌───────────┐         ┌───────────┐
       │  closed   │<────────┤ resolved  │<────────│in_progress│
       └───────────┘         └───────────┘         └───────────┘
```

### Transition Matrix and Role Access Controls

| Origin State | Destination State | Allowed Actor / Role | State Validation Rules & Verification Criteria |
|---|---|---|---|
| `reported` | `verified` | System Engine / Authority | Triggers automatically if upvote count exceeds 10 OR if manual confirmation is provided by authority. |
| `verified` | `assigned` | Municipal Authority | Pre-requisite validation check: `workOrder.assignedDepartment` and `scheduledResolutionDate` must be defined. |
| `assigned` | `in_progress` | Dispatched Contractor / Field Worker | Field operator logs arrival on-site; system appends coordinate timestamp checks. |
| `in_progress` | `resolved` | Dispatched Contractor / Field Worker | Requires uploading a post-remediation evidence photo. |
| `resolved` | `closed` | System / Authority | Confirmed automatically if citizen verification confirms correction with >3 confirmations. |
| *Any State* | `closed` | Municipal Authority | Direct administrative termination (e.g. invalid report, duplicate, or spam). |

---

## 6. Dynamic Duplicate Detection System (CR #5)

To prevent duplicate reports from creating noise on active queues, the Duplicate Agent uses a category-specific radial check paired with a Gemini semantic evaluation.

### Category Proximity Threshold Matrix
- **Potholes**: **25 meters** (Narrow spatial sensitivity)
- **Streetlights**: **25 meters** (Matches single utility pole offsets)
- **Water Leakages**: **50 meters** (Reflects fluid flow spreading)
- **Garbage Complaints**: **50 meters** (Aggregated disposal pile boundaries)
- **Infrastructure Damage**: **100 meters** (Structural perimeter offset)

```text
Incoming Issue (Water Leakage) ──> Geohash Query (50m Bounding Box) ──> Filter Active Statuses
                                                                                │
                                                                                ▼
[ Visual Similarity Match & Spatial Radius Check ] <── Gemini Semantic Scan ◄───┘
               │
               ▼
Duplicate Confidence (Score: 0.91) ──> Merge into active thread / Increment Upvote
```

### Duplicate Confidence Scoring Formulation
When candidate matches are identified within the spatial bounding box, a multi-factor score is calculated:

$$\text{Duplicate Confidence } (D_{c}) = \left( W_{dist} \cdot \left(1 - \frac{\text{Distance}}{\text{Threshold}}\right) \right) + \left( W_{sem} \cdot S_{match} \right)$$

Where:
- $W_{dist} = 0.40$ (Distance factor weights)
- $W_{sem} = 0.60$ (Semantic and image metadata matching weights)
- $S_{match}$ = Description semantic match score ($[0.00, 1.00]$) computed via Gemini embedding comparison.
- **Decision boundary**: If $D_{c} \ge 0.85$, the incoming report is flagged as a duplicate.

---

## 7. Simplified MVP Civic Karma System (CR #6)

To ensure rapid, reliable execution during MVP and hackathon phases, the gamification engine is simplified to track core engagement metrics without complex calculations or tier progressions.

### Earning Matrix
- **Unique Report Submission (Verified Status)**: **+15 Karma Points**
- **Community Verification Vote**: **+2 Karma Points**
- **Verification of Completed Status**: **+5 Karma Points**

### Extensibility Model
All trackers are persisted as simple fields on the root `users` document (`karmaPoints`, `reportedIssues`, `verifiedIssues`, `resolvedConfirmations`). This allows developers to introduce secondary calculations (decay values, custom reward tiers, or quadratic weighting) later without requiring database re-writes.

---

## 8. Civic Copilot Context Builder Architecture (CR #7)

To ensure that the authority-facing Civic Copilot operates with precise context without overloading its token window, the application uses an active context compiler layer with automated TTL caching.

```text
  [ Incoming Authority Chat Query ]
                │
                ▼
  ┌─────────────────────────────────────────────────────────┐
  │              Copilot Context Builder Layer              │
  ├─────────────────────────────────────────────────────────┤
  │ 1. Scan memory cache for Ward metrics & Anomaly arrays  │
  │ 2. Query Firestore issues matching critical state limits │
  │ 3. Prune historical conversations to token constraints  │
  │ 4. Construct lightweight unified JSON package           │
  └─────────────────────────────┬───────────────────────────┘
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 Unified Context JSON                    │
  ├─────────────────────────────────────────────────────────┤
  │ - System metrics, Ward analytics, Priorities (Limit 5)  │
  └─────────────────────────────┬───────────────────────────┘
                                │
                                ▼
  [ Structured Gemini 3.5 Flash Query Ingestion ] ──> Dynamic Admin Response
```

### Caching Strategy & TTL Definitions
- **Ward Metrics & Spatial Shadow Problems**: **15-minute TTL** (Calculated on background cycles).
- **Incident Priorities**: **1-minute TTL** (Reflects live queue updates).

### Context JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "timestamp": { "type": "string", "format": "date-time" },
    "operationalScope": { "type": "string" },
    "cityPerformanceMetrics": {
      "type": "object",
      "properties": {
        "globalHealthScore": { "type": "integer" },
        "activeCount": { "type": "integer" },
        "averageResolutionHours": { "type": "number" }
      },
      "required": ["globalHealthScore", "activeCount", "averageResolutionHours"]
    },
    "criticalIncidents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "category": { "type": "string" },
          "priorityScore": { "type": "integer" },
          "costOfInactionDifference": { "type": "integer" }
        },
        "required": ["id", "title", "category", "priorityScore"]
      }
    },
    "activeShadowProblems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "predictedAnomalyType": { "type": "string" },
          "triggeringIncidentCount": { "type": "integer" }
        },
        "required": ["id", "title", "predictedAnomalyType"]
      }
    }
  },
  "required": ["timestamp", "cityPerformanceMetrics", "criticalIncidents", "activeShadowProblems"]
}
```

---

## 9. Unified AI Explainability Layer (CR #8)

Every AI assessment is structured to include its underlying rationale, improving operator trust and providing clear operational feedback.

```text
                           ┌─────────────────────────────┐
                           │ Consolidated AI Output Model│
                           ├─────────────────────────────┤
                           │ - Output Score/Value        │
                           │ - Supporting Reasoning Array│
                           └──────────────┬──────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
         [ Vision Analysis ]     [ Cost of Inaction ]     [ Priority Scoring ]
         - Cat/Severity/Scale    - Future cost index      - Spatial impact score
         - "reasons": [...]      - "reasons": [...]       - "reasons": [...]
```

### Structured Prompt Implementation Schemas

```json
{
  "severityAnalysis": {
    "score": 8,
    "reasoning": [
      "Significant road surface washouts and pavement breakdown",
      "Presence of standing water accelerates subgrade structural damage",
      "Hazard directly impacts a high-traffic urban thoroughfare"
    ]
  },
  "costOfInactionAnalysis": {
    "repairCostToday": 4000,
    "futureCost90Days": 18000,
    "riskLevel": "High",
    "reasoning": [
      "Subsurface erosion will require structural road rebuilding if unaddressed",
      "High-speed water line rupture causes soil loss under adjacent utilities",
      "Emergency municipal intervention fees multiply with delayed dispatch"
    ]
  },
  "priorityEngineScore": {
    "score": 92,
    "reasoning": [
      "High visual severity matched with accelerated financial decay risk",
      "Upvote confirmation thresholds reached within local community",
      "Target asset is a critical primary arterial roadway"
    ]
  }
}
```

---

## 10. Seeded Demo Dataset Strategy (CR #9)

To support reliable hackathon presentations and offline development, the platform includes a seeded demo database containing realistic spatial clusters.

### Regional Ward Distribution Plan (40-50 Issues)
- **Ward 1 (Indiranagar - Roads Focus)**: 3 severe potholes clustered on primary transport grids.
- **Ward 2 (Koramangala - Water Focus)**: 6 water leakage reports demonstrating pipe pressure issues.
- **Ward 3 (HSR Layout - Garbage Focus)**: 8 waste management reports indicating sanitation gaps.
- **Ward 4 (Jayanagar - Streetlight Focus)**: 5 streetlight failures demonstrating grid maintenance trends.

```text
    [ Ward 1: Indiranagar ] ─────> 3 Potholes (Spelled spatial indicators)
    [ Ward 2: Koramangala ] ────> 6 Water Leakages (Triggers Pipeline Weakness Shadow)
    [ Ward 3: HSR Layout ] ──────> 8 Garbage Accumulations (Triggers Drainage Anomaly)
    [ Ward 4: Jayanagar ] ───────> 5 Streetlights (Drives energy grid analytics)
```

### Fallback Demo Mode Implementation
The API server contains a client-controlled environment toggle (`VITE_USE_DEMO_DATASET=true`). When enabled:
- Cloud database writes are proxied to a clean sandbox namespace (`/issues_demo`).
- External Gemini API endpoints return mock payloads generated directly from predefined static assets, ensuring fully functional offline demos even during API rate-limiting or network outages.

---

## 11. Complete REST API Specifications

The server exposes a series of validated, role-restricted endpoints. All modifying operations require a valid Firebase Auth header (`Authorization: Bearer <Token>`).

### Citizen Operations

#### 1. Ingest Raw Multimodal Input
* **Route**: `POST /api/issues/analyze`
* **Headers**: `Authorization: Bearer <idToken>`
* **Payload (Multipart Form-Data)**:
  - `image`: File buffer (Optional, max 5MB)
  - `audio`: File buffer (Optional, max 60 seconds)
  - `lat`: float
  - `lng`: float
* **Validation Rules**: Must contain at least one valid image or audio stream.
* **Response (200 OK)**:
```json
{
  "success": true,
  "draft": {
    "title": "Severe Water Leakage",
    "description": "Active water pipe burst with structural runoff.",
    "category": "water_leakage",
    "severity": {
      "score": 8,
      "reasoning": ["Active pavement erosion", "Public water wastage"]
    }
  }
}
```

#### 2. Finalize and Submit Report
* **Route**: `POST /api/issues/report`
* **Headers**: `Authorization: Bearer <idToken>`
* **Payload (JSON)**:
```json
{
  "title": "Severe Water Leakage on Koramangala 80 Feet Road",
  "description": "Active pipe burst with surface runoff.",
  "category": "water_leakage",
  "location": {
    "lat": 12.9352,
    "lng": 77.6244,
    "address": "Koramangala 80 Feet Road",
    "wardId": "ward_02"
  },
  "assetType": "water_pipeline",
  "assetId": "PIPE-KORA-80FT-04"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "id": "issue_4832",
  "duplicateFlagged": false
}
```

#### 3. Support & Verify Incident
* **Route**: `POST /api/issues/:id/verify`
* **Headers**: `Authorization: Bearer <idToken>`
* **Payload (JSON)**:
```json
{
  "type": "upvote",
  "evidenceImageUrl": "https://storage.googleapis.com/.../alt_evidence.jpg"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "updatedUpvotes": 15,
  "pointsConferred": 2
}
```

---

### Authority Operations

#### 1. Retrieve Prioritized Dashboard Queue
* **Route**: `GET /api/authority/dashboard`
* **Headers**: `Authorization: Bearer <idToken>`
* **Params**: `wardId` (Optional filter)
* **Response (200 OK)**:
```json
{
  "success": true,
  "incidents": [
    {
      "id": "issue_4832",
      "title": "Severe Water Leakage",
      "priority": { "score": 92, "level": "Critical" },
      "status": "assigned"
    }
  ],
  "shadowProblems": [],
  "wardMetrics": {}
}
```

#### 2. Query Copilot AI
* **Route**: `POST /api/authority/copilot/query`
* **Headers**: `Authorization: Bearer <idToken>`
* **Payload (JSON)**:
```json
{
  "message": "Which areas need immediate attention?"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "response": "Koramangala requires attention due to multiple active water leaks.",
  "suggestedActions": [
    {
      "type": "DISPATCH_DEPT",
      "payload": { "department": "Water Board", "issueId": "issue_4832" }
    }
  ]
}
```

---

## 12. Client-Side Page & Component Hierarchy

To maintain high performance and prevent unnecessary re-renders when map elements shift, state is divided strictly by volatility.

```text
  App (Primary Frame, Routing, Auth & Theme Provider)
   │
   ├── Navigation Header (High-contrast, responsive layout switcher)
   │
   └── Main Canvas Module (Google Maps Layer Container)
        │
        ├── IncidentMap (Google Maps instance, custom styling overrides)
        │    ├── MarkerClusterer (Consolidates active incident indicators)
        │    ├── GeoJsonOverlay (Renders dynamic Ward borders)
        │    └── MapControls (Switches between Heatmaps and Category layers)
        │
        └── Interaction Console Slide Panel
             │
             ├── [ Citizen View ]
             │    ├── IssueReporter (Camera input, audio streams, auto-drafting)
             │    ├── ActiveIssuesList (Geospatial filters, search bar)
             │    └── VerificationWidget (Upvotes, evidence photo uploaders)
             │
             ├── [ Authority Dashboard ]
             │    ├── PriorityQueueList (High-contrast, priority-sorted action cards)
             │    ├── AnomalyTracker (Dynamic indicators for shadow problems)
             │    └── WardHealthMatrix (Radial dials displaying health indexes)
             │
             └── [ Copilot Dashboard ]
                  └── ConversationalChatBox (Message history, actionable suggestions)
```

---

## 13. Security Rules Blueprint (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Auth Validation Helpers
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAuthority() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'authority';
    }

    // Collection Security Rules
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    match /issues/{issueId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.reporterId == request.auth.uid;
      allow update: if isAuthenticated() && (
        isAuthority() || 
        request.resource.data.verification.upvotes == resource.data.verification.upvotes + 1
      );
      allow delete: if isAuthority();
      
      match /statusHistory/{historyId} {
        allow read: if isAuthenticated();
        allow create: if isAuthority() || request.resource.data.role == 'system';
      }
    }
    
    match /shadow_problems/{problemId} {
      allow read: if isAuthenticated();
      allow write: if isAuthority();
    }
    
    match /system_metrics/{metricId} {
      allow read: if isAuthenticated();
      allow write: if false; // Managed purely via backend tasks
    }
  }
}
```

---

## 14. Future-Proof Modularity & Extensibility

- **Digital Twin**: Standardizing coordinates and category parameters makes it easy to map spatial data to web coords, enabling immediate Three.js projection.
- **Crisis Overrides**: The Firestore collection permissions support real-time priority overrides using status flags without altering schema fields.
- **Relational Memory Graphs**: Standardized reference collections (`reporterId`, `triggeringIssueIds`) adapt to Graph representation matrices, protecting system integrity.
- **Resource Simulation**: Cost projection parameters are structured to allow external solvers to compute resource utilization models without requiring backend refactoring.

---

## 15. Recommended Implementation Sequence

```text
  PHASE 1 (Day 1 Morning) ──> Base schemas, Firestore collections, Auth context setup
  PHASE 2 (Day 1 Afternoon) ─> Map instance integration, responsive drawers, camera inputs
  PHASE 3 (Day 1 Evening) ──> Inaction costs and priority algorithm calculations
  PHASE 4 (Day 2 Morning) ──> Gmail/Sheets dispatch alerts and authority boards
  PHASE 5 (Day 2 Afternoon) ─> Copilot query integration, visual polishing, and launch
```
