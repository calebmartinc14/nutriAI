import { store } from "./store.js";
import { getStatus, confirmPremium } from "./api.js";
import { CLOUD_ENABLED, getCurrentUser, renderLogin, signOut } from "./auth.js";
import { renderLanding } from "./components/landing.js";
import { t, applyI18n, getLocale } from "./lib/i18n.js";
import { icon } from "./lib/icons.js";
import * as cloud from "./cloud.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderScanner } from "./components/scanner.js";
import { renderCoach } from "./components/coach.js";
import { renderHistory, resetHistoryWeek } from "./components/history.js";
import { renderWeight } from "./components/weight.js";
import { renderWorkout } from "./components/workout.js";
import { renderRank } from "./components/rank.js";
import { renderLeague } from "./components/league.js";
import { renderProducts } from "./components/products.js";
import { renderRecipes } from "./components/recipes.js";
import { renderProgress } from "./components/progress.js";
import { renderPricing } from "./components/pricing.js";
import { toast } from "./components/ui.js";
import { openOnboarding } from "./components/onboarding.js";


const viewEl = document.getElementById("view");
const navItems = document.querySelectorAll(".nav-item[data-view]");

let current = "dashboard";

function navigate(view, params = {}) {
  current = view;
  if (view === "history") resetHistoryWeek();
  navItems.forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    // En móvil la barra hace scroll: trae la pestaña activa a la vista.
    if (active) t.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
  render(params);
  window.scrollTo(0, 0);
}

function refresh() {
  render();
}

function render(params = {}) {
  const ctx = { navigate, refresh, params };
  renderCurrent(ctx);
  updateAiBadge();
  // Animación de entrada de la vista (fade-in + slide-up) en cada navegación.
  viewEl.classList.remove("view-enter");
  void viewEl.offsetWidth; // reinicia la animación
  viewEl.classList.add("view-enter");
}

function renderCurrent(ctx) {
  if (current === "dashboard") renderDashboard(viewEl, ctx);
  else if (current === "scanner") renderScanner(viewEl, ctx);
  else if (current === "history") renderHistory(viewEl, ctx);
  else if (current === "weight") renderWeight(viewEl, ctx);
  else if (current === "workout") renderWorkout(viewEl, ctx);
  else if (current === "progress") renderProgress(viewEl, ctx);
  else if (current === "rank") renderRank(viewEl, ctx);
  else if (current === "league") renderLeague(viewEl, ctx);
  else if (current === "products") renderProducts(viewEl, ctx);
  else if (current === "recipes") renderRecipes(viewEl, ctx);
  else if (current === "coach") renderCoach(viewEl, ctx);
  else if (current === "pricing") renderPricing(viewEl, ctx);
}

function updateHeader() {
  const h = new Date().getHours();
  const greet = h < 12 ? t("greet.morning") : h < 19 ? t("greet.afternoon") : t("greet.evening");
  document.getElementById("greeting").innerHTML = greet + ' ' + icon('hand', 16);
  const dateLabel = new Intl.DateTimeFormat(getLocale(), { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  document.getElementById("date-label").textContent =
    dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
}

async function updateAiBadge() {
  const badge = document.getElementById("ai-badge");
  const status = await getStatus();
  if (status.demo) {
    badge.className = "badge badge-muted";
    badge.innerHTML = `${icon('flask', 14)} Demo`;
    badge.title = "Sin API key: se usan datos simulados";
  } else {
    const premium = store.isPremium();
    badge.className = `badge ${premium ? "badge-premium" : "badge-credits"}`;
    badge.innerHTML = premium
      ? `${icon('crown', 14)} Premium`
      : `${icon('bot', 14)} ${store.remainingCredits("scan")}📸 ${store.remainingCredits("coach")}💬`;
    const label = status.provider === "openrouter" ? "OpenRouter" : "Gemini";
    badge.title = premium
      ? `Premium · ${label} (${status.model})`
      : `IA real · ${label} (${status.model}) · ${store.remainingCredits("scan")}/${2} escáner, ${store.remainingCredits("coach")}/${5} coach, ${store.remainingCredits("workout")}/${2} rutinas`;
  }
}

function addSignOutButton() {
  const foot = document.querySelector(".side-foot");
  if (!foot || document.getElementById("signout")) return;
  const btn = document.createElement("button");
  btn.id = "signout";
  btn.className = "nav-item";
  btn.innerHTML = `<span class="ni-ico">${icon('log-out', 20)}</span> <span class="ni-tx" data-i18n="nav.signout">Cerrar sesión</span>`;
  btn.addEventListener("click", signOut);
  foot.insertBefore(btn, foot.firstChild);
}

// ---- Listeners de UI (shell siempre presente al estar logueado / modo local) ----
navItems.forEach((t) => t.addEventListener("click", () => navigate(t.dataset.view)));
document.getElementById("edit-profile").addEventListener("click", () =>
  openOnboarding({ isEdit: true, onDone: () => { updateHeader(); navigate("dashboard"); } })
);

// ---- Arranque ----
async function initApp() {
  if (CLOUD_ENABLED) {
    let user = null;
    try {
      user = await getCurrentUser();
    } catch (e) {
      console.error("Error iniciando la nube:", e);
    }
    if (!user) {
      // Landing explicativa -> botón "Comenzar" -> formulario de login.
      renderLanding(() => renderLogin(() => location.reload()));
      return;
    }
    try {
      await cloud.pullAll(user); // descarga datos y fija namespace + username
    } catch (e) {
      console.warn("No se pudo sincronizar con la nube:", e);
    }
    store.setSyncHandler(cloud.push); // a partir de aquí, cada cambio se sube
    addSignOutButton();
  }

  applyI18n(document); // traduce el nav y textos marcados
  updateHeader();
  updateAiBadge();

  if (!store.isOnboarded()) {
    openOnboarding({ onDone: () => navigate("dashboard") });
  }
  navigate("dashboard");
}

// Al cambiar de idioma (desde Mi perfil), re-traduce y refresca cabecera/vista.
window.addEventListener("nutveo-lang", () => {
  applyI18n(document);
  updateHeader();
  refresh();
});

// ---- Confirmar pago Premium al volver de Lemon Squeezy ----
(async function checkPremiumReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("premium") === "success" && params.get("checkout_id")) {
    const id = params.get("checkout_id");
    const paid = await confirmPremium(id).catch(() => false);
    if (paid) {
      store.setPremium(true);
      toast("\u{1F389} \u{A1}Pago confirmado! Ya eres Premium.");
    }
    history.replaceState(null, "", "/");
  }
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

initApp();
