# 🚀 Publicar NutriAI online (login + nube + liga de amigos)

Guía paso a paso. Todo con planes **gratuitos**. Tiempo estimado: ~30-45 min.

> La app sigue funcionando en **modo local** mientras no rellenes `config.js`.
> Estos pasos activan el modo nube (login + datos compartidos + liga).

---

## 1) Crear el proyecto en Supabase
1. Entra en **https://supabase.com** → *Start your project* → inicia sesión con GitHub.
2. *New project* → ponle nombre (ej. `nutriai`), elige una contraseña de BD y la región más cercana.
3. Espera ~2 min a que se cree.

## 2) Crear las tablas
1. En el panel de Supabase, ve a **SQL Editor** → *New query*.
2. Abre el archivo `web/supabase/schema.sql`, copia **todo** su contenido, pégalo y pulsa **Run**.
3. Debe decir "Success". Ya tienes las tablas y la seguridad por usuario.

## 3) Activar el login
1. Ve a **Authentication → Providers → Email**: déjalo activado.
2. **Importante (para que entrar sea instantáneo):** en **Authentication → Sign In / Providers → Email**, desactiva *"Confirm email"* (si lo dejas activo, cada usuario tendrá que confirmar por correo antes de entrar).
3. (Opcional) Para "Entrar con Google": activa el provider **Google** y sigue sus instrucciones (crear credenciales en Google Cloud). Puedes dejarlo para más tarde; con email/contraseña ya funciona.

## 4) Conseguir tus claves
1. Ve a **Project Settings → API**.
2. Copia **Project URL** y la clave **anon public**.
3. Abre `web/public/js/config.js` y pégalas:
   ```js
   export const SUPABASE_URL = "https://TUPROYECTO.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...."; // anon public
   ```
   *(Son públicas, es seguro tenerlas en el cliente.)*

## 5) Desplegar la IA (Edge Function) — opcional pero recomendado
Para que el escáner/coach funcionen online necesitas la función `ai`:
1. Instala la CLI de Supabase: https://supabase.com/docs/guides/cli (`npm i -g supabase`).
2. En una terminal dentro de `web`:
   ```bash
   supabase login
   supabase link --project-ref TU_REF      # el ref está en Project Settings
   supabase secrets set GEMINI_API_KEY=tu_clave_de_gemini
   supabase functions deploy ai --no-verify-jwt
   ```
> Si te saltas este paso, la app funciona igual pero el escáner/coach irán en **modo demo** online.

## 6) Publicar la web (hosting gratis)
Recomendado: **Cloudflare Pages** o **Vercel** (ambos gratis).

**Con Cloudflare Pages:**
1. Sube el proyecto a un repositorio de GitHub.
2. En https://pages.cloudflare.com → *Create a project* → conecta el repo.
3. Configuración de build:
   - **Framework preset:** None
   - **Build command:** (vacío)
   - **Build output directory:** `web/public`
4. *Deploy*. Te dará una URL pública tipo `https://nutriai.pages.dev`.

> Nota: con este hosting estático, el servidor local `server.js` no se usa; las
> llamadas de IA van a la Edge Function de Supabase (paso 5).

## 7) ¡Listo! Probar y competir
1. Abre tu URL pública → te pedirá **crear cuenta** (nombre + email + contraseña).
2. Completa el onboarding y registra tus pesos/lifts.
3. Ve a **Liga** → *Crear liga* → comparte el **código** con tus colegas.
4. Ellos se registran, entran en *Liga* → *Unirme* con tu código.
5. ¡A competir por el rango! 🏆

---

## Resumen de costes
- Supabase Free: 500 MB BD, 50.000 usuarios activos/mes, Edge Functions incluidas.
- Cloudflare Pages / Vercel: hosting estático gratis.
- Gemini: cuota gratuita propia.

Para un grupo de amigos, **gratis de sobra**.

## Privacidad
- Cada usuario solo puede ver/editar **sus** datos (comidas, peso, lifts) gracias a RLS.
- Lo único compartido para la liga es: **nombre, rango y nº de entrenos** (tabla `public_stats`). No se comparten tus comidas ni tu peso corporal con los demás.
