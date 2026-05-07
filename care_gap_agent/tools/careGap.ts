import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';

const MS_PER_DAY = 86_400_000;

function daysSince(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    return Math.floor((Date.now() - t) / MS_PER_DAY);
}

export const checkClinicalGuidelines = new FunctionTool({
    name: 'checkClinicalGuidelines',
    description:
        'Compares diagnoses and care-plan presence against MVP guideline rules (ADA HbA1c ~90d, ACC/AHA HF plan, WHO asthma plan / peak flow). ' +
        'Pass hba1cLastEffectiveDateIso from getObservationsByCode(4548-4) when available.',
    parameters: z.object({
        diagnoses: z.array(z.string()),
        observationsText: z
            .string()
            .optional()
            .default('')
            .describe('Legacy text join of observations; optional if structured dates provided'),
        hasCarePlan: z.boolean().describe('Whether an active CarePlan exists for the patient'),
        hba1cLastEffectiveDateIso: z
            .string()
            .nullable()
            .optional()
            .describe('Most recent HbA1c Observation effectiveDateTime (ISO) if known'),
        hasPeakFlowObservation: z
            .boolean()
            .optional()
            .describe('True if a recent peak flow / PEFR observation exists'),
    }),
    execute: async (
        input: {
            diagnoses: string[];
            observationsText?: string;
            hasCarePlan: boolean;
            hba1cLastEffectiveDateIso?: string | null;
            hasPeakFlowObservation?: boolean;
        },
        _toolContext?: ToolContext,
    ) => {
        const diagnosesStr = input.diagnoses.join(' ').toLowerCase();
        const obsStr = (input.observationsText ?? '').toLowerCase();
        const findings: string[] = [];

        if (diagnosesStr.includes('heart failure')) {
            if (!input.hasCarePlan) {
                findings.push(
                    'IMPORTANT: No heart failure care plan on file (ACC/AHA CHF guidelines expect a documented plan).',
                );
            }
        }

        if (diagnosesStr.includes('diabetes')) {
            const d = input.hba1cLastEffectiveDateIso;
            const days = daysSince(d ?? null);
            const stale =
                days === null && !obsStr.includes('hba1c') && !obsStr.includes('a1c') && !obsStr.includes('hemoglobin');
            const overdue = days !== null && days > 100;

            if (d === null && stale) {
                findings.push(
                    'URGENT: No recent HbA1c on file — ADA standard is roughly every 3 months for many patients on therapy.',
                );
            } else if (overdue) {
                findings.push(
                    `URGENT: HbA1c last recorded ~${days} days ago — likely overdue vs ADA ~3 month cadence.`,
                );
            }
        }

        if (diagnosesStr.includes('asthma')) {
            if (!input.hasCarePlan) {
                findings.push(
                    'IMPORTANT: No asthma action / care plan on file (WHO-style guidance expects a written plan).',
                );
            }
            if (input.hasPeakFlowObservation !== true && !obsStr.includes('peak flow') && !obsStr.includes('pefr')) {
                findings.push('STANDARD CARE: No peak flow / PEFR baseline documented.');
            }
        }

        return { status: 'success', gaps: findings };
    },
});
