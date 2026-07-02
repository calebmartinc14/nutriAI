// Autenticación con Supabase: comprueba sesión y pinta la pantalla de login.
import { getSupabase, CLOUD_ENABLED } from "./lib/supabase.js";
import { icon } from "./lib/icons.js";

const googleLogo = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>`;

const appleLogo = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`;

export { CLOUD_ENABLED };

export async function getCurrentUser() {
  if (!CLOUD_ENABLED) return null;
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function getAccessToken() {
  if (!CLOUD_ENABLED) return null;
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  location.reload();
}

// Pinta la pantalla de login/registro. Llama onLogin(user) al autenticarse.
export function renderLogin(onLogin) {
  document.body.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand"><span class="brand-logo">${icon('nutveo-logo', 28)}</span> Nutveo</div>
        <p class="auth-sub">Entra para sincronizar tus datos y competir con tus amigos ${icon('trophy', 14)}</p>

        <div class="field">
          <label>Nombre de usuario (visible en la liga)</label>
          <input id="au-name" type="text" placeholder="Ej. Caleb" autocomplete="nickname" />
        </div>
        <div class="field">
          <label>Email</label>
          <input id="au-email" type="email" placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input id="au-pass" type="password" placeholder="Mínimo 6 caracteres" autocomplete="current-password" />
        </div>

        <button class="btn btn-primary btn-block" id="au-login">Entrar</button>
        <button class="btn btn-ghost btn-block" id="au-signup">Crear cuenta</button>
        <div class="auth-or">o</div>
        <button class="btn btn-block btn-social btn-google" id="au-google">${googleLogo} Continuar con Google</button>
        <button class="btn btn-block btn-social btn-apple" id="au-apple">${appleLogo} Continuar con Apple</button>

        <p class="auth-msg" id="au-msg"></p>
      </div>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const msg = (t, err = true) => {
    $("au-msg").textContent = t;
    $("au-msg").style.color = err ? "var(--fat)" : "var(--cal)";
  };

  // El nombre solo es obligatorio al registrarse.
  $("au-login").addEventListener("click", () => doEmail("login", onLogin, msg));
  $("au-signup").addEventListener("click", () => doEmail("signup", onLogin, msg));
  $("au-google").addEventListener("click", () => doOAuth("google", msg));
  $("au-apple").addEventListener("click", () => doOAuth("apple", msg));
  $("au-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") doEmail("login", onLogin, msg); });
}

async function doEmail(mode, onLogin, msg) {
  const name = document.getElementById("au-name").value.trim();
  const email = document.getElementById("au-email").value.trim();
  const password = document.getElementById("au-pass").value;
  if (!email || !password) return msg("Pon email y contraseña");
  if (mode === "signup" && !name) return msg("Elige un nombre de usuario");

  const sb = await getSupabase();
  msg("Procesando...", false);

  if (mode === "signup") {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { username: name } },
    });
    if (error) return msg(error.message);
    if (!data.session) return msg("Cuenta creada. Revisa tu email para confirmar y luego entra.", false);
    onLogin(data.user, name);
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return msg(error.message);
    onLogin(data.user, data.user.user_metadata?.username ?? name);
  }
}

async function doOAuth(provider, msg) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: location.origin },
  });
  if (error) msg(error.message);
}
