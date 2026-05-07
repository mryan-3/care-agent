import '../shared/env.js';
import { LlmAgent } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';
import {
    getMedicationRequests,
    getMedicationStatements,
    getAllergyIntolerances,
    getMedicationDispenses,
} from '../shared/tools/index.js';
import { compareDrugClasses, checkPharmacyFills, checkDrugInteractions } from './tools/medication.js';

export const rootAgent = new LlmAgent({
    name: 'medication_agent',
    model: 'gemini-2.5-flash',
    description: 'Medication safety specialist — checks drug duplications, interactions, and pharmacy fills.',
    instruction: `You are a medication safety specialist. You receive a patient's discharge medication list and their pre-admission medication list from FHIR.
You identify: (1) drug class duplications where the same therapeutic class appears in both lists, (2) medications with no pharmacy fill event since discharge, (3) known drug-drug interactions of moderate or severe severity.
You check the AllergyIntolerance record for known drug allergies.
You return structured findings labeled CRITICAL, WARNING, or NOTE.
You are a decision support tool — all findings require human review before action.`,
    tools: [
        getMedicationRequests,
        getMedicationStatements,
        getMedicationDispenses,
        getAllergyIntolerances,
        compareDrugClasses,
        checkPharmacyFills,
        checkDrugInteractions,
    ],
    beforeModelCallback: extractFhirContext,
});
