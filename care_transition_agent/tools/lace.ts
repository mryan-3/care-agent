import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';

/**
 * LACE+ readmission risk (PRD MVP v2.0 — Scenario A/B tables).
 * L = length of stay (days, 1 point per day). A = acuity (ER admission = 3).
 * C = comorbidities (PRD: 1 active condition = 0 pts, 3 = 2 pts; interpolate 2 → 1).
 * E = ER visits in past 6 months (1 point each). Optional +1 social (lives alone).
 * Bands: 0–4 LOW, 5–9 MEDIUM, 10+ HIGH.
 */
function comorbidityPoints(count: number): number {
    if (count <= 1) return 0;
    if (count === 2) return 1;
    return 2;
}

export const calculateLacePlus = new FunctionTool({
    name: 'calculateLacePlus',
    description:
        'Calculates the LACE+ readmission risk score: L (length of stay days), A (3 if ER/acute admission), ' +
        'C (comorbidities: 0 if ≤1 condition, 1 if 2, 2 if 3+), E (ER visits in past 6 months, 1 each), ' +
        'optional +1 if patient lives alone. Risk band: LOW 0-4, MEDIUM 5-9, HIGH 10+.',
    parameters: z.object({
        lengthOfStayDays: z.number().describe('Hospital LOS for the index admission, in whole days'),
        isErAdmission: z.boolean().describe('True if admission was via emergency / acute presentation (PRD acuity +3)'),
        comorbiditiesCount: z.number().describe('Count of active comorbidities / conditions used for LACE+ C component'),
        erVisits6Months: z.number().describe('Emergency visits in the prior 6 months (each adds 1 to E)'),
        livesAlone: z.boolean().optional().default(false),
    }),
    execute: async (
        input: {
            lengthOfStayDays: number;
            isErAdmission: boolean;
            comorbiditiesCount: number;
            erVisits6Months: number;
            livesAlone?: boolean;
        },
        _toolContext?: ToolContext,
    ) => {
        const L = Math.max(0, Math.floor(input.lengthOfStayDays));
        const A = input.isErAdmission ? 3 : 0;
        const C = comorbidityPoints(Math.max(0, Math.floor(input.comorbiditiesCount)));
        const E = Math.max(0, Math.floor(input.erVisits6Months));
        const social = input.livesAlone ? 1 : 0;

        const score = L + A + C + E + social;

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (score >= 10) riskLevel = 'HIGH';
        else if (score >= 5) riskLevel = 'MEDIUM';

        return {
            status: 'success',
            score,
            riskLevel,
            breakdown: { L, A, C, E, social },
        };
    },
});
