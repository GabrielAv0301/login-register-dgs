# Login/Register con Astro DB (Node + SSR)

Guia paso a paso para probar un modulo de autenticacion (registro, login, sesiones, pantallas publica/privada) con Astro 5, Astro DB y adapter de Node en modo SSR.

## Requisitos
- Node 18+ (recomendado LTS).
- pnpm o npm instalado.
- Sin base remota: se usa Astro DB local (SQLite en `.astro/content.db`). Para remoto (Turso/libSQL) define `ASTRO_DB_REMOTE_URL` y `ASTRO_DB_APP_TOKEN`.

## Instalacion y preparacion
1) Instalar dependencias:
   ```bash
   pnpm install    # o npm install
   ```
2) Crear/actualizar base local:
   ```bash
   pnpm astro db push
   ```
   Si ya existia `.astro/content.db` y choca el esquema:
   ```bash
   del .astro\content.db
   pnpm astro db push
   ```
3) Levantar en modo dev:
   ```bash
   pnpm run dev
   ```
   Navega a http://localhost:4321 (`/`, `/register`, `/login`, `/dashboard`).

## Configuracion clave

### Adapter Node y SSR
- Archivo: `astro.config.mjs`
- Usa `@astrojs/node` con `output: "server"` y `mode: "standalone"`. Habilita SSR en Node y empaqueta dependencias para servir en un server Node.

### Astro DB (esquema y cliente)
- Archivo: `db/config.ts`
- Tablas:
  - `Users`: `id` (uuid), `email` (unico), `passwordHash`, `createdAt` (default CURRENT_TIMESTAMP).
  - `Sessions`: `tokenHash` (sha256 del token, pk), `userId` (fk Users), `expiresAt`, `createdAt`.
- Se definen con `defineDb`/`defineTable` y se consultan via `astro:db`.

### Tipado de locals
- Archivo: `src/env.d.ts`
- Define `App.Locals.user` y `App.Locals.csrfToken` para propagar datos de sesion a middleware y SSR.

### Cookies y seguridad
- Cookies httpOnly + `sameSite: "strict"`. `secure` se activa automaticamente si `NODE_ENV=production` o `COOKIE_SECURE=true`.
- CSRF: el middleware genera cookie `csrfToken` y las rutas/login/register/logout validan el token (formularios llevan `csrfToken` oculto).
- Rate limit: 5 intentos en 5 minutos para login/register (Actions y endpoints API) basado en IP/headers.
- Tokens de sesion: la cookie guarda el token real, la base solo guarda `tokenHash` (sha256) para no exponer sesiones.
- `.env`, `.astro/` y `node_modules/` ya estan en `.gitignore` para no publicar secretos ni binarios.

## Autenticacion: utilidades, middleware, actions y API

### Utilidades de auth
- Archivo: `src/lib/auth.ts`
- Hash y verificacion de contrasena con `scrypt` (parametros reforzados) + salt, en modo async.
- CRUD de usuario y sesiones en Astro DB (`createUser`, `findUserByEmail`, `createSession`, `clearSession`, `getSessionUser`).
- Config de cookie (`SESSION_COOKIE`, `authCookieOptions`) con httpOnly, sameSite=strict, secure auto en prod.

### Middleware (proteccion de rutas)
- Archivo: `src/middleware.ts`
- Flujo:
  1) Genera cookie CSRF y asigna `context.locals.csrfToken`.
  2) Lee cookie `session`, carga usuario con `getSessionUser`, asigna `context.locals.user`.
  3) Protege `/dashboard` (redirige a `/login` si no hay sesion).
  4) Evita que un autenticado acceda a `/login` o `/register` (redirige a `/dashboard`).

### Astro Actions (login/register)
- Archivo: `src/actions/index.ts`
- Actions `register` y `login` con `defineAction` + validacion `z` (`astro:schema`), verifican CSRF y aplican rate limit.
- Crean/verifican usuario, generan sesion, setean cookie y devuelven `{ ok: true }`.
- Puedes usarlas con formularios `accept="form"` o via fetch al endpoint de la Action.

### Rutas API clasicas (opcional)
- Archivos: `src/pages/api/register.ts`, `src/pages/api/login.ts`, `src/pages/api/logout.ts`
- Mismo flujo que las Actions pero como endpoints POST tradicionales (para formularios `action="/api/login"`), con CSRF y rate limit en login/register.

## Paginas y flujo publico/privado
- `src/pages/index.astro`: vista publica; muestra estado de sesion y enlaces a login/registro o logout/dashboard (formularios llevan CSRF).
- `src/pages/register.astro`: formulario de registro con CSRF.
- `src/pages/login.astro`: formulario de login con CSRF.
- `src/pages/dashboard.astro`: area privada; el middleware obliga a tener sesion; incluye logout con CSRF.

## Variables de entorno
- Ejemplo local (`.env`):
  ```
  ASTRO_DB_REMOTE_URL=file:./.astro/content.db
  ASTRO_DB_APP_TOKEN=
  ```
- Para Turso/libSQL remoto:
  ```
  ASTRO_DB_REMOTE_URL=libsql://<tu-db>.turso.io
  ASTRO_DB_APP_TOKEN=<token>
  ```
- Para forzar cookies `secure` en otro entorno (ej. staging con HTTPS):
  ```
  COOKIE_SECURE=true
  ```

## Seguridad / hardening
- No subas `.astro/content.db` ni `.env`; ya estan ignorados por git, pero si los versionaste, eliminalos del repo antes de publicar.
- Si cambiaste de version y ya tenias base local, elimina `.astro/content.db` y corre `pnpm astro db push` para aplicar el nuevo esquema (usa `tokenHash`).
- Si montas tras un proxy, preserva cabeceras `X-Forwarded-For`/`X-Real-IP` para que el rate limit por IP funcione.
- Revisa que sirvas sobre HTTPS en produccion; asi `secure` en cookies se activara automaticamente.

## Como probar el flujo
1) `pnpm run dev`.
2) En el navegador:
   - `/register` crea cuenta -> queda logueado y va a `/dashboard`.
   - Logout en `/dashboard` o `/` (form a `/api/logout` o usando Actions si conectas el formulario).
   - `/login` para reingresar; si entras a `/dashboard` sin sesion, middleware te manda a `/login`.

## Produccion / despliegue
- Usa `pnpm build` y `pnpm preview` (Node SSR por el adapter).
- Con HTTPS en prod, `secure` en cookies se aplica por `NODE_ENV=production` o `COOKIE_SECURE=true`.
- Para base remota, define `ASTRO_DB_REMOTE_URL` y `ASTRO_DB_APP_TOKEN` antes de `astro db push`.
- Si migras desde la version anterior de esquema, elimina la base vieja y ejecuta de nuevo `pnpm astro db push`.

## Estructura rapida
- `astro.config.mjs` -> SSR + adapter Node + Astro DB.
- `db/config.ts` -> esquema Users/Sessions.
- `src/env.d.ts` -> tipado de locals.user/csrfToken.
- `src/lib/auth.ts` -> hash/verificacion, sesiones, cookies.
- `src/lib/csrf.ts` -> emision y validacion de token CSRF.
- `src/lib/rate-limit.ts` -> rate limit en login/register.
- `src/middleware.ts` -> proteccion de rutas y redirecciones.
- `src/actions/index.ts` -> Actions login/register.
- `src/pages/api/*.ts` -> Endpoints API equivalentes.
- `src/pages/*.astro` -> vistas publica y privada.

## Comandos rapidos para ver la base local (ejecutar en otra terminal)
- `pnpm astro db shell --query "SELECT id, email, createdAt FROM Users;"` -> lista usuarios (campos clave).
- `pnpm astro db shell --query "SELECT tokenHash, userId, expiresAt FROM Sessions;"` -> lista sesiones activas.
- `pnpm astro db shell --query "SELECT * FROM Users;"` -> muestra todos los campos de `Users`.
- `pnpm astro db shell --query "SELECT * FROM Sessions;"` -> muestra todos los campos de `Sessions`.

Se pueden lanzar mientras el dev server esta corriendo para ir consultando el estado de la base local en `.astro/content.db`.
