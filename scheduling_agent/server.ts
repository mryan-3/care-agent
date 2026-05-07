import 'dotenv/config';
import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = Number(process.env['PORT'] ?? 8002);
const URL = process.env['SCHEDULING_AGENT_URL'] ?? `http://localhost:${PORT}`;
const FHIR_EXTENSION = process.env['FHIR_EXTENSION_URI'] ?? 'https://workspace.promptopinion.ai/schemas/a2a/v1/fhir-context';

const app = createA2aApp({
    agent: rootAgent,
    name: 'scheduling_agent',
    description: 'Appointment coordination specialist — finds and books follow-up appointments.',
    url: URL,
    version: '1.0.0',
    fhirExtensionUri: FHIR_EXTENSION,
    requireApiKey: true,
});

app.listen(PORT, () => {
    console.info(`scheduling_agent running on port ${PORT}`);
});
