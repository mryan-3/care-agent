import '../shared/env.js';
import { LlmAgent, AgentTool } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';
import { calculateLacePlus } from './tools/lace.js';
import { getPatientDemographics, getActiveConditions, getEncounters } from '../shared/tools/index.js';
import { rootAgent as medicationSpecialist } from '../medication_agent/agent.js';
import { rootAgent as schedulingSpecialist } from '../scheduling_agent/agent.js';
import { rootAgent as careGapSpecialist } from '../care_gap_agent/agent.js';
import {
    auditCareAction,
    getCareAuditLog,
    saveCarePlanBaseline,
    getCarePlanBaseline,
} from './tools/careTransitionState.js';

const medicationTool = new AgentTool({ agent: medicationSpecialist });
const schedulingTool = new AgentTool({ agent: schedulingSpecialist });
const careGapTool = new AgentTool({ agent: careGapSpecialist });

export const rootAgent = new LlmAgent({
    name: 'care_transition_agent',
    model: 'gemini-2.5-flash',
    description: 'Master agent for post-discharge care coordination. Orchestrates medication, scheduling, and care gap sub-agents.',
    instruction: `You are the master CareTransition agent.
Always start by pulling FHIR data for the named patient using the session state credentials (e.g., demographics, encounters, conditions).
Always calculate the LACE+ score from the Encounter and Condition data using the calculateLacePlus tool with inputs you derive from FHIR (LOS, ER admission if encounter class indicates emergency, active condition count, ER visits in 6 months if known from narrative or data).
Always delegate to all three specialist agents (AgentTool): medication_agent, scheduling_agent, and care_gap_agent. Call each at least once per discharge review regardless of risk level. Pass concise context (patient situation, discharge summary, risk level, relevant dates).

After the first full synthesized report for a patient, call saveCarePlanBaseline with a short structured summary (LACE+ score, key actions Today / Day 7-14 / Day 30) so Day 7 or Day 30 follow-ups can use getCarePlanBaseline to compare progress.

When the care manager types CONFIRM or SKIP on a recommendation, call auditCareAction with action CONFIRM or SKIP, a short recommendationId or label, and optional details. Use getCareAuditLog when summarizing what was confirmed or skipped.

Synthesize all sub-agent results into a report structured strictly as:
  Today / By Day 7 or 14 / By Day 30
Apply a social risk modifier (+1 to LACE+ via calculateLacePlus livesAlone) when the care manager mentions living alone or no support.
Offer CONFIRM or SKIP for every actionable recommendation (e.g. booking an appointment).
Frame all output as decision support requiring human confirmation. Never act on clinical matters without explicit care manager approval.
If the care manager types CONFIRM for booking, the scheduling specialist should book via its tools.`,
    tools: [
        getPatientDemographics,
        getActiveConditions,
        getEncounters,
        calculateLacePlus,
        medicationTool,
        schedulingTool,
        careGapTool,
        saveCarePlanBaseline,
        getCarePlanBaseline,
        auditCareAction,
        getCareAuditLog,
    ],
    beforeModelCallback: extractFhirContext,
});
