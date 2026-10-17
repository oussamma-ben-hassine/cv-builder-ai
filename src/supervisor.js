import { randomUUID } from 'crypto';

const SUPERVISOR_URL = (process.env.SUPERVISOR_URL || 'https://supervisor.oussamma.tn').replace(/\/$/, '');
const SUPERVISOR_API_KEY = process.env.SUPERVISOR_API_KEY || 'es_cvbuilder_sec_7720b99de22a8830e882c202aa99d';
const APP_ID = 'cv-builder';

export function trackCvEvent({
  eventType,
  actorSub,
  actorEmail,
  resourceId,
  resourceName,
  outcome = 'success',
  metadata = {},
}) {
  if (!SUPERVISOR_API_KEY) return;

  const payload = {
    event_id: randomUUID(),
    event_type: eventType,
    event_version: 1,
    application: APP_ID,
    actor: {
      issuer: process.env.SSO_ISSUER || 'https://sso-a.oussamma.tn',
      sub: actorSub || 'user-oussamma-001',
      email: actorEmail,
    },
    occurred_at: new Date().toISOString(),
    resource: resourceId
      ? {
          type: 'cv',
          id: String(resourceId),
          name: resourceName,
        }
      : undefined,
    outcome,
    metadata,
  };

  fetch(`${SUPERVISOR_URL}/api/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supervisor-Key': SUPERVISOR_API_KEY,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    // Non-blocking non-critical error
  });
}
