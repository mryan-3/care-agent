import '../shared/env.js';
import { LlmAgent } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';
import { getActiveConditions, getRecentObservations, getCarePlans, getObservationsByCode } from '../shared/tools/index.js';
import { checkClinicalGuidelines } from './tools/careGap.js';

export const rootAgent = new LlmAgent({
    name: 'care_gap_agent',
    model: 'gemini-2.5-flash',
    description: 'Clinical care gap analyst — identifies overdue tests and missing plans.',
    instruction: `You are a clinical care gap analyst. You receive a patient's active diagnoses, recent lab results, and existing care plans from FHIR.
You compare actual care received against standard clinical guidelines for each diagnosis.
Guidelines: ADA standards for diabetes (HbA1c every 3 months), ACC/AHA guidelines for heart failure (written care plan required), WHO guidelines for asthma (written action plan required, peak flow baseline).
You identify overdue tests, missing care plans, and absent screenings.
You label findings URGENT, IMPORTANT, or STANDARD CARE.
You are a decision support tool — findings require clinical review before action.`,
    tools: [
        getActiveConditions,
        getRecentObservations,
        getObservationsByCode,
        getCarePlans,
        checkClinicalGuidelines,
    ],
    beforeModelCallback: extractFhirContext,
});
