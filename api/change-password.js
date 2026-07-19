"use strict";

const { supabase } = require("./_lib/supabase");
const {
  readJsonBody,
  sendJson,
  requireSession,
  verifyPassword,
  hashPassword,
  destroyOtherSessions,
} = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const auth = await requireSession(req);
  if (!auth) return sendJson(res, 401, { error: "No autenticado" });

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Cuerpo invalido" });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!verifyPassword(currentPassword, auth.user.salt, auth.user.password_hash)) {
    return sendJson(res, 401, { error: "La clave actual no es correcta" });
  }
  if (newPassword.length < 10) {
    return sendJson(res, 422, { error: "La clave nueva debe tener al menos 10 caracteres" });
  }

  const { salt, hash } = hashPassword(newPassword);
  const { error } = await supabase
    .from("admin_users")
    .update({ password_hash: hash, salt, must_change_password: false })
    .eq("id", auth.user.id);
  if (error) return sendJson(res, 500, { error: "No se pudo guardar la clave nueva" });

  await destroyOtherSessions(auth.user.id, auth.session.token);
  return sendJson(res, 200, { ok: true });
};
