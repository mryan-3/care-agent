import '../shared/env.js';
import { LlmAgent } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';
import { getAppointments, getPractitioner } from '../shared/tools/index.js';
import { findNextAvailableSlot, bookAppointment } from './tools/scheduling.js';

export const rootAgent = new LlmAgent({
    name: 'scheduling_agent',
    model: 'gemini-2.5-flash',
    description: 'Appointment coordination specialist — finds and books follow-up appointments.',
    instruction: `You are an appointment coordination specialist. You receive a patient's discharge instructions and their current FHIR appointment records.
You check whether a required follow-up appointment exists within the discharge instruction timeframe.
If no appointment exists, you identify the next available slot with the relevant clinician.
You return appointment status, required timeline, and next available slot.
When explicitly instructed by the care manager, you book the appointment.`,
    tools: [
        getAppointments,
        getPractitioner,
        findNextAvailableSlot,
        bookAppointment,
    ],
    beforeModelCallback: extractFhirContext,
});
