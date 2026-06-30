import { store } from "../store.js";
import { RECIPES, COMIDA_PCT, COMIDA_SLOT, escalarReceta, totalesPlan } from "../lib/recipes.js";
import { toast } from "./ui.js";

export function renderRecipes(root) {
  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Recetas</h2>
      <p class="page-sub">Las cantidades se ajustan a tus macros objetivo para cada comida.</p>
    </div>
    <div class="rec-grid">
      ${RECIPES.map(card).join("")}
    </div>
    <div id="rec-detail"></div>
  `;
  root.querySelectorAll("[data-rec]").forEach((el) =>
    el.addEventListener("click", () => openRecipe(root, el.dataset.rec))
  );
}

function card(r) {
  return `
    <div class="card rec-card" data-rec="${r.id}">
      <div class="rec-emoji">${r.emoji}</div>
      <div class="rec-info">
        <div class="rec-title">${esc(r.titulo)}</div>
        <div class="rec-meal">${cap(r.comida)}</div>
      </div>
    </div>`;
}

function openRecipe(root, id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  let pct = Math.round((COMIDA_PCT[r.comida] ?? 0.3) * 100);

  const detail = root.querySelector("#rec-detail");

  function draw() {
    const goals = store.goals();
    const objetivo = { p: (goals.protein * pct) / 100, c: (goals.carbs * pct) / 100, f: (goals.fat * pct) / 100 };
    const plan = escalarReceta(r.ingredientes, objetivo);
    const tot = totalesPlan(plan);

    detail.innerHTML = `
      <div class="card rec-detail-card">
        <div class="rec-detail-head">
          <span>${r.emoji} <b>${esc(r.titulo)}</b></span>
          <button class="ex-close" id="rec-x">✕</button>
        </div>

        <label class="rec-pct-label">Esta comida = <b>${pct}%</b> de tus macros diarios</label>
        <input id="rec-pct" type="range" min="10" max="60" step="5" value="${pct}" class="rec-range" />

        <div class="rec-target">Objetivo: ${Math.round(objetivo.p)}P · ${Math.round(objetivo.c)}C · ${Math.round(objetivo.f)}G</div>

        <div class="section-title" style="margin-top:14px">Ingredientes (ajustados)</div>
        <div class="rec-ings">
          ${plan.map((it) => `<div class="rec-ing"><span>${esc(it.nombre)}</span><b>${it.gramos} g</b></div>`).join("")}
        </div>

        <div class="rec-totals">
          ≈ ${Math.round(tot.calories)} kcal · ${Math.round(tot.protein)}P · ${Math.round(tot.carbs)}C · ${Math.round(tot.fat)}G
        </div>

        <div class="section-title" style="margin-top:14px">Pasos</div>
        <ol class="rec-steps">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>

        <button class="btn btn-primary btn-block" id="rec-add">Añadir al diario (${cap(r.comida)})</button>
      </div>`;

    detail.querySelector("#rec-x").addEventListener("click", () => (detail.innerHTML = ""));
    detail.querySelector("#rec-pct").addEventListener("input", (e) => { pct = Number(e.target.value); draw(); });
    detail.querySelector("#rec-add").addEventListener("click", () => {
      store.addMeal({
        name: r.titulo,
        slot: COMIDA_SLOT[r.comida] ?? "lunch",
        calories: Math.round(tot.calories),
        protein: Math.round(tot.protein),
        carbs: Math.round(tot.carbs),
        fat: Math.round(tot.fat),
        source: "recipe",
      });
      toast("Receta añadida a tu diario ✅");
      detail.innerHTML = "";
    });
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  draw();
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
