import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService, LoginError } from '../services/AuthService';
import { DeviceStore } from '../services/DeviceStore';

// ─── Auth middleware ──────────────────────────────────────────────────────────

/**
 * Factory that returns Express middleware which verifies a Bearer JWT.
 *
 * On success, attaches the decoded JWT payload to res.locals.user.
 * On failure (missing header, invalid/expired token), returns 401.
 */
export function mobileAuthMiddleware(authService: AuthService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = authService.verifyToken(token);
      res.locals.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

// ─── Mobile router ────────────────────────────────────────────────────────────

/**
 * Builds the Express Router for all mobile API endpoints.
 *
 * Mounted at /api/mobile by SocketServer:
 *   POST   /api/mobile/auth/login         — no auth required
 *   POST   /api/mobile/devices/register   — auth required
 *   DELETE /api/mobile/devices/:deviceId  — auth required
 *
 * Feature flag: MOBILE_PUSH_ENABLED (env var, default false) gates push
 * notification dispatch in Phase 4. Device registration works regardless
 * of the flag — tokens are stored, just not used for push yet.
 */
export function buildMobileRouter(
  authService: AuthService,
  deviceStore: DeviceStore,
): Router {
  const router = Router();
  const requireAuth = mobileAuthMiddleware(authService);

  // ── POST /auth/login ───────────────────────────────────────────────────────
  //
  // Accepts { username, password } and returns a long-lived JWT (30 days).
  // Note: "username" maps to "email" in AuthService (the story uses "username"
  // as the field name shown in the mobile UI).
  //
  router.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    try {
      const result = await authService.loginMobile(username ?? '', password ?? '');
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof LoginError) {
        res.status(401).json({ error: 'Invalid credentials' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // ── POST /devices/register ─────────────────────────────────────────────────
  //
  // Registers or updates a mobile device's Expo push token.
  // Requires: Bearer JWT in Authorization header.
  // Body: { expoPushToken, deviceId, platform, appVersion }
  //
  router.post('/devices/register', requireAuth, (req: Request, res: Response): void => {
    const { expoPushToken, deviceId, platform, appVersion } = req.body as {
      expoPushToken?: string;
      deviceId?: string;
      platform?: string;
      appVersion?: string;
    };

    // Validate required fields
    if (!expoPushToken || !deviceId || !platform || !appVersion) {
      res.status(400).json({ error: 'expoPushToken, deviceId, platform, and appVersion are required' });
      return;
    }

    const userId = (res.locals.user as { sub: string }).sub;
    const now = new Date().toISOString();

    // Check if device already exists to preserve registeredAt
    const existing = deviceStore.findByDeviceId(deviceId);

    deviceStore.upsert({
      deviceId,
      userId,
      expoPushToken,
      platform: 'ios', // Only iOS is supported in Phase 1
      appVersion,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    });

    res.status(200).json({ deviceId, registered: true });
  });

  // ── DELETE /devices/:deviceId ──────────────────────────────────────────────
  //
  // Unregisters a device. Only the owning user can delete their own device.
  // Returns 404 for non-existent devices AND for devices owned by other users
  // (no ownership leak).
  //
  router.delete('/devices/:deviceId', requireAuth, (req: Request, res: Response): void => {
    const { deviceId } = req.params;
    const userId = (res.locals.user as { sub: string }).sub;

    const device = deviceStore.findByDeviceId(deviceId);

    // Return 404 both for "not found" and "not owned by this user"
    // to prevent ownership enumeration.
    if (!device || device.userId !== userId) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    deviceStore.remove(deviceId);
    res.status(204).send();
  });

  return router;
}
