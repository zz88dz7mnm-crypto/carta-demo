# Levels Bar — Carta digital

Sitio de la carta digital de Levels Bar, con panel de administración
(`/admin.html`) para editar productos, precios y marcar cosas como
agotadas. El contenido vive en una base de datos de Supabase (Postgres),
no en archivos estáticos — así que los cambios que se guardan desde el
panel se ven al instante en el sitio, sin volver a deployar nada.

Pensado para deployar en **Vercel** (funciones serverless en `/api`) con
una base de datos de **Supabase**.

## Antes de deployar (una sola vez)

### 1. Crear las tablas en Supabase

En tu proyecto de Supabase → **SQL Editor** → pegá el contenido de
[`supabase-setup.sql`](supabase-setup.sql) → **Run**. Crea tres tablas:
`menu_state` (la carta), `admin_users` (usuarios del panel) y `sessions`
(sesiones de login).

### 2. Conseguir las credenciales de Supabase

En tu proyecto → **Project Settings** (ícono de engranaje) → **API** →
sección "Project API keys":

- **Project URL** (arriba de esa misma pantalla)
- **`service_role`** `secret` (botón de copiar/revelar)

### 3. Sembrar los datos iniciales

```bash
cp .env.example .env
# completá SUPABASE_URL y SUPABASE_SERVICE_KEY en .env con los datos del paso 2

npm install
npm run seed
```

Esto carga la carta de arranque y crea el usuario admin inicial:
**usuario `levels`, clave `admin`**. Cambialo desde `/admin.html` →
Configuración apenas el sitio esté público (ver nota de seguridad al final).

## Deploy en Vercel

1. Subí esta carpeta a un repositorio nuevo en GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importá ese repo.
3. Antes de deployar, en **Environment Variables** agregá las mismas dos
   variables del `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. **Deploy**. No hace falta configurar build command ni output
   directory — Vercel detecta el sitio estático y las funciones de
   `/api` automáticamente.

## Uso local (antes de deployar, para probar)

```bash
npm install -g vercel   # si no lo tenés
vercel dev
```

Esto levanta el sitio y las funciones de `/api` en `http://localhost:3000`,
usando las variables del `.env` local.

## Estructura

- `index.html`, `platos.html`, `bebidas.html`, `bebidas-*.html`,
  `sin-gluten.html`, `postres.html`: páginas del sitio (estáticas).
- `admin.html`: panel de administración.
- `styles.css`, `assets/admin.css`: estilos.
- `assets/menu-data.js`: carta "de fábrica" — se usa para sembrar la base
  de datos y como respaldo si `/api/menu` no responde.
- `assets/menu-renderer.js`, `assets/admin.js`: JS del sitio y del panel.
- `api/*.js`: funciones serverless (login, sesión, cambiar clave/usuario,
  leer y guardar la carta). Cada una es un endpoint independiente que
  Vercel expone automáticamente en `/api/<nombre>`.
- `api/_lib/`: código compartido entre las funciones (no se expone como
  endpoint).
- `scripts/seed.js`: siembra inicial de la base (se corre una vez, local).
- `supabase-setup.sql`: script para crear las tablas en Supabase.

## Nota de seguridad importante

El usuario/clave inicial (`levels` / `admin`) están pensados para
desarrollo. **Apenas el sitio esté accesible públicamente, entrá a
`/admin.html` → Configuración y cambiá el usuario y la clave** — con ese
usuario y clave "de fábrica" cualquiera que los adivine puede editar tu
carta.

La `SUPABASE_SERVICE_KEY` tiene acceso total a la base (se salta cualquier
regla de seguridad a nivel de fila). Por eso vive solo del lado del
servidor (variables de entorno de Vercel / `.env` local) y nunca en el
código del sitio ni en el navegador.
