import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';

const AUDIT_KEY = 'care_transition_audit_log';
const BASELINE_KEY = 'care_transition_plan_baseline';

type AuditEntry = {
    ts: string;
    agent: string;
    action: 'CONFIRM' | 'SKIP';
    recommendationId: string;
    details?: string;
};

function parseAuditLog(raw: unknown): AuditEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((e): e is AuditEntry =>
        e !== null &&
        typeof e === 'object' &&
        typeof (e as AuditEntry).ts === 'string' &&
        typeof (e as AuditEntry).action === 'string',
    ) as AuditEntry[];
}

export const auditCareAction = new FunctionTool({
    name: 'auditCareAction',
    description:
        'Records a care manager CONFIRM or SKIP for traceability (timestamps in session state). ' +
        'Call when the user explicitly confirms or skips a recommendation.',
    parameters: z.object({
        action: z.enum(['CONFIRM', 'SKIP']),
        recommendationId: z
            .string()
            .describe('Short label, e.g. book_cardiology_day5, order_hba1c'),
        details: z.string().optional().describe('Optional free-text note'),
    }),
    execute: async (
        input: { action: 'CONFIRM' | 'SKIP'; recommendationId: string; details?: string },
        toolContext?: ToolContext,
    ) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const prev = parseAuditLog(toolContext.state.get(AUDIT_KEY));
        const entry: AuditEntry = {
            ts: new Date().toISOString(),
            agent: 'care_transition_agent',
            action: input.action,
            recommendationId: input.recommendationId,
            details: input.details,
        };
        prev.push(entry);
        toolContext.state.set(AUDIT_KEY, prev);
        console.info(
            `audit_care_action ts=${entry.ts} action=${input.action} id=${input.recommendationId}`,
        );
        return { status: 'success', logged: entry };
    },
});

export const getCareAuditLog = new FunctionTool({
    name: 'getCareAuditLog',
    description: 'Returns CONFIRM/SKIP audit entries recorded in this session for Day 7/30 follow-ups or summaries.',
    parameters: z.object({}),
    execute: async (_input: unknown, toolContext?: ToolContext) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const log = parseAuditLog(toolContext.state.get(AUDIT_KEY));
        return { status: 'success', count: log.length, entries: log };
    },
});

export const saveCarePlanBaseline = new FunctionTool({
    name: 'saveCarePlanBaseline',
    description:
        'Stores a concise text summary of the last full care plan (LACE+, Today / Day 7-14 / Day 30 actions) ' +
        'so a later "Day 7" or "Day 30" message can compare against getCarePlanBaseline.',
    parameters: z.object({
        baselineSummary: z.string().min(1).describe('Structured summary text to retrieve later'),
    }),
    execute: async (input: { baselineSummary: string }, toolContext?: ToolContext) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const payload = {
            savedAt: new Date().toISOString(),
            summary: input.baselineSummary,
        };
        toolContext.state.set(BASELINE_KEY, payload);
        console.info(`care_plan_baseline_saved at=${payload.savedAt}`);
        return { status: 'success', savedAt: payload.savedAt };
    },
});

export const getCarePlanBaseline = new FunctionTool({
    name: 'getCarePlanBaseline',
    description:
        'Retrieves the baseline care plan summary saved by saveCarePlanBaseline. Use on Day 7/30 to diff against current FHIR state.',
    parameters: z.object({}),
    execute: async (_input: unknown, toolContext?: ToolContext) => {
        if (!toolContext) {
            return { status: 'error', error_message: 'No tool context' };
        }
        const raw = toolContext.state.get(BASELINE_KEY);
        if (!raw || typeof raw !== 'object') {
            return { status: 'success', has_baseline: false, baseline: null };
        }
        return { status: 'success', has_baseline: true, baseline: raw };
    },
});
