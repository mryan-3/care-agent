/**
 * Shared tools barrel — re-exports all shared tools so agents can import
 * from a single location.
 *
 * Usage in an agent:
 *   import { getPatientDemographics, getActiveMedications } from '../shared/tools/index.js';
 */

export {
    getPatientDemographics,
    getActiveMedications,
    getActiveConditions,
    getRecentObservations,
    getCarePlans,
    getCareTeam,
    getGoals,
    getMedicationRequests,
    getMedicationStatements,
    getAllergyIntolerances,
    getEncounters,
    getAppointments,
    getObservationsByCode,
    getMedicationDispenses,
    getPractitioner,
} from './fhir.js';

export { getFhirCredentials, fhirGet, fhirPost, type FhirCredentials } from './fhir.js';
