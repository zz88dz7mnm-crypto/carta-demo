"use strict";

const {
  readJsonBody,
  sendJson,
  findUser,
  verifyPassword,
  getDummyHash,
  createSession,
  setSessionCookie,
  isRateLimited,
  registerFailedAttempt,
  clearAttempts,
  clientIp,
  SESSION_TTL_SECONDS,
} = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { error: "Demasiados intentos. Probá de nuevo en unos minutos." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Cuerpo invalido" });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = username ? await findUser(username) : null;
  const dummy = getDummyHash();

  // Siempre corre scrypt, exista o no el usuario, para que el tiempo de
  // respuesta no delate si el usuario existe (mitiga user enumeration).
  const valid = verifyPassword(
    password,
    user ? user.salt : dummy.salt,
    user ? user.password_hash : dummy.hash,
  );

  if (!user || !valid) {
    registerFailedAttempt(ip);
    return sendJson(res, 401, { error: "Usuario o clave incorrectos" });
  }

  clearAttempts(ip);
  const token = await createSession(user.id);
  setSessionCookie(req, res, token, SESSION_TTL_SECONDS);
  return sendJson(res, 200, { ok: true, mustChangePassword: Boolean(user.must_change_password) });
};
