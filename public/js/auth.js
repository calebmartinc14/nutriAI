// Autenticación con Supabase: comprueba sesión y pinta la pantalla de login.
import { getSupabase, CLOUD_ENABLED } from "./lib/supabase.js";
import { icon } from "./lib/icons.js";

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
        <button class="btn btn-ghost btn-block" id="au-google">Entrar con Google</button>

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
  $("au-google").addEventListener("click", () => doGoogle(msg));
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

async function doGoogle(msg) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin },
  });
  if (error) msg(error.message);
}
