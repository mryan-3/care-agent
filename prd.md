# CareTransition
## AI-Powered Post-Discharge Care Coordination Agent

**Product Requirements Document — MVP v2.0**
Agents Assemble Hackathon 2026 | Submission Period: March 4 – May 11, 2026
Built on the Prompt Opinion Platform | Google ADK + A2A + FHIR R4

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Judging Panel Analysis](#2-judging-panel-analysis)
3. [Judging Criteria Assessment](#3-judging-criteria-assessment)
4. [Technical Context & Glossary](#4-technical-context--glossary)
5. [System Architecture](#5-system-architecture)
6. [Repo Structure & What You Are Building On](#6-repo-structure--what-you-are-building-on)
7. [How to Build From Your Fork](#7-how-to-build-from-your-fork)
8. [User Stories](#8-user-stories)
9. [Detailed Patient Scenarios](#9-detailed-patient-scenarios)
10. [Agent Communication Flow](#10-agent-communication-flow)
11. [Functional Requirements](#11-functional-requirements)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [PHI, Safety & Regulatory Considerations](#13-phi-safety--regulatory-considerations)
14. [Out of Scope for MVP](#14-out-of-scope-for-mvp)
15. [Hackathon Demo Plan](#15-hackathon-demo-plan)
16. [Build Plan](#16-build-plan)

---

## 1. Product Overview

### 1.1 What Is CareTransition?

CareTransition is an AI-powered care coordination agent built on the Prompt Opinion (PO) platform. It manages the critical 30-day window after a patient is discharged from hospital — the period when most preventable readmissions occur.

A care manager types a plain-English message in the PO Workspace identifying a recently discharged patient. CareTransition pulls the patient's FHIR R4 medical record, calculates their readmission risk using the LACE+ clinical formula, and delegates to three specialist sub-agents — one for medications, one for scheduling, and one for care gaps. All results are synthesized into a single, time-bucketed action plan delivered back to the care manager in seconds.

It does not just give advice. It takes action when instructed — booking appointments, logging confirmations — and can be re-queried at Day 7 and Day 30 to track progress.

### 1.2 The Problem It Solves

Approximately 1 in 5 patients is readmitted to hospital within 30 days of discharge. The cause is rarely clinical failure — it is coordination failure. Medications not collected. Follow-up appointments never booked. Care plans never written. Drug interactions missed at discharge.

Care managers handle this manually today: multiple systems, phone calls, spreadsheets. No single tool connects a patient's discharge event to a complete, coordinated 30-day care plan automatically.

CMS (Centers for Medicare & Medicaid Services) actively penalizes hospitals financially for excessive readmission rates — making this one of the most operationally urgent problems in healthcare administration. The total annual cost to the US healthcare system is approximately $26 billion.

### 1.3 Target User

| Attribute | Details |
|---|---|
| Primary User | Hospital Care Manager — non-technical, manages 20+ patients daily |
| Secondary User | Discharge nurse or clinician reviewing patient readiness before discharge |
| Interface | Prompt Opinion Workspace — plain-language chat |
| Technical Level | Zero. User interacts only via natural language sentences |
| Goal | Know within seconds of a patient's discharge what actions are needed, in what order, and by when |

### 1.4 Why Generative AI — Not Just Rules

This is a question the judges will ask. The answer must be stated clearly and confidently.

LACE+ is a formula. Drug class duplication could theoretically use a lookup table. Care gap detection could use a rules engine. So where does the AI actually matter?

**Reason 1 — Natural language intake.** The care manager types one sentence. The agent extracts the patient name, the clinical context, and the intent — and decides what to do. No forms, no dropdowns, no screen navigation. That parsing and intent resolution is LLM-powered reasoning, not a rule.

**Reason 2 — Synthesis under ambiguity.** When three sub-agents return results simultaneously, the master agent reasons about their combined significance for this specific patient. A medication conflict in a low-risk patient is a note. The same conflict in a HIGH LACE+ patient with no follow-up booked is an emergency. That contextual prioritization is not something a decision tree handles gracefully.

**Reason 3 — Narrative generation.** The final report uses plain language that a non-clinical care manager can act on without interpretation. Generating a human-readable, contextually appropriate narrative from structured FHIR data is a core LLM capability.

**Reason 4 — Dynamic orchestration.** The master agent decides which sub-agents to call, with what inputs, and how to weight conflicting signals. This context-driven delegation is not a hardcoded flow.

---

## 2. Judging Panel Analysis

Understanding what each judge will look for is as important as building the product.

### Josh Mandel, MD — Microsoft Research, Chief Architect for Health

**Who he is:** One of the original architects of SMART on FHIR — the authentication standard that SHARP is modeled on. He will evaluate your FHIR usage with expert precision.

**What will impress him:**
- Using `MedicationStatement` for pre-admission drugs separately from `MedicationRequest` for discharge drugs — most submissions will miss this distinction
- Correct FHIR search parameters: `?patient=`, `_sort=-date`, `_count=1`
- Understanding that FHIR returns **Bundles** and correctly unwrapping `bundle.entry[n].resource`
- Graceful handling of null/missing FHIR fields
- FHIR credentials in session state only — never in the LLM prompt (via `beforeModelCallback`)

**What will lose him:** Superficial FHIR usage — just calling `GET /Patient` and treating that as real integration.

---

### Joshua Hickey — Mayo Clinic, Principal Technical Product Manager

**Who he is:** An operator who has deployed software inside a major health system. He thinks in workflows, not demos.

**What will impress him:**
- The CONFIRM/SKIP conversational action flow — David acts without leaving the chat
- Time-bucketed report structure (Today / Day 7 / Day 30) that maps to how care managers think
- Explicit handling of edge cases: what happens when a FHIR field is empty?

**What will lose him:** A demo that only works in a perfect scenario with clean data and no edge cases mentioned.

---

### Piyush Mathur, MD — Cleveland Clinic, Anesthesiologist, Co-Founder BrainX

**Who he is:** A clinician who also builds AI products. He evaluates both clinical accuracy and AI implementation.

**What will impress him:**
- LACE+ formula implemented correctly
- Medication conflict logic grounded in drug class taxonomy (ACE inhibitors, not just drug name matching)
- Care gap guidelines referenced to real standards (ACC/AHA for heart failure, ADA for diabetes, WHO for asthma)
- Explicit framing of the agent as decision support, not decision maker

**What will lose him:** Any suggestion the agent makes clinical decisions autonomously.

---

### Stephon Proctor, PhD — CHOP, ACHIO for Platform Innovation

**Who he is:** A health IT executive who approves or kills technology deployments. He thinks about governance and implementation paths.

**What will impress him:**
- CareTransition sits on top of existing FHIR APIs — no EHR replacement required
- Human-in-the-loop for every actionable recommendation
- A clear answer to: who is responsible when the agent surfaces wrong information?

**What will lose him:** Ignoring governance. He needs to see that clinicians remain in control.

---

### Alice Zheng, MD, MBA, MPH — Venture Capitalist, ex-McKinsey

**Who she is:** She evaluates market size, differentiation, and product potential.

**What will impress her:**
- The $26B readmission problem is large and quantified
- A concrete before/after: "45 minutes of manual coordination → 15 seconds with CareTransition"
- A clear wedge: most tools handle one post-discharge workflow; this handles three simultaneously

**What will lose her:** A purely technical demo with no human story.

---

### Parth Tripathi — Google, Vertex AI Gemini Serving

**Who he is:** The platform judge. He evaluates correct ADK and A2A usage.

**What will impress him:**
- `AgentTool` used correctly for sub-agent delegation
- `beforeModelCallback` (`extractFhirContext`) used correctly for SHARP
- `FunctionTool` definitions with proper Zod schemas
- Clean, idiomatic ADK patterns throughout

**What will lose him:** Hacking around the ADK instead of using it as intended.

---

## 3. Judging Criteria Assessment

### Criterion 1: The AI Factor

**Assessment: Strong — if framed correctly.**

See Section 1.4 for the four AI advantages. Lead with these in your demo. The counter to "it's just LACE+ plus if-statements" is: the rules are inputs, not the agent. The agent reasons about which rules apply, in what combination, for this patient, at this moment. That reasoning layer is genuinely LLM-powered.

### Criterion 2: Potential Impact

**Assessment: Excellent. Your strongest criterion.**

- 1 in 5 Medicare patients readmitted within 30 days
- $26 billion annual cost in the US
- CMS financially penalizes hospitals for high readmission rates
- Care managers currently spend ~45 minutes per patient on post-discharge coordination

Your hypothesis is clean: catch coordination failures within seconds of discharge instead of hours or days later, and the intervention window improves. Every clinical judge in that room has personally experienced this failure. Alice Zheng will recognize the market. Stephon Proctor will recognize the operational pain.

### Criterion 3: Feasibility

**Assessment: Moderate — your most vulnerable criterion. Address it proactively.**

What works in your favor: FHIR R4 is the correct standard, SHARP keeps credentials out of the prompt, the agent is decision support not decision maker, the architecture is auditable.

What you must address unprompted:

**PHI in the LLM.** Patient data from FHIR reaching Gemini is PHI going to a third-party model. In production this requires a BAA with Google. Say this yourself — do not wait to be asked.

**Clinical liability.** Every action requires human confirmation. The agent surfaces information; humans decide. Frame this explicitly.

**Real EHR integration.** Your demo uses a HAPI FHIR sandbox. Production requires EHR-specific FHIR profile validation. Acknowledge this — it signals maturity to Mandel and Hickey.

---

## 4. Technical Context & Glossary

| Term | Plain English Explanation |
|---|---|
| **FHIR** | Fast Healthcare Interoperability Resources. A standardized JSON format all modern hospital systems use to store and share patient data. You query a FHIR server exactly like a REST API. |
| **FHIR Bundle** | What the FHIR server actually returns — a wrapper object containing an array of matching resources in `bundle.entry[n].resource`. Your agent must unwrap this. |
| **MedicationRequest** | FHIR resource for medications prescribed at or after discharge. |
| **MedicationStatement** | FHIR resource for medications the patient was taking before admission. Separate resource, separate query. This distinction matters to judges. |
| **EHR** | Electronic Health Record. The software hospitals use (Epic, Cerner, etc.). FHIR is the protocol your agent uses to read data from an EHR. |
| **Google ADK** | Google's Agent Development Kit. The framework used to build, run, and wire agents together in this repo. |
| **LlmAgent** | The ADK class that represents an AI agent. Takes a model name, a system instruction, and a list of tools. |
| **FunctionTool** | The ADK class for creating a tool — a function the agent can call. Defined with a name, description, Zod parameter schema, and an execute function. |
| **AgentTool** | The ADK class that wraps another agent as a callable tool. This is how the master agent delegates to sub-agents. Core of the Master-Delegate architecture. |
| **beforeModelCallback** | An ADK lifecycle hook that runs before every LLM call. Used to extract FHIR credentials from A2A metadata into session state before Gemini sees the message. |
| **Session State** | ADK's key-value store per conversation. FHIR credentials are stored here and read by tools at call time. They never appear in the prompt. |
| **A2A** | Agent-to-Agent protocol. Defines how agents call each other over HTTP with standardized JSON-RPC. Each agent exposes `POST /` and `GET /.well-known/agent-card.json`. |
| **Agent Card** | JSON document describing an agent's capabilities and security requirements. How Prompt Opinion discovers your agent. |
| **SHARP** | Prompt Opinion's extension that passes hospital session credentials through the A2A metadata chain automatically. Consumed via `extractFhirContext()` in `shared/fhirHook.ts`. |
| **LACE+ Score** | Clinical readmission risk formula. L = Length of stay. A = Acuity. C = Comorbidities. E = ER visits in past 6 months. Score: 0–4 Low, 5–9 Medium, 10+ High. |
| **HAPI FHIR** | Free, open-source FHIR server for development and testing. Your demo data source. |
| **Synthea** | Generates realistic synthetic patient records in FHIR format. Used to create demo patients. |
| **PHI** | Protected Health Information. Patient names, diagnoses, and medication lists from FHIR are all PHI. Regulated under HIPAA. |
| **BAA** | Business Associate Agreement. Legal contract required under HIPAA before PHI can be shared with a third-party vendor like Google. Required in production. |
| **Decision Support Tool** | A system that surfaces recommendations to a human, who makes the final decision. The correct regulatory framing for CareTransition. |

---

## 5. System Architecture

### 5.1 High-Level Flow

```
PO Workspace (David types a message)
    ↓
A2A POST / with X-API-Key header
    ↓
shared/middleware.ts — validates API key
    ↓
shared/fhirHook.ts — extractFhirContext() as beforeModelCallback
  → reads SHARP metadata: { fhirUrl, fhirToken, patientId }
  → stores in session state — never in the LLM prompt
    ↓
care_transition_agent — Master Agent (LlmAgent)
  → queries FHIR for 10 resource types
  → calculates LACE+ score
  → delegates via AgentTool:
        ↓                    ↓                    ↓
  medication_agent      scheduling_agent      care_gap_agent
  (drug conflicts,      (missing follow-      (overdue tests,
   unfilled Rx,          ups, next slots,      missing plans,
   interactions)         booking)              guidelines)
        ↓                    ↓                    ↓
        └────────────────────┴────────────────────┘
                             ↓
              Master Agent synthesizes all results
                             ↓
           Unified time-bucketed care plan → David
```

### 5.2 Port Assignments

| Agent | Folder | Port |
|---|---|---|
| Master Agent (CareTransition) | `care_transition_agent/` | 8000 |
| Medication Agent | `medication_agent/` | 8001 |
| Scheduling Agent | `scheduling_agent/` | 8002 |
| Care Gap Agent | `care_gap_agent/` | 8003 |

### 5.3 FHIR Resources Used

| FHIR Resource | Contents | Used By | Key Search Parameters |
|---|---|---|---|
| `Patient` | Name, age, gender, address | Master Agent | `/Patient/{id}` |
| `Condition` | Active diagnoses | Master Agent, Care Gap Agent | `?patient=&clinical-status=active` |
| `MedicationRequest` | Medications prescribed at/after discharge | Medication Agent | `?patient=&status=active` |
| `MedicationStatement` | Medications taken before admission | Medication Agent | `?patient=&status=active` |
| `Encounter` | Admission details, length of stay, type | Master Agent (LACE+) | `?patient=&_sort=-date&_count=10` |
| `Appointment` | Scheduled visits | Scheduling Agent | `?patient=&date=gt[today]` |
| `Practitioner` | GP and specialist details | Scheduling Agent | `/Practitioner/{id}` |
| `Observation` | Lab results, vitals | Care Gap Agent | `?patient=&code=[LOINC]&_sort=-date` |
| `CarePlan` | Existing written care plans | Care Gap Agent | `?patient=&status=active` |
| `AllergyIntolerance` | Known drug allergies | Medication Agent | `?patient=` |

### 5.4 Critical FHIR Implementation Note

FHIR servers return **Bundles**, not single resources. Every query response must be unwrapped:

```
Response shape:
{
  resourceType: "Bundle",
  entry: [
    { resource: { resourceType: "MedicationRequest", ... } },
    { resource: { resourceType: "MedicationRequest", ... } }
  ]
}

Correct access:
const medications = bundle.entry?.map(e => e.resource) ?? [];
```

Missing or empty `entry` arrays must always be handled gracefully. Never assume a field is populated.

---

## 6. Repo Structure & What You Are Building On

Your fork of `prompt-opinion/po-adk-typescript` currently contains:

```
care-agent/
├── general_agent/          ← example: minimal agent, no FHIR (reference only)
│   ├── agent.ts            ← LlmAgent definition, tools list
│   ├── server.ts           ← A2A Express server setup
│   └── tools/general.ts    ← FunctionTool examples
├── healthcare_agent/       ← example: FHIR-connected agent (your sub-agent template)
│   ├── agent.ts            ← LlmAgent with beforeModelCallback — copy this
│   └── server.ts           ← A2A server with FHIR extension URI — copy this
├── orchestrator/           ← example: delegates to other agents (your master template)
│   ├── agent.ts            ← AgentTool delegation pattern — study this carefully
│   └── server.ts
├── shared/                 ← DO NOT modify unless adding new FHIR tools
│   ├── env.ts              ← loads .env, aliases GOOGLE_API_KEY
│   ├── appFactory.ts       ← createA2aApp() — builds A2A Express server for any agent
│   ├── middleware.ts        ← apiKeyMiddleware() — X-API-Key validation
│   ├── fhirHook.ts         ← extractFhirContext() — SHARP credential extraction
│   └── tools/
│       ├── index.ts        ← re-exports all shared tools
│       └── fhir.ts         ← FHIR R4 query FunctionTools — extend this file
├── .env.example
├── Dockerfile              ← single Dockerfile, AGENT_MODULE selects which agent runs
├── docker-compose.yml      ← runs all agents locally
├── package.json
└── tsconfig.json
```

### What Each Existing File Does For You

**`shared/fhirHook.ts`** — Your SHARP integration, already written. Runs as `beforeModelCallback`, reads FHIR credentials from A2A metadata, puts them into session state. Use it as-is in every agent that needs FHIR.

**`shared/tools/fhir.ts`** — Pre-built FunctionTools for FHIR queries. You extend this file with the additional resource types CareTransition needs.

**`shared/appFactory.ts`** — Builds the entire A2A-compliant Express server. Call `createA2aApp(agent, options)` in each agent's `server.ts` and get a working endpoint for free.

**`orchestrator/agent.ts`** — Your master agent template. Shows exactly how to use `AgentTool` to wrap another agent and delegate to it. Read this file before writing any master agent code.

**`healthcare_agent/agent.ts`** — Your sub-agent template. Shows how to wire `extractFhirContext` as `beforeModelCallback` and reference FHIR tools.

### What You Will Add

```
care-agent/
├── care_transition_agent/      ← NEW: master agent
│   ├── agent.ts
│   ├── server.ts
│   └── tools/lace.ts           ← LACE+ calculator (pure math, no FHIR)
├── medication_agent/           ← NEW: sub-agent 1
│   ├── agent.ts
│   ├── server.ts
│   └── tools/medication.ts     ← drug comparison, interaction, pharmacy fill tools
├── scheduling_agent/           ← NEW: sub-agent 2
│   ├── agent.ts
│   ├── server.ts
│   └── tools/scheduling.ts     ← appointment check, slot finder, booking tools
├── care_gap_agent/             ← NEW: sub-agent 3
│   ├── agent.ts
│   ├── server.ts
│   └── tools/careGap.ts        ← guideline comparison, gap detection tools
└── shared/tools/fhir.ts        ← EXTEND with 7 new FunctionTool definitions
```

The original three example folders stay untouched as reference material.

---

## 7. How to Build From Your Fork

This is your step-by-step construction guide. No code — just the exact sequence of actions and decisions.

### Step 1 — Clone and Verify the Baseline (Day 1)

Clone your fork:
```
git clone https://github.com/YOUR-USERNAME/po-adk-typescript.git
cd po-adk-typescript
npm install
cp .env.example .env
```

Open `.env` and set `GOOGLE_API_KEY` to your Google AI Studio key (free at aistudio.google.com). Leave all other values at their defaults.

Run the example agents:
```
npm run dev
```

Verify each is alive:
```
curl http://localhost:8001/.well-known/agent-card.json
curl http://localhost:8002/.well-known/agent-card.json
curl http://localhost:8003/.well-known/agent-card.json
```

You should receive JSON agent cards. If you do, your foundation works. Do not proceed to Step 2 until all three agent cards return successfully. This is your baseline — everything you build depends on it.

---

### Step 2 — Set Up Your FHIR Sandbox (Day 1–2)

You need a running FHIR server with realistic patient data before writing any agent logic.

**Run HAPI FHIR locally via Docker:**
```
docker run -p 8080:8080 hapiproject/hapi:latest
```

Verify it is running:
```
curl http://localhost:8080/fhir/metadata
```

A long JSON capability statement means it is live.

**Load Synthea patient data:**

Download pre-generated Synthea FHIR bundles from the Synthea GitHub releases page. For your demo you need at minimum two patient records that match the James Omondi and Amina Waweru profiles — or use real Synthea-generated patients and reference them by their Synthea-assigned IDs in your demo narrative.

Load each bundle by POSTing the JSON file to `http://localhost:8080/fhir` as a FHIR transaction bundle.

After loading, note the FHIR `id` values assigned to each patient — you will use these as `patientId` in your A2A test requests.

**Alternative if Docker is unavailable:** Use the public HAPI test server at `https://hapi.fhir.org/baseR4` for early development. Switch to local Docker before your final demo for reliability and speed.

---

### Step 3 — Extend `shared/tools/fhir.ts` (Day 2–3)

Before building any agent, add the FHIR query tools that CareTransition needs. Open `shared/tools/fhir.ts` and add new `FunctionTool` definitions for:

- `getMedicationRequests` — discharge medications (`MedicationRequest?patient=&status=active`)
- `getMedicationStatements` — pre-admission medications (`MedicationStatement?patient=&status=active`)
- `getAllergyIntolerances` — known drug allergies
- `getEncounters` — admission history for LACE+ (`Encounter?patient=&_sort=-date&_count=10`)
- `getAppointments` — upcoming appointments (`Appointment?patient=&date=gt[today]`)
- `getObservationsByCode` — specific lab results by LOINC code
- `getCarePlans` — active care plans

Every tool must: read `fhirUrl`, `fhirToken`, `patientId` from `toolContext.state`, make the FHIR query, unwrap the Bundle response, and handle empty/null entries gracefully. Follow the exact pattern of the existing tools already in `fhir.ts`.

Export each new tool from `shared/tools/index.ts`.

Test each tool by calling the healthcare_agent with the appropriate FHIR query and verifying you get data back from your HAPI sandbox.

---

### Step 4 — Build the Three Sub-Agents (Day 3–9)

Build and test each sub-agent independently before wiring them to the master agent. The file structure for each is identical — only the system instruction and tools list differ.

**Template for each sub-agent:**

- `agent.ts`: Copy from `healthcare_agent/agent.ts`. Change the agent name, description, system instruction, and tools list. Keep `beforeModelCallback: extractFhirContext` — all three sub-agents need FHIR.
- `server.ts`: Copy from `healthcare_agent/server.ts`. Change the agent name, description, and port number. Keep the FHIR extension URI.

**Medication Agent (port 8001)**

System instruction: You are a medication safety specialist. You receive a patient's discharge medication list and their pre-admission medication list from FHIR. You identify: (1) drug class duplications where the same therapeutic class appears in both lists, (2) medications with no pharmacy fill record since discharge, (3) known drug-drug interactions of moderate or severe severity. You check the AllergyIntolerance record for known drug allergies. You return structured findings labeled CRITICAL, WARNING, or NOTE. You are a decision support tool — all findings require human review before action.

Tools: `getMedicationRequests`, `getMedicationStatements`, `getAllergyIntolerances`, plus your new `medication.ts` tools for drug class comparison and interaction detection.

**Scheduling Agent (port 8002)**

System instruction: You are an appointment coordination specialist. You receive a patient's discharge instructions and their current FHIR appointment records. You check whether a required follow-up appointment exists within the discharge instruction timeframe. If no appointment exists, you identify the next available slot with the relevant clinician. You return appointment status, required timeline, and next available slot. When explicitly instructed by the care manager, you book the appointment.

Tools: `getAppointments`, plus your new `scheduling.ts` tools for slot discovery and appointment booking.

**Care Gap Agent (port 8003)**

System instruction: You are a clinical care gap analyst. You receive a patient's active diagnoses, recent lab results, and existing care plans from FHIR. You compare actual care received against standard clinical guidelines for each diagnosis. Guidelines: ADA standards for diabetes (HbA1c every 3 months), ACC/AHA guidelines for heart failure (written care plan required), WHO guidelines for asthma (written action plan required, peak flow baseline). You identify overdue tests, missing care plans, and absent screenings. You label findings URGENT, IMPORTANT, or STANDARD CARE. You are a decision support tool — findings require clinical review before action.

Tools: `getConditions`, `getObservationsByCode`, `getCarePlans`, plus your `careGap.ts` tools for guideline comparison.

**Testing each sub-agent independently:**

Once a sub-agent is running, test it directly with curl using the same A2A JSON-RPC format shown in the repo README, including the FHIR context metadata for your sandbox patient. Verify it returns structured findings before proceeding.

---

### Step 5 — Build the Master Agent (Day 9–13)

The master agent is your expanded orchestrator. Base its structure on `orchestrator/agent.ts`.

**In `care_transition_agent/agent.ts`:**

Import each sub-agent using `AgentTool`. Import the FHIR data-fetching tools. Import your LACE+ calculator tool (a pure `FunctionTool` — just math, no FHIR).

Write a detailed system instruction that tells the master agent to:
- Always start by pulling FHIR data for the named patient using the session state credentials
- Always calculate the LACE+ score from the Encounter and Condition data
- Always call all three sub-agents regardless of risk level
- Synthesize all results into a report structured as: Today / By Day 7 or 14 / By Day 30
- Apply a social risk modifier (living alone, no support system) when mentioned by the care manager
- Offer CONFIRM or SKIP for every actionable recommendation
- Frame all output as decision support requiring human confirmation
- Never act on clinical matters without explicit care manager approval

**In `.env`, add your sub-agent URLs:**
```
MEDICATION_AGENT_URL=http://localhost:8001
SCHEDULING_AGENT_URL=http://localhost:8002
CARE_GAP_AGENT_URL=http://localhost:8003
CARE_TRANSITION_AGENT_URL=http://localhost:8000
```

---

### Step 6 — Update `docker-compose.yml` and `package.json` (Day 13)

Add your four new agents to `docker-compose.yml` following the exact same pattern as the existing three — each with its own service, port mapping, and `AGENT_MODULE` environment variable.

Add `npm run dev:care-transition`, `npm run dev:medication`, `npm run dev:scheduling`, `npm run dev:care-gap` scripts to `package.json`. Update `npm run dev` to start all seven agents simultaneously (three originals + four new).

---

### Step 7 — End-to-End Local Testing (Day 13–16)

With all four CareTransition agents running, test the full flow:

```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-secret-key-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "James Omondi was discharged this morning after a 4-day heart failure admission. What do we need to do?"}],
        "metadata": {
          "https://your-workspace.promptopinion.ai/schemas/a2a/v1/fhir-context": {
            "fhirUrl": "http://localhost:8080/fhir",
            "fhirToken": "",
            "patientId": "YOUR-SYNTHEA-PATIENT-ID"
          }
        }
      }
    }
  }'
```

Test both patient scenarios. Test with missing FHIR fields to verify null handling. Test the CONFIRM flow. Test the Day 7 re-query. Do not proceed to deployment until all five of these pass.

---

### Step 8 — Deploy to Google Cloud Run (Day 16–19)

Deploy sub-agents first, master agent last. The master agent's environment variables must point to the deployed Cloud Run URLs of the sub-agents — not localhost.

Deploy in this order:
1. `medication_agent` → note its Cloud Run URL
2. `scheduling_agent` → note its Cloud Run URL
3. `care_gap_agent` → note its Cloud Run URL
4. `care_transition_agent` → set `MEDICATION_AGENT_URL`, `SCHEDULING_AGENT_URL`, `CARE_GAP_AGENT_URL` to the three Cloud Run URLs above

Use the existing `Dockerfile` in the repo — it already handles all agents via `AGENT_MODULE`. Follow the `gcloud run deploy` command pattern in the README.

---

### Step 9 — Connect to Prompt Opinion Platform (Day 19–21)

Register each agent in the PO platform by providing its agent card URL:
```
https://YOUR-MEDICATION-AGENT.run.app/.well-known/agent-card.json
https://YOUR-SCHEDULING-AGENT.run.app/.well-known/agent-card.json
https://YOUR-CARE-GAP-AGENT.run.app/.well-known/agent-card.json
https://YOUR-CARE-TRANSITION-AGENT.run.app/.well-known/agent-card.json
```

Update `FHIR_EXTENSION_URI` in each agent to match your Prompt Opinion workspace URI. Test the full flow from the actual PO Workspace — type James's message and verify the care plan appears.

---

### Step 10 — Demo Video (Day 21–23)

Record the demo. See Section 15 for the exact script.

---

## 8. User Stories

### US-01: Initiate Post-Discharge Review

| | |
|---|---|
| As a... | Care Manager (David) |
| I want to... | Type a patient's name and discharge context and receive a complete risk assessment |
| So that... | I know within seconds what actions are needed |
| Acceptance Criteria | Response within 15 seconds with LACE+ score, medication findings, scheduling status, and care gaps in one report |

### US-02: Understand Medication Risks

| | |
|---|---|
| As a... | Care Manager |
| I want to... | See a clear list of medication conflicts and unfilled prescriptions |
| So that... | I can alert the pharmacist or call the patient before a dangerous error occurs |
| Acceptance Criteria | Drug class duplications and unfilled Rx identified and labeled CRITICAL / WARNING / NOTE |

### US-03: Check Follow-Up Appointment Status

| | |
|---|---|
| As a... | Care Manager |
| I want to... | Know immediately if a follow-up appointment is booked |
| So that... | I can arrange one before the discharge window expires |
| Acceptance Criteria | Scheduling Agent checks FHIR, identifies missing bookings, surfaces next available slot |

### US-04: Confirm an Action via Conversation

| | |
|---|---|
| As a... | Care Manager |
| I want to... | Type CONFIRM or SKIP to approve or dismiss a recommendation |
| So that... | I can act without leaving the chat |
| Acceptance Criteria | Agent acknowledges, logs the action, provides success message |

### US-05: Re-Query at Day 7 or Day 30

| | |
|---|---|
| As a... | Care Manager |
| I want to... | Ask for a progress update mid-way through a patient's 30-day window |
| So that... | I can see what is done and what is still outstanding |
| Acceptance Criteria | Agent re-queries FHIR and compares against the original care plan |

---

## 9. Detailed Patient Scenarios

### Scenario A: James Omondi — HIGH Risk

#### Patient Profile

| Field | Value |
|---|---|
| Name | James Omondi |
| Age | 65 |
| Discharge Reason | Heart failure, 4-day admission |
| Active Diagnoses | Heart failure, Type 2 Diabetes, Hypertension |
| Discharge Medications | Lisinopril 10mg, Furosemide 40mg, Metformin 500mg, Bisoprolol 2.5mg, Aspirin 75mg |
| Pre-Admission Medications | Ramipril 5mg, Metformin 500mg, Amlodipine 5mg |
| Prior ER Visits (6 months) | 2 |
| Follow-Up Booked | None |
| Last HbA1c | 7 months ago |
| Care Plan on File | None |
| **LACE+ Score** | **11 — HIGH RISK** |

#### LACE+ Breakdown

| Component | Data | Points |
|---|---|---|
| L — Length of Stay | 4 days | 4 |
| A — Acuity | ER admission | 3 |
| C — Comorbidities | 3 conditions | 2 |
| E — ER visits (6 months) | 2 visits | 2 |
| **Total** | | **11 / 19 — HIGH** |

#### David's Message
> *"James Omondi was discharged this morning after a 4-day heart failure admission. What do we need to do?"*

#### SHARP Injects (silently, before agent sees message)
- `patientId`: james-omondi-001
- `fhirUrl`: hospital FHIR endpoint
- `fhirToken`: session auth token

#### Sub-Agent Findings

**Medication Agent:**
- CRITICAL: Lisinopril (discharge) + Ramipril (pre-admission) — same drug class (ACE inhibitor). Dangerous duplicate. Pharmacist review immediately.
- WARNING: Metformin 500mg — no pharmacy fill event since discharge.

**Scheduling Agent:**
- ALERT: No cardiology appointment found. Discharge requires follow-up within 7 days. Dr. Kamau next available: Day 5 at 10:00 AM.

**Care Gap Agent:**
- URGENT: HbA1c overdue by 4 months (ADA standard: every 3 months).
- IMPORTANT: No heart failure care plan on file (ACC/AHA CHF guidelines require one).

#### What David Sees

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CareTransition Report — James Omondi
  🔴 HIGH RISK  |  LACE+ Score: 11/19
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  DO THIS TODAY
  ⚠️  CRITICAL: Lisinopril + Ramipril — same drug class.
      Send to pharmacist immediately.
  📞  Metformin not collected. Call James today.

  DO THIS BY DAY 7
  📅  No cardiology appointment booked.
      Dr. Kamau available Day 5 at 10:00 AM.
      Reply CONFIRM to book, or SKIP to handle manually.

  DO THIS BY DAY 30
  🩸  Order HbA1c — overdue by 4 months.
  📄  Create heart failure care plan — none on file.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

David types: *"Confirm"*
Agent: *"Done. Cardiology appointment booked — Day 5 at 10:00 AM with Dr. Kamau. Logged."*

---

### Scenario B: Amina Waweru — MEDIUM Risk

#### Patient Profile

| Field | Value |
|---|---|
| Name | Amina Waweru |
| Age | 45 |
| Discharge Reason | Severe asthma attack, 2-day admission |
| Active Diagnoses | Asthma |
| Discharge Medications | Salbutamol inhaler, Prednisolone 40mg (tapering), Cetirizine 10mg, Montelukast 10mg |
| Pre-Admission Medications | Cetirizine 10mg |
| Prior ER Visits (6 months) | 0 |
| Social Context | Lives alone |
| Follow-Up Booked | None |
| Asthma Action Plan | None |
| Peak Flow Baseline | Never recorded |
| **LACE+ Score** | **6 — MEDIUM RISK** |

#### LACE+ Breakdown

| Component | Data | Points |
|---|---|---|
| L — Length of Stay | 2 days | 2 |
| A — Acuity | ER admission | 3 |
| C — Comorbidities | 1 condition | 0 |
| E — ER visits (6 months) | 0 | 0 |
| Social modifier | Lives alone | +1 |
| **Total** | | **6 / 19 — MEDIUM** |

#### Sub-Agent Findings

**Medication Agent:**
- WARNING: Prednisolone is a tapering prescription with no written schedule. Patient needs day-by-day instructions (40mg → 30mg → 20mg → 10mg → stop).
- NOTE: Mild interaction between Cetirizine and Salbutamol — sedation risk. Flag for GP.

**Scheduling Agent:**
- ALERT: No GP follow-up found. Discharge requires review within 14 days. Dr. Njeri available Day 10 at 2:00 PM.

**Care Gap Agent:**
- IMPORTANT: No Asthma Action Plan on file (WHO asthma guidelines require one for all patients).
- STANDARD CARE: No peak flow baseline ever recorded.

#### What David Sees

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CareTransition Report — Amina Waweru
  🟡 MEDIUM RISK  |  LACE+ Score: 6/19
  ⚠️  Social flag: Patient lives alone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  DO THIS TODAY
  📋  Send Prednisolone tapering schedule.
      Day-by-day dosing: 40→30→20→10mg then stop.
  ⚠️  Mild interaction: Cetirizine + Salbutamol. Note for GP.

  DO THIS BY DAY 14
  📅  No GP follow-up booked.
      Dr. Njeri available Day 10 at 2:00 PM.
      Reply CONFIRM to book, or SKIP to handle manually.

  DO THIS BY DAY 30
  📄  Create Asthma Action Plan — none on file.
  🌬️  Schedule peak flow baseline — never recorded.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

David types: *"Confirm"*
Agent: *"Done. GP appointment booked — Day 10 at 2:00 PM with Dr. Njeri. Logged."*

---

## 10. Agent Communication Flow

### James Omondi — Full Step-by-Step

| Step | Actor | Input | Output |
|---|---|---|---|
| 1 | David | Types discharge query | A2A POST to master agent at port 8000 |
| 2 | middleware + fhirHook | A2A metadata | Patient ID + FHIR URL + auth token in session state |
| 3 | Master Agent | Session state credentials | 8 FHIR queries fired across all resource types |
| 4 | Master Agent | Encounter + Condition data | LACE+ calculated = 11, HIGH RISK |
| 5 | Master → Medication Agent | Meds data via AgentTool | A2A call to port 8001 |
| 6 | Medication Agent | MedicationRequest + MedicationStatement + AllergyIntolerance | Returns: ACE inhibitor duplicate (CRITICAL), Metformin unfilled (WARNING) |
| 7 | Master → Scheduling Agent | Discharge instructions + Appointments via AgentTool | A2A call to port 8002 |
| 8 | Scheduling Agent | Appointment records + Practitioner availability | Returns: No follow-up, Day 5 slot with Dr. Kamau |
| 9 | Master → Care Gap Agent | Conditions + Observations + CarePlan via AgentTool | A2A call to port 8003 |
| 10 | Care Gap Agent | Diagnoses + lab history + guidelines | Returns: HbA1c overdue, no CHF care plan |
| 11 | Master Agent | All 3 sub-agent responses | Synthesizes unified time-bucketed report |
| 12 | David | Reads report | Types CONFIRM |
| 13 | Scheduling Agent | Booking instruction from master | Books appointment, FHIR write |
| 14 | Master Agent | Booking confirmation | Reports success to David |

---

## 11. Functional Requirements

### Master Agent

| ID | Requirement | Priority |
|---|---|---|
| MA-01 | Accept natural language identifying a patient by name | Must Have |
| MA-02 | Read SHARP context for patient ID and FHIR auth token | Must Have |
| MA-03 | Query all 10 FHIR resource types in Section 5.3 | Must Have |
| MA-04 | Handle null/empty FHIR Bundle entries without crashing | Must Have |
| MA-05 | Calculate LACE+ from Encounter + Condition data | Must Have |
| MA-06 | Delegate to all three sub-agents via AgentTool | Must Have |
| MA-07 | Synthesize results into time-bucketed report | Must Have |
| MA-08 | Accept CONFIRM / SKIP and act accordingly | Must Have |
| MA-09 | Re-query FHIR for Day 7 / Day 30 progress update | Should Have |
| MA-10 | Apply social risk modifier when patient lives alone | Should Have |

### Medication Agent

| ID | Requirement | Priority |
|---|---|---|
| MED-01 | Receive and compare discharge vs pre-admission medication lists | Must Have |
| MED-02 | Detect same-class drug duplications across both lists | Must Have |
| MED-03 | Identify medications with no pharmacy fill event post-discharge | Must Have |
| MED-04 | Check AllergyIntolerance for known drug allergies | Must Have |
| MED-05 | Label findings: CRITICAL / WARNING / NOTE | Must Have |
| MED-06 | Detect moderate-to-severe drug-drug interactions | Should Have |

### Scheduling Agent

| ID | Requirement | Priority |
|---|---|---|
| SCH-01 | Receive discharge instructions and Appointment FHIR data | Must Have |
| SCH-02 | Determine if a post-discharge follow-up appointment exists | Must Have |
| SCH-03 | Extract required follow-up timeline from discharge instructions | Must Have |
| SCH-04 | Identify next available clinician slot | Must Have |
| SCH-05 | Return appointment status, required timeline, next slot | Must Have |
| SCH-06 | Write confirmed appointment to FHIR when instructed | Should Have |

### Care Gap Agent

| ID | Requirement | Priority |
|---|---|---|
| GAP-01 | Receive diagnoses, lab results, and care plan records | Must Have |
| GAP-02 | Compare care received against clinical guidelines per diagnosis | Must Have |
| GAP-03 | Identify overdue tests with time-since-due | Must Have |
| GAP-04 | Identify missing care plans and documentation | Must Have |
| GAP-05 | Label gaps: URGENT / IMPORTANT / STANDARD CARE | Must Have |

---

## 12. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Full response including all 3 sub-agents | Under 15 seconds |
| Reliability | Graceful handling of missing or null FHIR fields | Zero crashes on missing data |
| Security | FHIR credentials in session state only — never in LLM prompt | Enforced via `beforeModelCallback` |
| Security | All A2A endpoints protected by X-API-Key | Enforced via `apiKeyMiddleware` |
| Usability | Reports use plain language — no medical jargon in user output | Zero technical terms in report cards |
| Compatibility | Runs on Prompt Opinion platform via TypeScript ADK | PO platform compliant |
| Demo | Full two-patient demo completable in under 3 minutes | Under 3 minutes |
| Data | Works with Synthea-generated data on HAPI FHIR R4 | HAPI FHIR sandbox |
| Auditability | Every agent action logged with timestamp and agent identity | Console logging minimum |

---

## 13. PHI, Safety & Regulatory Considerations

These three statements must be delivered proactively in your demo. Do not wait to be asked.

### Statement 1 — PHI and the LLM

> "In production, CareTransition runs under a Google Business Associate Agreement (BAA), which Google offers for Vertex AI. Alternatively, patient identifiers are tokenized before reaching the model and de-tokenized on output. For this hackathon demo, we use entirely synthetic Synthea-generated data — no real patient information is used."

This inoculates you against the HIPAA question from every judge in the room.

### Statement 2 — Clinical Decision Support Framing

> "CareTransition is a decision support tool, not a clinical decision maker. Every actionable recommendation requires explicit care manager confirmation — CONFIRM or SKIP. The agent cannot act autonomously on clinical matters. This is the correct framing for a Class II clinical decision support tool under FDA guidance."

This directly addresses Piyush Mathur's clinical liability concern and Stephon Proctor's governance concern simultaneously.

### Statement 3 — Real EHR Integration Path

> "This demo uses HAPI FHIR with Synthea data. In production, this would require EHR-specific FHIR profile validation to handle vendor extensions and data quality variations in Epic, Cerner, or other EHR systems. The FHIR R4 standard provides the portable foundation; production deployment adds an EHR-specific validation layer."

This signals maturity to Josh Mandel and Joshua Hickey.

---

## 14. Out of Scope for MVP

| Feature | Phase |
|---|---|
| MCP Tool: Pharmacy Proximity Checker | Phase 2 |
| MCP Tool: Patient SMS / WhatsApp Dispatcher | Phase 2 |
| MCP Tool: EHR Write-Back for care plans and lab orders | Phase 2 |
| MCP Tool: Readmission Risk Dashboard (all patients, ranked) | Phase 2 |
| MCP Tool: Live Clinical Guidelines API (WHO / NICE) | Phase 2 |
| PHI tokenization / de-identification layer | Phase 2 |
| Multi-hospital support | Phase 2 |
| Patient-facing interface | Phase 2 |
| Automated monitoring without care manager trigger | Phase 3 |
| FDA Class II medical device submission process | Phase 3 |

---

## 15. Hackathon Demo Plan

Submission requires a video under 3 minutes. Every second is planned.

| Timestamp | On Screen | What It Demonstrates |
|---|---|---|
| 0:00 – 0:15 | Title card. One stat: "1 in 5 patients readmitted within 30 days. The cause is coordination failure — not clinical failure." | Problem hook — lands with every clinical judge |
| 0:15 – 0:45 | David opens PO Workspace. Types James's message. Show FHIR queries firing in logs. LACE+ = 11 appears. | FHIR depth — wins Josh Mandel |
| 0:45 – 1:15 | Three sub-agents called via A2A. Medication CRITICAL surfaces. No appointment found. HbA1c overdue. | A2A delegation — wins Parth Tripathi |
| 1:15 – 1:40 | Unified report appears on screen. David types CONFIRM. Appointment booked. Success message. | Human-in-the-loop — wins Stephon Proctor and Piyush Mathur |
| 1:40 – 2:10 | Switch to Amina. MEDIUM risk. Tapering schedule surfaced. Social flag. GP booked. | Second scenario — shows breadth, not just one happy path |
| 2:10 – 2:35 | Architecture diagram. Deliver Statement 1 (PHI/BAA) and Statement 2 (decision support framing) from Section 13. | Feasibility — wins the full panel |
| 2:35 – 2:50 | Before/after: "45 minutes of manual coordination across 4 systems. 15 seconds with CareTransition." | Impact — closes Alice Zheng's evaluation |
| 2:50 – 3:00 | "Published to PO Marketplace. Any hospital with a FHIR R4 endpoint can connect today." | Platform fit — closes the submission |

---

## 16. Build Plan

| Phase | Tasks | Days |
|---|---|---|
| **1 — Baseline** | Clone fork, npm install, cp .env.example, set GOOGLE_API_KEY, run npm run dev, verify 3 agent cards return | 1 |
| **2 — FHIR Sandbox** | Run HAPI FHIR via Docker, generate Synthea patients, load FHIR bundles, note patient IDs, verify curl queries return data | 1–2 |
| **3 — FHIR Tools** | Add 7 new FunctionTools to `shared/tools/fhir.ts`, export from index.ts, test each against HAPI sandbox, verify Bundle unwrapping and null handling | 2–3 |
| **4 — Medication Agent** | Create `medication_agent/`, write agent.ts + server.ts (port 8001), write medication.ts tools, test independently with curl | 3–5 |
| **5 — Scheduling Agent** | Create `scheduling_agent/`, write agent.ts + server.ts (port 8002), write scheduling.ts tools, test independently | 5–7 |
| **6 — Care Gap Agent** | Create `care_gap_agent/`, write agent.ts + server.ts (port 8003), write careGap.ts tools, test independently | 7–9 |
| **7 — Master Agent** | Create `care_transition_agent/`, write lace.ts calculator tool, wire all three sub-agents via AgentTool, write system instruction, run full delegation test | 9–13 |
| **8 — Conversation Layer** | Implement CONFIRM/SKIP handling, test Day 7 re-query flow, polish report output formatting | 13–15 |
| **9 — Integration** | Update docker-compose.yml + package.json for all 4 new agents, full end-to-end curl test both patient scenarios, test null/missing field edge cases | 15–17 |
| **10 — Cloud Deploy** | Deploy medication → scheduling → care gap → master to Google Cloud Run in order, update env vars with Cloud Run URLs | 17–19 |
| **11 — PO Platform** | Register all 4 agent cards in Prompt Opinion, configure FHIR extension URI, test full flow from actual PO Workspace | 19–21 |
| **12 — Demo Video** | Record both patient scenarios, record architecture + PHI/BAA statements, edit to under 3 minutes, submit | 21–23 |
| **TOTAL** | | **~23 days** |

---

*CareTransition — PRD v2.0 — Agents Assemble Hackathon 2026*
*Google ADK + A2A Protocol + FHIR R4 + Prompt Opinion Platform*
