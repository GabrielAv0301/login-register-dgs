# Login/Register con Astro DB (Node + SSR)

Módulo de autenticación con registro, login y sesiones persistentes usando Astro 5, Astro DB (SQLite local) y adapter de Node en modo SSR. Incluye middleware de protección, acciones y endpoints equivalentes, CSRF, cookies seguras y rate limiting básico.

## Requisitos
- Node 18+
- pnpm o npm
- Base local por defecto (`.astro/content.db`); para Turso/libSQL usa `ASTRO_DB_REMOTE_URL` y `ASTRO_DB_APP_TOKEN`.

## Instalación rápida
```bash
pnpm install          # o npm install
pnpm astro db push    # crea/actualiza SQLite local
pnpm run dev          # abre http://localhost:4321
```

Si el esquema choca con una base previa, borra `.astro/content.db` y repite `pnpm astro db push`.

## Qué hace
- Rutas `/register`, `/login`, `/dashboard` (privada) y `/` (pública con estado de sesión).
- Middleware protege `/dashboard`, redirige a `/login` si no hay sesión y evita acceso a login/register si ya hay sesión.
- Acciones y endpoints REST equivalentes para login/register/logout.
- Cookies httpOnly + sameSite=strict; `secure` se activa en prod o con `COOKIE_SECURE=true`.
- CSRF vía cookie + hidden input en formularios; rate limit 5 intentos/5 min en login/register.
- Tokens de sesión: la cookie lleva el token real, la base guarda solo `tokenHash` (sha256).
- Hash de contraseñas con `scrypt` (parámetros reforzados, async).

## Archivos clave
- `astro.config.mjs`: SSR con `@astrojs/node` modo standalone.
- `db/config.ts`: tablas `Users` y `Sessions` con `tokenHash` y expiración.
- `src/lib/auth.ts`: hash/verify, creación de usuario, sesiones, cookies.
- `src/lib/csrf.ts`: emisión y validación de CSRF.
- `src/lib/rate-limit.ts`: límite en memoria para login/register.
- `src/middleware.ts`: carga de sesión y protección de rutas.
- `src/actions/index.ts`: Actions de login/register con CSRF + rate limit.
- `src/pages/api/*.ts`: endpoints REST equivalentes (login/register/logout).
- `src/pages/*.astro`: vistas pública/privada con formularios y CSRF.
- `src/env.d.ts`: tipos para `locals.user` y `locals.csrfToken`.

## Variables de entorno
Ejemplo `.env` local:
```
ASTRO_DB_REMOTE_URL=file:./.astro/content.db
ASTRO_DB_APP_TOKEN=
```

Para remoto (Turso/libSQL):
```
ASTRO_DB_REMOTE_URL=libsql://<tu-db>.turso.io
ASTRO_DB_APP_TOKEN=<token>
```

Forzar cookie `secure` (staging/prod con HTTPS):
```
COOKIE_SECURE=true
```

## Pruebas manuales
1) `pnpm run dev`
2) Navega a `/register` (crea usuario y redirige a `/dashboard`).
3) Logout desde `/dashboard` o `/` (POST a `/api/logout` con CSRF).
4) Login en `/login`; si accedes a `/dashboard` sin sesión, te redirige a `/login`.

## Producción / despliegue
- Build/preview: `pnpm build` y `pnpm preview` (SSR en Node).
- Usa HTTPS para habilitar `secure` en cookies (o `COOKIE_SECURE=true`).
- Para cambiar de esquema, borra la base local y corre `pnpm astro db push`.
- Si despliegas con varias instancias, mueve el rate limit a un almacén compartido o aplica rate limiting en el proxy.

## Notas de seguridad
- No publiques `.env` ni `.astro/content.db` (ignorados en `.gitignore`).
- El rate limit en memoria es solo para demos/local; en producción usa un backend compartido o el proxy.
- Respeta cabeceras `X-Forwarded-For`/`X-Real-IP` en tu proxy para que el rate limit por IP funcione.
