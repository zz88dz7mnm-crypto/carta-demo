"use strict";

/**
 * Siembra inicial de la base de datos en Supabase.
 *
 * Se corre UNA sola vez, en local, antes (o despues) de deployar:
 *
 *   node scripts/seed.js
 *
 * Necesita un archivo .env en la raiz del proyecto con SUPABASE_URL y
 * SUPABASE_SERVICE_KEY (ver .env.example). No hace nada si la carta o el
 * usuario admin ya existen (es seguro correrlo mas de una vez).
 */

try {
  process.loadEnvFile(require("node:path").join(__dirname, "..", ".env"));
} catch (error) {
  // Sin .env local: asumimos que las variables ya estan en el entorno
  // (por ejemplo, si esto se corre con `vercel env pull` primero).
}

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY. Creá un .env (ver .env.example).");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password.toLowerCase(), salt, 64).toString("hex");
  return { salt, hash };
}

async function main() {
  const { data: menuRow, error: menuError } = await supabase
    .from("menu_state")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  if (menuError) {
    throw new Error(
      `No se pudo leer menu_state (¿corriste supabase-setup.sql en el SQL Editor de Supabase?): ${menuError.message}`,
    );
  }

  if (!menuRow) {
    let raw = fs.readFileSync(path.join(__dirname, "..", "assets", "menu-data.js"), "utf8").trim();
    raw = raw.replace(/^window\.DEFAULT_MENU_DATA\s*=\s*/, "").replace(/;\s*$/, "");
    const seed = JSON.parse(raw);
    seed.updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("menu_state")
      .insert({ id: 1, data: seed, updated_at: seed.updatedAt });
    if (error) throw new Error(`No se pudo sembrar menu_state: ${error.message}`);
    console.log("[seed] carta inicial cargada desde assets/menu-data.js");
  } else {
    console.log("[seed] menu_state ya tenia datos, no se toco.");
  }

  const { data: userRow, error: userError } = await supabase
    .from("admin_users")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (userError) throw new Error(`No se pudo leer admin_users: ${userError.message}`);

  if (!userRow) {
    const username = "levels";
    const password = "admin";
    const { salt, hash } = hashPassword(password);
    const { error } = await supabase.from("admin_users").insert({
      username,
      password_hash: hash,
      salt,
      must_change_password: false,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`No se pudo crear el usuario admin inicial: ${error.message}`);

    console.log("");
    console.log("============================================================");
    console.log(" Usuario de administracion creado:");
    console.log(`   usuario: ${username}`);
    console.log(`   clave:   ${password}`);
    console.log(" Cambialo apenas puedas desde /admin.html -> Configuracion,");
    console.log(" sobre todo si este sitio ya esta publicado en internet.");
    console.log("============================================================");
    console.log("");
  } else {
    console.log("[seed] admin_users ya tenia un usuario, no se toco.");
  }
}

main()
  .then(() => {
    console.log("Listo.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en el seed:", error.message);
    process.exit(1);
  });
