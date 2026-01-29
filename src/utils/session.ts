import {
  SESSION_START_ENDPOINT,
  SESSION_UPDATE_ENDPOINT,
} from '../lib/constants.js';

export function sendSessionInit(
  sessionId: string,
  setupDetails: string,
  accessToken: string,
  orgId: string,
): void {
  // Fire and forget - don't await
  void fetch(SESSION_START_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-wizard-session': sessionId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      setupDetails,
    }),
  }).catch(() => {
    // Silently fail - this is a non-critical notification
  });
}

export function sendSessionUpdate(
  sessionId: string,
  plan: string,
  accessToken: string,
  orgId: string,
): void {
  // Fire and forget - don't await
  void fetch(SESSION_UPDATE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-wizard-session': sessionId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      plan,
    }),
  }).catch(() => {
    // Silently fail - this is a non-critical update
  });
}
