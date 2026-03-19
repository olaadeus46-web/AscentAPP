import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";
import { findUserById } from "./db";

const AUTH_COOKIE = "rota_auth";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET (ou JWT_SECRET/NEXTAUTH_SECRET) é obrigatório em produção.");
  }
  return "rota-ao-milhao-dev-secret-change-me";
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    getAuthSecret(),
    { expiresIn: TOKEN_MAX_AGE }
  );
}

export function readAuthToken(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[AUTH_COOKIE] || null;
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, getAuthSecret());
  } catch {
    return null;
  }
}

export async function getAuthUser(req) {
  const token = readAuthToken(req);
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload?.sub) return null;

  const user = await findUserById(payload.sub);
  return sanitizeUser(user);
}

export async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return user;
}

export function setAuthCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    })
  );
}

export function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
  );
}
