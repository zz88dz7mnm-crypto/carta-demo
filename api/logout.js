"use strict";

const { parseCookies, sendJson, destroySession, clearSessionCookie, SESSION_COOKIE } = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const cookies = parseCookies(req.headers.cookie);
  await destroySession(cookies[SESSION_COOKIE]);
  clearSessionCookie(req, res);
  return sendJson(res, 200, { ok: true });
};
