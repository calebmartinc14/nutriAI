import { store } from "./store.js";
import { getStatus } from "./api.js";
import { CLOUD_ENABLED, getCurrentUser, renderLogin, signOut } from "./auth.js";
import * as cloud from "./cloud.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderScanner } from "./components/scanner.js";
import { renderCoach } from "./components/coach.js";
import { renderHistory, resetHistoryWeek } from "./components/history.js";
import { renderWeight } from "./components/weight.js";
import { renderWorkout } from "./components/workout.js";
import { renderRank } from "./components/rank.js";
import { renderLeague } from "./components/league.js";
import { openOnboarding } from "./components/onboarding.js";

const viewEl = document.getElementById("view");
const navItems = document.querySelectorAll(".nav-item[data-view]");

let current = "dashboard";

function navigate(view, params = {}) {
  current = view;
  if (view === "history") resetHistoryWeek();
  navItems.forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  render(params);
  window.scrollTo(0, 0);
}

function refresh() {
  render();
}

function render(params = {}) {
  const ctx = { navigate, refresh, params };
  if (current === "dashboard") renderDashboard(viewEl, ctx);
  else if (current === "scanner") renderScanner(viewEl, ctx);
  else if (current === "history") renderHistory(viewEl, ctx);
  else if (current === "weight") renderWeight(viewEl, ctx);
  else if (current === "workout") renderWorkout(viewEl, ctx);
  else if (current === "rank") renderRank(viewEl, ctx);
  else if (current === "league") renderLeague(viewEl, ctx);
  else if (current === "coach") renderCoach(viewEl, ctx);
}

function updateHeader() {
  const h = new Date().getHours();
  document.getElementById("greeting").textContent =
    h < 12 ? "Buenos días 👋" : h < 19 ? "Buenas tardes 👋" : "Buenas noches 👋";
  const dateLabel = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  document.getElementById("date-label").textContent =
    dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
}

async function updateAiBadge() {
  const badge = document.getElementById("ai-badge");
  const status = await getStatus();
  if (status.demo) {
    badge.className = "badge badge-muted";
    badge.textContent = "🧪 Demo";
    badge.title = "Sin clave de Gemini: se usan datos simulados";
  } else {
    badge.className = "badge badge-credits";
    badge.textContent = "🤖 IA";
    badge.title = `IA real activa (${status.model})`;
  }
}

function addSignOutButton() {
  const foot = document.querySelector(".side-foot");
  if (!foot || document.getElementById("signout")) return;
  const btn = document.createElement("button");
  btn.id = "signout";
  btn.className = "nav-item";
  btn.innerHTML = `<span class="ni-ico">⎋</span> Cerrar sesión`;
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
      renderLogin(() => location.reload()); // tras login recargamos y entramos
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

  updateHeader();
  updateAiBadge();

  if (!store.isOnboarded()) {
    openOnboarding({ onDone: () => navigate("dashboard") });
  }
  navigate("dashboard");
}

initApp();
