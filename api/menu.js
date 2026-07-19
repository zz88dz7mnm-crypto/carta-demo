"use strict";

const { supabase } = require("./_lib/supabase");
const { readJsonBody, sendJson, requireSession } = require("./_lib/helpers");

function isPlausibleMenuDoc(doc) {
  return (
    doc &&
    typeof doc === "object" &&
    Array.isArray(doc.cards) &&
    Array.isArray(doc.beverageCards) &&
    doc.pages &&
    typeof doc.pages === "object"
  );
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("menu_state").select("data").eq("id", 1).single();
    if (error) return sendJson(res, 500, { error: "No se pudo leer la carta" });
    return sendJson(res, 200, data.data);
  }

  if (req.method === "PUT") {
    const auth = await requireSession(req);
    if (!auth) return sendJson(res, 401, { error: "No autenticado" });

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, error.code === "PAYLOAD_TOO_LARGE" ? 413 : 400, { error: "Cuerpo invalido" });
    }
    if (!isPlausibleMenuDoc(body)) {
      return sendJson(res, 422, { error: "Formato de carta invalido" });
    }

    const updatedAt = new Date().toISOString();
    const next = { ...body, updatedAt };
    const { error } = await supabase
      .from("menu_state")
      .update({ data: next, updated_at: updatedAt })
      .eq("id", 1);
    if (error) return sendJson(res, 500, { error: "No se pudo guardar la carta" });
    return sendJson(res, 200, { ok: true, updatedAt });
  }

  sendJson(res, 405, { error: "Metodo no permitido" });
};
