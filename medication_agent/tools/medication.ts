import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';
import { getFhirCredentials, fhirGet } from '../../shared/tools/fhir.js';

type DrugClass = 'ACE_INHIBITOR' | 'ARB' | 'BETA_BLOCKER' | 'CCB' | 'DIURETIC';

function detectClass(med: string): DrugClass | null {
    const s = med.toLowerCase();
    if (s.includes('sartan')) return 'ARB';
    if (s.includes('pril')) return 'ACE_INHIBITOR';
    if (s.includes('olol') || s.includes('alol')) return 'BETA_BLOCKER';
    if (s.includes('dipine') || s.includes('diltiazem') || s.includes('verapamil')) return 'CCB';
    if (
        s.includes('furosemide') ||
        s.includes('torsemide') ||
        s.includes('bumetanide') ||
        s.includes('spironolactone') ||
        s.includes('eplerenone') ||
        s.includes('hydrochlorothiazide') ||
        s.includes('chlorthalidone') ||
        s.includes('metolazone') ||
        s.includes('indapamide')
    ) {
        return 'DIURETIC';
    }
    return null;
}

function normName(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export const compareDrugClasses = new FunctionTool({
    name: 'compareDrugClasses',
    description:
        'Compares discharge vs pre-admission medication names for therapeutic-class duplications ' +
        '(ACE inhibitors, ARBs, beta blockers, CCBs, diuretics).',
    parameters: z.object({
        dischargeMedications: z.array(z.string()),
        preAdmissionMedications: z.array(z.string()),
    }),
    execute: async (
        input: { dischargeMedications: string[]; preAdmissionMedications: string[] },
        _toolContext?: ToolContext,
    ) => {
        const findings: string[] = [];
        const severity = 'CRITICAL';

        for (const dMed of input.dischargeMedications) {
            const dClass = detectClass(dMed);
            if (!dClass) continue;
            for (const pMed of input.preAdmissionMedications) {
                const pClass = detectClass(pMed);
                if (!pClass || dClass !== pClass) continue;
                if (normName(dMed) === normName(pMed)) continue;
                const label =
                    dClass === 'ACE_INHIBITOR'
                        ? 'ACE inhibitor'
                        : dClass === 'ARB'
                          ? 'ARB'
                          : dClass === 'BETA_BLOCKER'
                            ? 'beta blocker'
                            : dClass === 'CCB'
                              ? 'calcium channel blocker'
                              : 'diuretic';
                findings.push(
                    `${severity}: ${dMed} (discharge) + ${pMed} (pre-admission) — same class (${label}). Dangerous duplicate; pharmacist review.`,
                );
            }
        }
        return { status: 'success', duplications: findings };
    },
});

function medNameFromRequestRow(r: Record<string, unknown>): string {
    const medConcept = (r['medicationCodeableConcept'] as Record<string, unknown> | undefined) ?? {};
    const codings = (medConcept['coding'] as unknown[] | undefined) ?? [];
    const text = (medConcept['text'] as string | undefined) ?? '';
    if (text) return text;
    for (const c of codings) {
        const disp = (c as Record<string, string>)['display'];
        if (disp) return disp;
    }
    const ref = (r['medicationReference'] as Record<string, string> | undefined) ?? {};
    return ref['display'] ?? 'unknown';
}

function medNameFromDispenseRow(r: Record<string, unknown>): string {
    const medConcept = (r['medicationCodeableConcept'] as Record<string, unknown> | undefined) ?? {};
    const text = (medConcept['text'] as string | undefined) ?? '';
    if (text) return text;
    const codings = (medConcept['coding'] as unknown[] | undefined) ?? [];
    for (const c of codings) {
        const disp = (c as Record<string, string>)['display'];
        if (disp) return disp;
    }
    return 'unknown';
}

function namesRoughlyMatch(a: string, b: string): boolean {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    if (x === y) return true;
    const ax = x.split(/[\s,/]+/)[0] ?? '';
    const bx = y.split(/[\s,/]+/)[0] ?? '';
    if (ax.length > 3 && bx.length > 3 && (x.includes(bx) || y.includes(ax))) return true;
    return false;
}

export const checkPharmacyFills = new FunctionTool({
    name: 'checkPharmacyFills',
    description:
        'Uses FHIR MedicationRequest + MedicationDispense to flag active prescriptions with no pharmacy fill ' +
        'on or after the prescription authored date. Optional dischargeAfterIso limits to meds authored after discharge.',
    parameters: z.object({
        dischargeAfterIso: z
            .string()
            .optional()
            .describe('ISO date/time; only requests with authoredOn >= this are checked'),
    }),
    execute: async (input: { dischargeAfterIso?: string }, toolContext?: ToolContext) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const creds = getFhirCredentials(toolContext);
        if (!creds) {
            return { status: 'error', error_message: 'FHIR context missing' };
        }

        const cutoff = input.dischargeAfterIso ? Date.parse(input.dischargeAfterIso) : null;

        try {
            const reqBundle = (await fhirGet(creds, 'MedicationRequest', {
                patient: creds.patientId,
                status: 'active',
                _count: '50',
            })) as Record<string, unknown>;

            const dispBundle = (await fhirGet(creds, 'MedicationDispense', {
                patient: creds.patientId,
                _sort: '-date',
                _count: '100',
            })) as Record<string, unknown>;

            const requests = ((reqBundle['entry'] as unknown[] | undefined) ?? []).map(
                (e: unknown) =>
                    ((e as Record<string, unknown>)['resource'] ?? {}) as Record<string, unknown>,
            );

            const dispenses = ((dispBundle['entry'] as unknown[] | undefined) ?? []).map(
                (e: unknown) =>
                    ((e as Record<string, unknown>)['resource'] ?? {}) as Record<string, unknown>,
            );

            const findings: string[] = [];

            for (const req of requests) {
                const name = medNameFromRequestRow(req);
                const authored = (req['authoredOn'] as string | undefined) ?? null;
                const authoredMs = authored ? Date.parse(authored) : NaN;

                if (cutoff !== null && Number.isFinite(authoredMs) && authoredMs < cutoff) {
                    continue;
                }
                if (cutoff !== null && !Number.isFinite(authoredMs)) {
                    continue;
                }

                let filledAfter = false;
                for (const d of dispenses) {
                    const dName = medNameFromDispenseRow(d);
                    if (!namesRoughlyMatch(name, dName)) {
                        continue;
                    }
                    const when =
                        (d['whenHandedOver'] as string | undefined)
                        ?? (d['whenPrepared'] as string | undefined)
                        ?? null;
                    if (!when) {
                        continue;
                    }
                    const whenMs = Date.parse(when);
                    if (!Number.isFinite(whenMs)) {
                        continue;
                    }
                    if (!Number.isFinite(authoredMs)) {
                        filledAfter = true;
                        break;
                    }
                    if (whenMs >= authoredMs) {
                        filledAfter = true;
                        break;
                    }
                }

                if (!filledAfter) {
                    findings.push(
                        `WARNING: ${name} — no MedicationDispense fill on or after authored date ${authored ?? 'unknown'}.`,
                    );
                }
            }

            return { status: 'success', unfilled_prescriptions: findings };
        } catch (err) {
            console.error(`checkPharmacyFills: ${String(err)}`);
            return { status: 'error', error_message: String(err) };
        }
    },
});

export const checkDrugInteractions = new FunctionTool({
    name: 'checkDrugInteractions',
    description: 'Checks a list of medications for a small set of moderate-severity demo interactions (MVP).',
    parameters: z.object({
        medications: z.array(z.string()),
    }),
    execute: async (input: { medications: string[] }, _toolContext?: ToolContext) => {
        const medsStr = input.medications.join(' ').toLowerCase();
        const findings: string[] = [];

        if (medsStr.includes('cetirizine') && medsStr.includes('salbutamol')) {
            findings.push(
                'NOTE: Cetirizine + Salbutamol — additive vigilance/sedation possible; flag for clinician.',
            );
        }
        if (medsStr.includes('metformin') && medsStr.includes('furosemide')) {
            findings.push(
                'WARNING: Metformin + loop diuretic — monitor renal function / dehydration risk in vulnerable patients.',
            );
        }
        if (medsStr.includes('lisinopril') && medsStr.includes('spironolactone')) {
            findings.push(
                'WARNING: ACE inhibitor + spironolactone — hyperkalemia risk; labs/clinical review.',
            );
        }

        return { status: 'success', interactions: findings };
    },
});
