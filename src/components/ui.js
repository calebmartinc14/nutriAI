// Mini helpers de UI compartidos.

import { icon } from "../lib/icons.js";
import { store } from "../store.js";

let toastTimer;
export function toast(msg, ms = 2200) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const CREDIT_LABELS = { scan: "📸 Escáner", coach: "💬 Coach", workout: "🏋️ Rutinas AI" };
export function showLimitModal(action, remainingCredits) {
  const label = CREDIT_LABELS[action] || action;
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal limit-modal">
      <div class="limit-ico">${icon('ban', 48)}</div>
      <h3>Límite diario alcanzado</h3>
      <p>Has agotado tus usos de <b>${escapeHtml(label)}</b> por hoy.</p>
      <div class="credit-bar">
        <span>📸 ${remainingCredits("scan")}/${2}</span>
        <span>💬 ${remainingCredits("coach")}/${5}</span>
        <span>🏋️ ${remainingCredits("workout")}/${2}</span>
      </div>
      <button class="btn btn-primary btn-block" id="modal-premium">💎 Hazte Premium — usos ilimitados</button>
      <button class="btn btn-ghost btn-block" id="modal-close">Volver</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector("#modal-close").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modal-premium").addEventListener("click", () => {
    store.setPremium(true);
    overlay.remove();
    toast("🎉 ¡Ya eres Premium! Todos los límites eliminados.");
    setTimeout(() => location.reload(), 1200);
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}


