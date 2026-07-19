"use strict";

const { sendJson, requireSession } = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Metodo no permitido" });
  const auth = await requireSession(req);
  if (!auth) return sendJson(res, 200, { authenticated: false });
  return sendJson(res, 200, {
    authenticated: true,
    username: auth.user.username,
    mustChangePassword: Boolean(auth.user.must_change_password),
  });
};
