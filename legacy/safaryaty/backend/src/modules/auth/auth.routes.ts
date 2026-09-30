import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { env, isProduction } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./auth.validators.js";
import { loginOrCreateOAuthUser, loginUser, logoutSession, publicUser, registerUser, setSessionCookie } from "./auth.service.js";
import { hashPassword, verifyPassword } from "../../utils/crypto.js";
import { HttpError } from "../../utils/httpError.js";
import { getPermissions } from "../rbac/permissions.js";
import { rateLimit } from "../../middleware/rateLimit.js";

const router = Router();


const oauthStateCookie = "safaryaty_oauth_state";
function googleReady() {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
function googleRedirectUri() {
  return env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${env.PORT}/api/auth/google/callback`;
}
function oauthSuccessUrl() {
  return env.OAUTH_SUCCESS_REDIRECT || `${env.APP_ORIGIN}/?auth=success`;
}
function oauthFailureUrl(reason = "oauth_failed") {
  const base = env.OAUTH_FAILURE_REDIRECT || `${env.APP_ORIGIN}/?auth=failed`;
  const url = new URL(base);
  url.searchParams.set("reason", reason);
  return url.toString();
}

router.get("/providers", (_req, res) => {
  res.json(ok({ google: googleReady(), password: true, demo: true }));
});

router.get("/google/start", asyncHandler(async (_req, res) => {
  if (!googleReady()) return res.redirect(oauthFailureUrl("google_not_configured"));
  const state = crypto.randomBytes(24).toString("base64url");
  res.cookie(oauthStateCookie, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAMESITE,
    maxAge: 10 * 60 * 1000,
    path: "/api/auth/google"
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  res.redirect(url.toString());
}));

router.get("/google/callback", asyncHandler(async (req, res) => {
  const expected = req.cookies?.[oauthStateCookie];
  const received = String(req.query.state || "");
  res.clearCookie(oauthStateCookie, { path: "/api/auth/google" });
  if (!googleReady()) return res.redirect(oauthFailureUrl("google_not_configured"));
  if (!expected || expected !== received) return res.redirect(oauthFailureUrl("invalid_oauth_state"));
  const code = String(req.query.code || "");
  if (!code) return res.redirect(oauthFailureUrl("missing_code"));

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code"
    })
  });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return res.redirect(oauthFailureUrl("token_exchange_failed"));

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  const profile: any = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || !profile.email || !profile.sub) return res.redirect(oauthFailureUrl("profile_failed"));

  const result = await loginOrCreateOAuthUser({
    provider: "google",
    providerId: String(profile.sub),
    email: String(profile.email),
    name: profile.name ? String(profile.name) : undefined,
    picture: profile.picture ? String(profile.picture) : undefined,
    emailVerified: !!profile.email_verified
  }, { userAgent: req.headers["user-agent"], ipAddress: req.ip });
  setSessionCookie(res, result.token);
  res.redirect(oauthSuccessUrl());
}));


const authLimiter = rateLimit({ prefix: "auth", windowMs: 15 * 60 * 1000, max: 8, message: "Too many auth attempts. Please wait and try again." });

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), env.UPLOAD_DIR, "avatars"),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const allowedAvatarMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedAvatarExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedAvatarMime.has(file.mimetype) || !allowedAvatarExt.has(ext)) return cb(new HttpError(422, "Avatar must be JPG, PNG, or WEBP") as any, false);
    cb(null, true);
  }
});

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, { userAgent: req.headers["user-agent"], ipAddress: req.ip });
  setSessionCookie(res, result.token);
  res.status(201).json(ok({ user: result.user, permissions: getPermissions(result.user as any) }));
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input, { userAgent: req.headers["user-agent"], ipAddress: req.ip });
  setSessionCookie(res, result.token);
  res.json(ok({ user: result.user, permissions: getPermissions(result.user as any) }));
}));

router.post("/logout", asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME] || req.headers.authorization?.replace("Bearer ", "");
  await logoutSession(token);
  res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
  res.json(ok({ loggedOut: true }));
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  res.json(ok({ user: publicUser(user), permissions: getPermissions(user) }));
}));

router.patch("/profile", requireAuth, asyncHandler(async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: (req as any).user.id }, data: input });
  res.json(ok({ user: publicUser(user), permissions: getPermissions(user) }));
}));

router.patch("/password", requireAuth, asyncHandler(async (req, res) => {
  const input = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: (req as any).user.id } });
  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new HttpError(401, "Current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  res.json(ok({ changed: true }));
}));

router.post("/avatar", requireAuth, upload.single("avatar"), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(422, "Avatar file is required");
  const profileImage = `/uploads/avatars/${req.file.filename}`;
  const user = await prisma.user.update({ where: { id: (req as any).user.id }, data: { profileImage } });
  res.json(ok({ user: publicUser(user), profileImage }));
}));

export default router;
