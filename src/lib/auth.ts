import crypto from "node:crypto";
import { eq, and, gt, sql } from "drizzle-orm";
import { getDb } from "../db/index";
import { admins, adminSessions } from "../db/schema";

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hashes a plaintext password with a random 32-byte salt using scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) {
      return false;
    }
    const salt = parts[1];
    const originalHash = Buffer.from(parts[2], "hex");
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Bootstraps the first owner admin ONLY if the admins table is empty and ADMIN_INITIAL_PASSWORD is provided.
 * Non-reentrant: Once an admin exists, it will NEVER overwrite or recreate.
 */
export async function bootstrapAdminIfEmpty(): Promise<void> {
  const db = getDb();

  try {
    const adminCountRes = await db.select({ count: sql<number>`count(*)` }).from(admins);
    const count = Number(adminCountRes[0]?.count || 0);

    if (count > 0) {
      return; // Already bootstrapped
    }

    const netlifyEnv = (globalThis as any).Netlify?.env;
    const initialPassword =
      (typeof netlifyEnv?.get === "function" && netlifyEnv.get("ADMIN_INITIAL_PASSWORD")) ||
      process.env["ADMIN_INITIAL_PASSWORD"];
    const adminEmail =
      (typeof netlifyEnv?.get === "function" && netlifyEnv.get("ADMIN_EMAIL")) ||
      process.env["ADMIN_EMAIL"] ||
      "durgafunmail@gmail.com";

    if (!initialPassword || initialPassword.trim().length === 0) {
      return;
    }

    const passwordHash = hashPassword(initialPassword.trim());
    const adminId = `adm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    await db.insert(admins).values({
      id: adminId,
      email: adminEmail.trim().toLowerCase(),
      passwordHash,
      role: "owner",
    });

    console.log(`[AUTH] Owner admin account initialized for ${adminEmail}`);
  } catch (err) {
    console.error("[AUTH] Bootstrap check error:", err);
  }
}

/**
 * Parses cookies from a Request header.
 */
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });
  return cookies;
}

/**
 * Computes a SHA-256 hash of the raw session token for secure database storage.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a persistent admin session in PostgreSQL and returns the raw session token & Set-Cookie header.
 * Only the SHA-256 hash of the token is stored in the database.
 */
export async function createAdminSession(
  adminId: string,
  email: string,
  request: Request
): Promise<{ token: string; cookieHeader: string }> {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("client-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  await db.insert(adminSessions).values({
    id: tokenHash,
    adminId,
    email: email.toLowerCase(),
    ipAddress,
    userAgent,
    expiresAt,
  });

  const cookieHeader = `admin_session=${rawToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}`;

  return { token: rawToken, cookieHeader };
}

/**
 * Verifies an incoming admin session from Cookie or Authorization header against PostgreSQL.
 * Computes SHA-256 of the presented token and queries by hash.
 */
export async function verifyAdminSession(
  request: Request
): Promise<{ valid: boolean; session?: typeof adminSessions.$inferSelect; admin?: typeof admins.$inferSelect } | null> {
  const db = getDb();

  // Ensure bootstrap check has occurred
  await bootstrapAdminIfEmpty();

  const cookies = parseCookies(request);
  let rawToken = cookies["admin_session"];

  if (!rawToken) {
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      rawToken = authHeader.substring(7).trim();
    }
  }

  if (!rawToken) {
    return null;
  }

  try {
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();
    const sessionRes = await db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.id, tokenHash), gt(adminSessions.expiresAt, now)))
      .limit(1);

    const session = sessionRes[0];
    if (!session) {
      return null;
    }

    // Refresh last active timestamp asynchronously
    db.update(adminSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(adminSessions.id, tokenHash))
      .catch(() => {});

    const adminRes = await db.select().from(admins).where(eq(admins.id, session.adminId)).limit(1);
    const admin = adminRes[0];

    return { valid: true, session, ...(admin ? { admin } : {}) };
  } catch (err) {
    console.error("[AUTH] verifyAdminSession error:", err);
    return null;
  }
}

/**
 * Destroys an admin session in PostgreSQL by hashing the presented token.
 */
export async function destroyAdminSession(rawToken: string): Promise<string> {
  try {
    const db = getDb();
    const tokenHash = hashSessionToken(rawToken);
    await db.delete(adminSessions).where(eq(adminSessions.id, tokenHash));
  } catch (err) {
    console.error("[AUTH] destroyAdminSession error:", err);
  }
  return "admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

/**
 * Server-side middleware requiring valid admin session.
 */
export async function requireAdminAuth(
  request: Request
): Promise<{ authenticated: boolean; session?: typeof adminSessions.$inferSelect; admin?: typeof admins.$inferSelect; errorResponse?: Response }> {
  const result = await verifyAdminSession(request);

  if (!result || !result.valid || !result.session) {
    return {
      authenticated: false,
      errorResponse: new Response(
        JSON.stringify({ error: "Unauthorized access." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { authenticated: true, session: result.session, ...(result.admin ? { admin: result.admin } : {}) };
}

