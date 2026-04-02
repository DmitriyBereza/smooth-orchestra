/**
 * Auth-related type definitions.
 * Used by UserStore, AuthService, and SocketServer middleware.
 */

export interface UserRecord {
  /** Unique user identifier (UUID v4) */
  id: string;
  /** User email address (stored in lower-case) */
  email: string;
  /** bcrypt-hashed password — plaintext is NEVER stored */
  passwordHash: string;
  /** ISO-8601 timestamp of account creation */
  createdAt: string;
}

export interface JwtPayload {
  /** Subject — the user's UUID */
  sub: string;
  /** User's email address */
  email: string;
  /** Issued-at timestamp (Unix seconds) */
  iat: number;
  /** Expiry timestamp (Unix seconds) */
  exp: number;
}
