import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';
import { getFhirCredentials, fhirPost } from '../../shared/tools/fhir.js';

export const findNextAvailableSlot = new FunctionTool({
    name: 'findNextAvailableSlot',
    description:
        'Returns a demo next-available slot string. In production this would query Scheduling/Slot resources. ' +
        'Pass specialty hint: cardio, cardiology, gp, general.',
    parameters: z.object({
        specialty: z.string().optional(),
    }),
    execute: async (input: { specialty?: string }, _toolContext?: ToolContext) => {
        const specialty = input.specialty?.toLowerCase() || '';
        if (specialty.includes('cardio')) {
            return { status: 'success', slot: 'Day 5 at 10:00 AM with Dr. Kamau' };
        }
        if (specialty.includes('gp') || specialty.includes('general')) {
            return { status: 'success', slot: 'Day 10 at 2:00 PM with Dr. Njeri' };
        }
        return { status: 'success', slot: 'Day 3 at 9:00 AM with next available clinician' };
    },
});

export const bookAppointment = new FunctionTool({
    name: 'bookAppointment',
    description:
        'Creates a FHIR R4 Appointment (booked) when the care manager confirmed booking. ' +
        'Provide ISO 8601 start/end. If the FHIR server rejects the write, the error is returned.',
    parameters: z.object({
        startIso: z.string().describe('Appointment start, e.g. 2026-04-10T10:00:00Z'),
        endIso: z.string().describe('Appointment end, e.g. 2026-04-10T10:30:00Z'),
        description: z.string().optional().describe('Reason / note on the appointment'),
        participantDisplay: z
            .string()
            .optional()
            .describe('Clinician display when no Practitioner id is known, e.g. Dr. Kamau'),
    }),
    execute: async (
        input: {
            startIso: string;
            endIso: string;
            description?: string;
            participantDisplay?: string;
        },
        toolContext?: ToolContext,
    ) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const creds = getFhirCredentials(toolContext);
        if (!creds) {
            return { status: 'error', error_message: 'FHIR context missing' };
        }

        const appt: Record<string, unknown> = {
            resourceType: 'Appointment',
            status: 'booked',
            start: input.startIso,
            end: input.endIso,
            description: input.description ?? 'Follow-up (CareTransition booking)',
            participant: [
                {
                    actor: { reference: `Patient/${creds.patientId}` },
                    status: 'accepted',
                },
            ],
        };

        if (input.participantDisplay) {
            (appt['participant'] as unknown[]).push({
                actor: { display: input.participantDisplay },
                status: 'accepted',
            });
        }

        try {
            const created = await fhirPost(creds, 'Appointment', appt);
            console.info(`bookAppointment fhir_created id=${created['id'] ?? 'unknown'}`);
            return {
                status: 'success',
                message: `Appointment booked in FHIR — ${input.startIso}.`,
                fhir: { id: created['id'] ?? null, resourceType: created['resourceType'] ?? 'Appointment' },
            };
        } catch (err) {
            console.error(`bookAppointment: ${String(err)}`);
            return {
                status: 'error',
                error_message: String(err),
                note: 'Server may not allow client Appointment creates without permissions.',
            };
        }
    },
});
