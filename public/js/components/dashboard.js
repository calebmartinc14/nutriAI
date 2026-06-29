import { store, SLOTS, sumMacros } from "../store.js";
import { calorieRing, macroRing, animateRings } from "./rings.js";
import { openManualModal } from "./manual.js";

const GOAL_LABELS = { lose: "Perder grasa", maintain: "Mantener", gain: "Ganar músculo" };

export function renderDashboard(root, { navigate, refresh }) {
  const goals = store.goals();
  const profile = store.profile();
  const meals = store.meals();
  const consumed = sumMacros(meals);
  const weekly = store.weeklyCalories();
  const todayIdx = store.todayIndex();
  const maxWeek = Math.max(goals.calories, ...weekly, 1);

  const mealsBySlot = Object.fromEntries(SLOTS.map((s) => [s.id, []]));
  meals.forEach((m) => mealsBySlot[m.slot]?.push(m));

  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const diff = goals.calories - (goals.maintenance ?? goals.calories);
  const diffText = diff === 0 ? "Mantenimiento" : diff > 0 ? `+${diff}` : `${diff}`;

  root.innerHTML = `
    <div class="dash-hero">
      <div class="card rings-card">
        ${calorieRing(consumed.calories, goals.calories)}
        <div class="macro-rings">
          ${macroRing("Proteínas", consumed.protein, goals.protein, "protein")}
          ${macroRing("Carbos", consumed.carbs, goals.carbs, "carbs")}
          ${macroRing("Grasas", consumed.fat, goals.fat, "fat")}
        </div>
      </div>

      <div class="dash-side">
        <div class="card summary-card">
          <div class="section-title">Tu plan</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="si-val">${goals.maintenance ?? goals.calories}</div>
              <div class="si-label">Mantenimiento (kcal)</div>
            </div>
            <div class="summary-item">
              <div class="si-val accent">${goals.calories}</div>
              <div class="si-label">Objetivo (kcal) · ${diffText}</div>
            </div>
          </div>
          <div class="summary-goal">
            <span>Meta: <b>${GOAL_LABELS[profile?.goal] ?? "—"}</b></span>
            <span>Macros: <b>P ${goals.protein} · C ${goals.carbs} · G ${goals.fat}</b></span>
          </div>
        </div>

        <div class="card week-card">
          <div class="section-title">Esta semana</div>
          <div class="bars">
            ${weekly
              .map((v, i) => {
                const h = Math.round((v / maxWeek) * 90);
                const over = v > goals.calories;
                const cls = ["bar", i === todayIdx ? "today" : "", over ? "over" : ""].join(" ");
                return `<div class="bar-col ${i === todayIdx ? "today" : ""}">
                  <div class="${cls}" style="height:0" data-h="${h}"></div>
                  <div class="bar-day">${days[i]}</div>
                </div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    </div>

    <div class="meals-title">Comidas de hoy</div>
    <div class="meals-grid">
      ${SLOTS.map((slot) => renderSlot(slot, mealsBySlot[slot.id])).join("")}
    </div>
  `;

  animateRings(root);
  requestAnimationFrame(() => {
    root.querySelectorAll(".bar").forEach((b) => (b.style.height = b.dataset.h + "px"));
  });

  root.querySelectorAll("[data-add-slot]").forEach((btn) =>
    btn.addEventListener("click", () => openManualModal(btn.dataset.addSlot, () => refresh()))
  );
  root.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => {
      store.deleteMeal(btn.dataset.del);
      refresh();
    })
  );
}

function renderSlot(slot, meals) {
  const total = Math.round(meals.reduce((a, m) => a + (m.calories || 0), 0));
  return `
    <div class="card meal-card">
      <div class="meal-head">
        <span class="meal-ico">${slot.ico}</span>
        <span class="meal-slot">${slot.label}</span>
        <span class="meal-kcal">${total} kcal</span>
        <button class="meal-add" data-add-slot="${slot.id}" title="Añadir manual">＋</button>
      </div>
      ${
        meals.length === 0
          ? `<div class="meal-empty">Sin registros — toca ＋ o escanea un plato</div>`
          : meals.map(renderMeal).join("")
      }
    </div>`;
}

function renderMeal(m) {
  const thumb = m.photo
    ? `<img class="meal-thumb" src="${m.photo}" alt="">`
    : `<div class="meal-thumb">🍴</div>`;
  const aiTag = m.source === "ai" ? `<span class="tag-ai">IA</span>` : "";
  return `
    <div class="meal-item">
      ${thumb}
      <div class="meal-info">
        <div class="meal-name"><span class="txt">${escapeHtml(m.name)}</span>${aiTag}</div>
        <div class="meal-macros">P ${Math.round(m.protein)}g · C ${Math.round(m.carbs)}g · G ${Math.round(m.fat)}g</div>
      </div>
      <div class="meal-item-kcal">${Math.round(m.calories)}</div>
      <button class="meal-del" data-del="${m.id}" title="Borrar">✕</button>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
