/**
 * @lokus/content — SERVER-ONLY simulation content for NorthrSim · Clinical Trial Associate (AHS-DM-026, rubric v1.1).
 * The web app receives this content only through authenticated API endpoints that record server-observed opens.
 */
export * from './types';
export * from './study';
export * from './visits';
export { PARTICIPANTS } from './participants';
export * from './documents';
export * from './mail/workday1';
export * from './mail/workday2';

import { PARTICIPANTS } from './participants';
import type { ParticipantCrf } from './types';

export function getParticipant(id: string): ParticipantCrf | undefined {
  return PARTICIPANTS.find((p) => p.participantId === id);
}
