"use strict";

const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_KEY. " +
      "En Vercel: Project Settings -> Environment Variables. En local: archivo .env (ver .env.example).",
  );
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

module.exports = { supabase };
