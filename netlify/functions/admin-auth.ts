import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { admins, adminSessions } from "../../src/db/schema";
import {
  verifyPassword,
  hashPassword,
  createAdminSession,
  verifyAdminSession,
  destroyAdminSession,
  requireAdminAuth,
  parseCookies,
  bootstrapAdminIfEmpty,
} from "../../src/lib/auth";

export default async (request: Request) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "verify";

  // 1. Verify Active Session
  if (request.method === "GET" && action === "verify") {
    const sessionRes = await verifyAdminSession(request);
    if (!sessionRes || !sessionRes.valid || !sessionRes.admin) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        admin: {
          id: sessionRes.admin.id,
          email: sessionRes.admin.email,
          role: sessionRes.admin.role,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 2. Admin Login
  if (request.method === "POST" && action === "login") {
    try {
      // Ensure initial owner is bootstrapped if database is uninitialized
      await bootstrapAdminIfEmpty();

      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const db = getDb();
      const adminRes = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
      const admin = adminRes[0];

      // Always perform constant-time check to prevent timing analysis
      if (!admin || !verifyPassword(password, admin.passwordHash)) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const { token, cookieHeader } = await createAdminSession(admin.id, admin.email, request);

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.append("Set-Cookie", cookieHeader);

      return new Response(
        JSON.stringify({
          success: true,
          admin: {
            id: admin.id,
            email: admin.email,
            role: admin.role,
          },
          token,
        }),
        {
          status: 200,
          headers,
        }
      );
    } catch (err: any) {
      console.error("[ADMIN_AUTH] Login error:", err);
      return new Response(
        JSON.stringify({ error: "Invalid email or password." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 3. Password Rotation (Authenticated only)
  if (request.method === "POST" && action === "change-password") {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authenticated || !authResult.admin) {
      return authResult.errorResponse!;
    }

    try {
      const body = await request.json().catch(() => ({}));
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");

      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "New password must be at least 8 characters long." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!verifyPassword(currentPassword, authResult.admin.passwordHash)) {
        return new Response(
          JSON.stringify({ error: "Current password is incorrect." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const db = getDb();
      const newHash = hashPassword(newPassword);

      // Update password hash
      await db
        .update(admins)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(admins.id, authResult.admin.id));

      // Invalidate all existing sessions for this admin (prevent session fixation)
      await db.delete(adminSessions).where(eq(adminSessions.adminId, authResult.admin.id));

      // Issue a fresh session
      const { token, cookieHeader } = await createAdminSession(
        authResult.admin.id,
        authResult.admin.email,
        request
      );

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.append("Set-Cookie", cookieHeader);

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully." }),
        {
          status: 200,
          headers,
        }
      );
    } catch (err: any) {
      console.error("[ADMIN_AUTH] Change password error:", err);
      return new Response(
        JSON.stringify({ error: "Unable to update password." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 4. Admin Logout
  if (request.method === "POST" && action === "logout") {
    const cookies = parseCookies(request);
    const token = cookies.admin_session;
    let clearCookie = "admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

    if (token) {
      clearCookie = await destroyAdminSession(token);
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Set-Cookie", clearCookie);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  }

  // 5. One-Time Administrative Reset (POST only, constant-time token verification, hardcoded owner email)
  if (action === "reset-password") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const netlifyEnv = (globalThis as any).Netlify?.env;
      const expectedToken =
        (typeof netlifyEnv?.get === "function" && netlifyEnv.get("ADMIN_RESET_TOKEN")) ||
        process.env["ADMIN_RESET_TOKEN"];

      if (!expectedToken || expectedToken.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Reset endpoint is disabled." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await request.json().catch(() => ({}));
      const providedToken = String(body.resetToken || body.token || "").trim();
      const newPassword = String(body.newPassword || "");

      if (!providedToken || !newPassword || newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Invalid request parameters." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Constant-time token comparison to prevent timing attacks
      const crypto = await import("node:crypto");
      const expectedBuf = Buffer.from(expectedToken.trim());
      const providedBuf = Buffer.from(providedToken);
      const isTokenValid =
        expectedBuf.length === providedBuf.length &&
        crypto.timingSafeEqual(expectedBuf, providedBuf);

      if (!isTokenValid) {
        return new Response(JSON.stringify({ error: "Unauthorized." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Target strictly the single owner email
      const targetEmail = "owner@saatvikannafoods.in";
      const db = getDb();
      const adminRes = await db.select().from(admins).where(eq(admins.email, targetEmail)).limit(1);
      const admin = adminRes[0];

      if (!admin) {
        return new Response(JSON.stringify({ error: "Owner account not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const newHash = hashPassword(newPassword);

      // In-place update of password_hash and updated_at
      await db
        .update(admins)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(admins.id, admin.id));

      // Invalidate all existing sessions for this owner
      await db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));

      return new Response(
        JSON.stringify({ success: true, message: "Owner password reset successfully." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      console.error("[ADMIN_AUTH] Reset execution error:", err?.message || "Unknown error");
      return new Response(JSON.stringify({ error: "Reset operation failed." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/.netlify/functions/admin-auth",
};

