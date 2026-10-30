import { createHash } from 'node:crypto';

export const CHECKPOINT_VERSION = 1;

export function checkpointFingerprint(request, promptVersion = 'translation-request-v1') {
  return createHash('sha256').update(JSON.stringify({ version: CHECKPOINT_VERSION, promptVersion, request })).digest('hex');
}

export function reusableCheckpoint(payload, phase, fingerprint) {
  const checkpoint = payload?.checkpoints?.[phase];
  return checkpoint?.fingerprint === fingerprint && checkpoint.status === 'complete' && typeof checkpoint.result === 'string'
    ? checkpoint.result
    : null;
}

export function beginCheckpoint(payload, phase, fingerprint, usageId, now = Date.now()) {
  payload.checkpoints ||= {};
  let checkpoint = payload.checkpoints[phase];
  if (!checkpoint || checkpoint.fingerprint !== fingerprint) {
    checkpoint = payload.checkpoints[phase] = { fingerprint, phase, status: 'pending', attempts: [] };
  }
  checkpoint.phase = phase;
  checkpoint.status = 'in_flight';
  delete checkpoint.result;
  checkpoint.startedAt = now;
  checkpoint.finishedAt = null;
  checkpoint.attempts ||= [];
  checkpoint.attempts.push({ usageId, startedAt: now, status: 'in_flight' });
  checkpoint.attempts = checkpoint.attempts.slice(-20);
  return checkpoint;
}

export function invalidateCheckpoint(payload, phase, fingerprint) {
  const checkpoint = payload?.checkpoints?.[phase];
  if (!checkpoint || checkpoint.fingerprint !== fingerprint) return checkpoint || null;
  checkpoint.status = 'invalid';
  checkpoint.finishedAt = Date.now();
  delete checkpoint.result;
  return checkpoint;
}

export function completeCheckpoint(payload, phase, fingerprint, result, now = Date.now()) {
  const checkpoint = payload?.checkpoints?.[phase];
  if (!checkpoint || checkpoint.fingerprint !== fingerprint) throw new Error('Der gesicherte Auftragsschritt passt nicht mehr zu den Eingaben.');
  checkpoint.status = 'complete';
  checkpoint.result = result;
  checkpoint.finishedAt = now;
  const attempt = checkpoint.attempts?.at(-1);
  if (attempt) { attempt.status = 'complete'; attempt.finishedAt = now; }
  return checkpoint;
}

export function interruptCheckpoint(payload, phase, fingerprint, now = Date.now()) {
  const checkpoint = payload?.checkpoints?.[phase];
  if (!checkpoint || checkpoint.fingerprint !== fingerprint || checkpoint.status === 'complete') return checkpoint || null;
  checkpoint.status = 'interrupted';
  checkpoint.finishedAt = now;
  const attempt = checkpoint.attempts?.at(-1);
  if (attempt?.status === 'in_flight') { attempt.status = 'unknown'; attempt.finishedAt = now; }
  return checkpoint;
}

export function checkpointState(payload) {
  const items = Object.values(payload?.checkpoints || {});
  const latest = items.sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0))[0];
  return latest ? { phase: latest.phase, status: latest.status, finishedAt: latest.finishedAt || null } : null;
}
