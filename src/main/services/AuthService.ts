import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { UserStore } from './UserStore';
import { JwtPayload } from '../types/auth';

// ─── Custom error classes ────────────────────────────────────────────────────

/** Thrown by signup() to communicate why a signup request was rejected. */
export class SignupError extends Error {
  constructor(
    public readonly code: 'VALIDATION' | 'DUPLICATE',
    message: string,
  ) {
    super(message);
    this.name = 'SignupError';
  }
}

/** Thrown by login() when credentials are wrong or the user does not exist. */
export class LoginError extends Error {
  constructor(
    public readonly code: 'INVALID_CREDENTIALS',
    message: string,
  ) {
    super(message);
    this.name = 'LoginError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;

/**
 * A pre-hashed dummy password used for timing-safe login when the email is not
 * found. Calling bcrypt.compare() against this hash (which will always return
 * false) prevents timing attacks that could reveal whether an email is registered.
 *
 * NOTE: No rate-limiting is in place for this endpoint. This is out of scope
 * per the story definition — document as a known gap if brute-force protection
 * is required in future.
 */
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Minimum required password length (AC4). */
const MIN_PASSWORD_LENGTH = 8;

/** Very basic email regex — rejects obvious non-emails without a full RFC 5322 parser. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── AuthService ─────────────────────────────────────────────────────────────

/**
 * Core authentication service.
 *
 * Handles signup, login, and JWT verification.
 * Depends on a UserStore for user persistence.
 */
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private readonly store: UserStore) {
    if (process.env.JWT_SECRET) {
      this.jwtSecret = process.env.JWT_SECRET;
    } else {
      this.jwtSecret = crypto.randomBytes(32).toString('hex');
      console.warn(
        '[Auth] JWT_SECRET not set — using ephemeral secret. Tokens will be invalidated on restart.',
      );
    }
  }

  // ─── signup() ──────────────────────────────────────────────────────────────

  /**
   * Registers a new user account.
   *
   * @throws {SignupError} code='VALIDATION' — if email or password is invalid
   * @throws {SignupError} code='DUPLICATE' — if the email is already registered
   */
  async signup(email: string, password: string): Promise<void> {
    this.validateSignupInput(email, password);

    // Check for duplicate email (case-insensitive, per UserStore.findByEmail)
    const existing = this.store.findByEmail(email);
    if (existing) {
      throw new SignupError('DUPLICATE', 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    this.store.save({
      id: uuid(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString(),
    });
  }

  // ─── login() ───────────────────────────────────────────────────────────────

  /**
   * Authenticates a user and returns a signed JWT.
   *
   * Uses bcrypt.compare() even when the user does not exist (against a dummy
   * hash) to ensure constant response time and prevent email enumeration.
   *
   * @throws {LoginError} code='INVALID_CREDENTIALS' — if credentials are wrong
   */
  async login(email: string, password: string): Promise<string> {
    const user = await this.verifyCredentials(email, password);

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: '24h' },
    );

    return token;
  }

  // ─── loginMobile() ─────────────────────────────────────────────────────────

  /**
   * Authenticates a user for mobile access and returns a long-lived JWT (30 days).
   *
   * Returns a richer response object than login() to give mobile clients the
   * expiry timestamp and user ID they need to manage their Keychain token.
   *
   * Uses the same bcrypt verification path as login() for timing safety.
   *
   * @throws {LoginError} code='INVALID_CREDENTIALS' — if credentials are wrong
   */
  async loginMobile(email: string, password: string): Promise<{
    token: string;
    expiresAt: string;
    userId: string;
  }> {
    const user = await this.verifyCredentials(email, password);

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: '30d' },
    );

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return { token, expiresAt, userId: user.id };
  }

  // ─── verifyToken() ─────────────────────────────────────────────────────────

  /**
   * Verifies a JWT and returns its decoded payload.
   *
   * @throws if the token is invalid, expired, or signed with a different secret.
   */
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.jwtSecret) as JwtPayload;
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  /**
   * Verifies email + password credentials and returns the matching UserRecord.
   *
   * Always runs bcrypt.compare — even when the user is not found — to ensure
   * constant response time and prevent email enumeration.
   *
   * @throws {LoginError} code='INVALID_CREDENTIALS' — if credentials are wrong
   */
  private async verifyCredentials(email: string, password: string) {
    const user = this.store.findByEmail(email);

    // Always run bcrypt.compare — even on a missing user — for timing safety.
    const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCheck);

    if (!user || !isValid) {
      throw new LoginError('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    return user;
  }

  private validateSignupInput(email: string, password: string): void {
    if (!email || !EMAIL_RE.test(email)) {
      throw new SignupError('VALIDATION', 'A valid email address is required');
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new SignupError(
        'VALIDATION',
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
  }
}
