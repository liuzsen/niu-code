import { randomUUID } from 'crypto';

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Generate a short ID for use in URLs or similar contexts
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a session ID with prefix
 */
export function generateSessionId(): string {
  const uuid = generateUuid();
  const shortId = generateShortId(6);
  return `session_${shortId}_${uuid.split('-')[0]}`;
}

/**
 * Generate a message ID with prefix
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const shortId = generateShortId(8);
  return `msg_${timestamp}_${shortId}`;
}

/**
 * Generate a request ID for tool permission requests
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const shortId = generateShortId(6);
  return `req_${timestamp}_${shortId}`;
}

/**
 * Validate if a string is a valid UUID v4
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Extract timestamp from a session ID
 */
export function extractTimestampFromSessionId(sessionId: string): number | null {
  const match = sessionId.match(/session_[^_]+_(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Extract timestamp from a message ID
 */
export function extractTimestampFromMessageId(messageId: string): number | null {
  const match = messageId.match(/msg_(\d+)_/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}