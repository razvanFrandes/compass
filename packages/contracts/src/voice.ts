/**
 * `POST /api/voice/token`: a short-lived Soniox key for one dictation. The browser streams the microphone straight
 * to Soniox with it; the permanent key never leaves the server.
 */
export interface VoiceToken {
  /** A temporary Soniox API key: single use, valid for about two minutes. */
  apiKey: string;
  /** When `apiKey` stops being accepted for a new connection, ISO 8601 UTC. */
  expiresAt: string;
  /** The real-time model to name in the first WebSocket message. */
  model: string;
  /** Soniox's real-time WebSocket endpoint. */
  wsUrl: string;
}
