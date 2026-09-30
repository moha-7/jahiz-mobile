import { prisma } from "../../lib/prisma.js";
import { createSessionToken, hashPassword, hashToken, verifyPassword } from "../../utils/crypto.js";
import { HttpError } from "../../utils/httpError.js";
import { env, isProduction } from "../../config/env.js";
import type { Response } from "express";

export function publicUser(user: any) {
  const { passwordHash, googleId, ...safe } = user;
  return safe;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAMESITE,
    maxAge: env.SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export async function createSession(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress
    }
  });
  return { token, session };
}

export async function registerUser(input: any, meta: { userAgent?: string; ipAddress?: string }) {
  try {
    const { password, ...profileData } = input;

    const user = await prisma.user.create({
      data: {
        ...profileData,
        preferredCurrency: profileData.preferredCurrency?.toUpperCase() || "AED",
        passwordHash: await hashPassword(password)
      }
    });

    const { token } = await createSession(user.id, meta);
    return { user: publicUser(user), token };
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as any).code === "P2002") {
      throw new HttpError(409, "Email already registered");
    }
    throw error;
  }
}

export async function loginUser(input: any, meta: { userAgent?: string; ipAddress?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new HttpError(401, "Invalid email or password");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid email or password");

  const { token } = await createSession(user.id, meta);
  return { user: publicUser(user), token };
}

export async function logoutSession(token?: string) {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}


export async function loginOrCreateOAuthUser(profile: { provider: "google"; providerId: string; email: string; name?: string; picture?: string; emailVerified?: boolean }, meta: { userAgent?: string; ipAddress?: string }) {
  const email = profile.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { OR: [{ googleId: profile.providerId }, { email }] } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId || profile.providerId,
        authProvider: user.authProvider === "password" ? "password+google" : "google",
        emailVerified: profile.emailVerified ?? user.emailVerified,
        profileImage: user.profileImage || profile.picture || null
      }
    });
  } else {
    user = await prisma.user.create({
      data: {
        name: profile.name || email.split("@")[0] || "Traveler",
        email,
        passwordHash: await hashPassword(createSessionToken()),
        authProvider: "google",
        googleId: profile.providerId,
        emailVerified: !!profile.emailVerified,
        profileImage: profile.picture || null,
        preferredCurrency: "AED",
        preferredLanguage: "en",
        defaultTravelStyle: "Balanced"
      }
    });
  }
  const { token } = await createSession(user.id, meta);
  return { user: publicUser(user), token };
}
