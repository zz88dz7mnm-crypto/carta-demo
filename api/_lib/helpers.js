"use strict";

const crypto = require("node:crypto");
const { supabase } = require("./supabase");

const SESSION_COOKIE = "levels_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB, de sobra para la carta completa
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

// Usuario y clave no distinguen mayusculas/minusculas: normalizamos antes
// de guardar o comparar. (Ojo: esto reduce un poco la entropia efectiva de
// la clave, es un pedido explicito, no un default que recomendariamos.)
function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePasswordCase(value) {
  return String(value || "").toLowerCase();
}

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalizePasswordCase(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, saltHex, hashHex) {
  const attempt = crypto.scryptSync(normalizePasswordCase(password), saltHex, 64);
  const expected = Buffer.from(hashHex, "hex");
  if (attempt.length !== expected.length) return false;
  return crypto.timingSafeEqual(attempt, expected);
}

// Hash "señuelo" fijo, usado para comparar contra clave/usuario invalidos y
// así mantener un tiempo de respuesta parejo (evita user enumeration).
let dummyHash = null;
function getDummyHash() {
  if (!dummyHash) dummyHash = hashPassword(crypto.randomBytes(16).toString("hex"));
  return dummyHash;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let rejected = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (rejected) return; // seguimos drenando el stream sin acumular mas
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(Object.assign(new Error("payload_too_large"), { code: "PAYLOAD_TOO_LARGE" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (rejected) return;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(Object.assign(new Error("invalid_json"), { code: "INVALID_JSON" }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(payload);
}

function isSecureRequest(req) {
  return req.headers["x-forwarded-proto"] === "https";
}

function setSessionCookie(req, res, token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  setSessionCookie(req, res, "", 0);
}

async function findUser(username) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (error) throw new Error(`No se pudo buscar el usuario: ${error.message}`);
  return data;
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const { error } = await supabase.from("sessions").insert({
    token,
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(`No se pudo crear la sesion: ${error.message}`);
  return token;
}

async function getSessionRow(token) {
  if (!token) return null;
  const { data: row, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la sesion: ${error.message}`);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("sessions").delete().eq("token", token);
    return null;
  }
  return row;
}

async function destroySession(token) {
  if (token) await supabase.from("sessions").delete().eq("token", token);
}

async function destroyOtherSessions(userId, keepToken) {
  await supabase.from("sessions").delete().eq("user_id", userId).neq("token", keepToken);
}

async function requireSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = await getSessionRow(cookies[SESSION_COOKIE]);
  if (!session) return null;
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", session.user_id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el usuario de la sesion: ${error.message}`);
  if (!user) return null;
  return { session, user };
}

// Rate limiting de login, en memoria: es "best effort" en un entorno
// serverless (cada instancia fria arranca con el contador en cero), pero
// igual frena intentos repetidos dentro de una misma instancia caliente.
const loginAttempts = new Map();

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function registerFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  normalizeUsername,
  hashPassword,
  verifyPassword,
  getDummyHash,
  parseCookies,
  readJsonBody,
  sendJson,
  setSessionCookie,
  clearSessionCookie,
  findUser,
  createSession,
  destroySession,
  destroyOtherSessions,
  requireSession,
  isRateLimited,
  registerFailedAttempt,
  clearAttempts,
  clientIp,
};
