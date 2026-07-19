"use strict";

const { supabase } = require("./_lib/supabase");
const {
  readJsonBody,
  sendJson,
  requireSession,
  verifyPassword,
  normalizeUsername,
  findUser,
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
  const newUsername = normalizeUsername(body.newUsername);

  if (!verifyPassword(currentPassword, auth.user.salt, auth.user.password_hash)) {
    return sendJson(res, 401, { error: "La clave actual no es correcta" });
  }
  if (newUsername.length < 3 || newUsername.length > 40) {
    return sendJson(res, 422, { error: "El usuario debe tener entre 3 y 40 caracteres" });
  }
  if (!/^[a-z0-9._-]+$/.test(newUsername)) {
    return sendJson(res, 422, {
      error: "El usuario solo puede tener letras, numeros, puntos, guiones y guion bajo",
    });
  }

  const existing = await findUser(newUsername);
  if (existing && existing.id !== auth.user.id) {
    return sendJson(res, 409, { error: "Ese usuario ya existe" });
  }

  const { error } = await supabase
    .from("admin_users")
    .update({ username: newUsername })
    .eq("id", auth.user.id);
  if (error) return sendJson(res, 500, { error: "No se pudo guardar el usuario nuevo" });
  return sendJson(res, 200, { ok: true, username: newUsername });
};
