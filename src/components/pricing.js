import { store } from "../store.js";
import { icon } from "../lib/icons.js";
import { toast } from "./ui.js";

export function renderPricing(root, { navigate }) {
  let isPremium = store.isPremium();
  const credits = { scan: 2, coach: 5, workout: 2 };
  const remaining = (action) => store.remainingCredits(action);
  const remainingText = (action) => {
    if (isPremium) return "Ilimitados";
    const n = remaining(action);
    return `${n}/${credits[action]} por d\u00eda`;
  };

  root.innerHTML = `
    <div class="pricing-page">
      <div class="pricing-header">
        <h2>${icon('sparkles', 24)} Planes</h2>
        <p>Elige el plan que mejor se adapte a ti</p>
      </div>

      <div class="pricing-cols">
        <div class="pricing-card pricing-free">
          <div class="pricing-card-head">
            <div class="pricing-icon">${icon('user', 36)}</div>
            <div class="pricing-plan-name">Free</div>
            <div class="pricing-price">0 €</div>
            <div class="pricing-price-label">siempre gratis</div>
          </div>
          <div class="pricing-features">
            <div class="pricing-feature-title">Incluye:</div>
            <div class="pricing-feat">${icon('check', 16)} Diario de comidas</div>
            <div class="pricing-feat">${icon('check', 16)} Seguimiento de peso</div>
            <div class="pricing-feat">${icon('check', 16)} Recetas</div>
            <div class="pricing-feat">${icon('check', 16)} Rutinas de entreno</div>
            <div class="pricing-feat">${icon('check', 16)} B&uacute;squeda de productos</div>
            <div class="pricing-feat">${icon('check', 16)} Liga de amigos</div>
            <div class="pricing-feat-title" style="margin-top:12px">L&iacute;mites diarios IA:</div>
            <div class="pricing-feat limit">${icon('camera', 14)} Esc&aacute;ner: <b>${remainingText("scan")}</b></div>
            <div class="pricing-feat limit">${icon('message-circle', 14)} Coach IA: <b>${remainingText("coach")}</b></div>
            <div class="pricing-feat limit">${icon('dumbbell', 14)} Rutinas IA: <b>${remainingText("workout")}</b></div>
          </div>
          <div class="pricing-card-foot">
            ${!isPremium ? `<div class="pricing-badge current">Plan actual</div>` : `<div class="pricing-badge inactive">Anterior plan</div>`}
          </div>
        </div>

        <div class="pricing-card pricing-premium">
          <div class="pricing-card-head">
            <div class="pricing-icon premium-icon">${icon('crown', 36)}</div>
            <div class="pricing-plan-name premium-name">Premium</div>
            <div class="pricing-price">—</div>
            <div class="pricing-price-label">sin l&iacute;mites</div>
          </div>
          <div class="pricing-features">
            <div class="pricing-feature-title">Todo lo de Free +</div>
            <div class="pricing-feat">${icon('check', 16)} Esc&aacute;ner IA <b>ilimitado</b></div>
            <div class="pricing-feat">${icon('check', 16)} Coach IA <b>ilimitado</b></div>
            <div class="pricing-feat">${icon('check', 16)} Rutinas IA <b>ilimitadas</b></div>
            <div class="pricing-feat">${icon('check', 16)} Repaso semanal con IA</div>
            <div class="pricing-feat">${icon('check', 16)} Prioridad en nuevas funciones</div>
            <div class="pricing-feat">${icon('check', 16)} Sin anuncios</div>
            <div class="pricing-feat-title" style="margin-top:12px">Estado actual:</div>
            <div class="pricing-feat limit">${icon('zap', 14)} Usos IA: <b>Ilimitados</b></div>
            <div class="pricing-feat limit">${icon('zap', 14)} Funciones: <b>Todas</b></div>
          </div>
          <div class="pricing-card-foot">
            ${isPremium
              ? `<div class="pricing-badge premium-current">${icon('crown', 14)} Plan activo</div>`
              : `<button class="btn btn-primary btn-premium" id="pricing-upgrade">${icon('crown', 16)} Conseguir Premium</button>`}
          </div>
        </div>
      </div>

      <div class="pricing-footer-note">
        ${icon('info', 14)} Premium es un modo de apoyo al proyecto. No hay suscripciones ni pagos recurrentes — es una activaci&oacute;n &uacute;nica vinculada a tu cuenta.
      </div>
    </div>
  `;

  bind(root, { navigate });
}

function bind(root, { navigate }) {
  root.querySelector("#pricing-upgrade")?.addEventListener("click", async () => {
    const btn = root.querySelector("#pricing-upgrade");
    btn.disabled = true;
    btn.textContent = "Redirigiendo...";

    try {
      const res = await fetch("/api/create-premium-checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.error) {
        toast(data.error);
        btn.disabled = false;
        btn.innerHTML = `${icon('crown', 16)} Conseguir Premium`;
        return;
      }
    } catch (e) {
      console.warn("LS checkout falló, modo local:", e);
    }

    // fallback: si no hay servidor o falla, activa premium local
    store.setPremium(true);
    toast("\u{1F389} \u{A1}Ya eres Premium! Todos los l\u00EDmites eliminados.");
    navigate("pricing");
  });
}
