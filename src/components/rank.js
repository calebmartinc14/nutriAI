import { store } from "../store.js";
import { TIERS, rankedExercises, rankExercise, overallRank } from "../lib/ranking.js";
import { icon } from "../lib/icons.js";

export function renderRank(root, { navigate }) {
  const profile = store.profile();
  const bodyweight = store.weights().at(-1)?.kg ?? profile?.weight ?? 0;
  const sex = profile?.sex ?? "male";

  const perExercise = rankedExercises().map((ex) => {
    const oneRM = store.bestOneRM(ex);
    return oneRM > 0 ? rankExercise(ex, oneRM, bodyweight, sex) : { exercise: ex, empty: true };
  });

  const ranked = perExercise.filter((r) => r && !r.empty);
  const overall = overallRank(ranked);

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Tu rango de fuerza</h2>
      <p class="page-sub">Basado en tu fuerza relativa (peso levantado vs tu peso corporal: ${bodyweight || "?"} kg). Estimación orientativa.</p>
    </div>

    ${
      overall
        ? heroCard(overall)
        : `<div class="card rank-empty">
            <div class="rank-empty-emoji">${icon('dumbbell', 56)}</div>
            <h3>Aún no tienes rango</h3>
            <p>Registra el peso que levantas en la pestaña <b>Entreno</b> y aquí verás tu nivel de Bronce a Leyenda.</p>
            <button class="btn btn-primary" id="go-train">Ir a Entreno</button>
          </div>`
    }

    ${
      ranked.length || perExercise.some((r) => r.empty)
        ? `<div class="section-title" style="margin-top:24px">Por ejercicio</div>
           <div class="rank-list">${perExercise.map(rankRow).join("")}</div>
           <div class="card tiers-legend">
             ${TIERS.map((t) => `<span class="tier-chip" style="--tc:${t.color}">${icon(t.icon, 14)} ${t.label}</span>`).join("")}
           </div>`
        : ""
    }
  `;

  root.querySelector("#go-train")?.addEventListener("click", () => navigate("workout"));
}

function heroCard(o) {
  const t = o.tier;
  return `
    <div class="card rank-hero" style="--tc:${t.color}">
      <div class="rank-emblem">${icon(t.icon, 64)}</div>
      <div class="rank-hero-info">
        <div class="rank-hero-label">${t.label}</div>
        <div class="rank-hero-sub">Rango global · media de ${o.count} ejercicio(s)</div>
        <div class="rank-progress-track"><div class="rank-progress-fill" style="width:${Math.round((o.avg / (TIERS.length - 1)) * 100)}%"></div></div>
      </div>
    </div>`;
}

function rankRow(r) {
  if (r.empty) {
    return `<div class="card rank-row empty">
      <span class="rr-ex">${r.exercise}</span>
      <span class="rr-empty">Sin registros — regístralo en Entreno</span>
    </div>`;
  }
  const t = r.tier;
  return `
    <div class="card rank-row" style="--tc:${t.color}">
      <div class="rr-top">
        <span class="rr-badge">${icon(t.icon, 14)} ${t.label}</span>
        <span class="rr-ex">${r.exercise}</span>
        <span class="rr-1rm">${r.oneRM} kg <small>1RM est.</small></span>
      </div>
      <div class="rank-progress-track"><div class="rank-progress-fill" style="width:${Math.round(r.progress * 100)}%"></div></div>
      <div class="rr-next">
        ${
          r.nextTier
            ? `Para <b style="color:${r.nextTier.color}">${r.nextTier.label}</b>: ${r.nextWeight} kg (1RM)`
            : `Rango maximo alcanzado! ${icon('flame', 14)}`
        }
      </div>
    </div>`;
}
