import { store, SLOTS, sumMacros } from "../store.js";
import { calorieRing, macroRing, animateRings } from "./rings.js";
import { openManualModal } from "./manual.js";
import { askCoach } from "../api.js";
import { toast } from "./ui.js";
import { t, slotLabel, dayLetters } from "../lib/i18n.js";

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

  const days = dayLetters();
  const diff = goals.calories - (goals.maintenance ?? goals.calories);
  const diffText = diff === 0 ? t("dash.maintword") : diff > 0 ? `+${diff}` : `${diff}`;

  root.innerHTML = `
    <div class="dash-hero">
      <div class="card rings-card">
        ${calorieRing(consumed.calories, goals.calories)}
        <div class="macro-rings">
          ${macroRing(t("macro.protein"), consumed.protein, goals.protein, "protein")}
          ${macroRing(t("macro.carbs.short"), consumed.carbs, goals.carbs, "carbs")}
          ${macroRing(t("macro.fat"), consumed.fat, goals.fat, "fat")}
        </div>
      </div>

      <div class="dash-side">
        <div class="card summary-card">
          <div class="section-title">${t("dash.plan")}</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="si-val">${goals.maintenance ?? goals.calories}</div>
              <div class="si-label">${t("dash.maintenance")}</div>
            </div>
            <div class="summary-item">
              <div class="si-val accent">${goals.calories}</div>
              <div class="si-label">${t("dash.goalKcal")} · ${diffText}</div>
            </div>
          </div>
          <div class="summary-goal">
            <span>${t("dash.goalLabel")}: <b>${profile?.goal ? t("goal." + profile.goal) : "—"}</b></span>
            <span>${t("dash.macros")}: <b>P ${goals.protein} · C ${goals.carbs} · G ${goals.fat}</b></span>
          </div>
        </div>

        <div class="card week-card">
          <div class="section-title">${t("dash.week")}</div>
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

        ${waterCard()}
      </div>
    </div>

    <div class="meals-title-row">
      <span class="meals-title">${t("dash.mealsToday")}</span>
      <button class="wk-toggle-def" id="repeat-yesterday">${t("dash.repeatYesterday")}</button>
    </div>
    <div class="meals-grid">
      ${SLOTS.map((slot) => renderSlot(slot, mealsBySlot[slot.id])).join("")}
    </div>

    ${progressCard()}
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

  root.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const m = store.meals().find((x) => x.id === btn.dataset.edit);
      if (m) openManualModal(m.slot, refresh, m, m.id);
    })
  );

  root.querySelector("#repeat-yesterday")?.addEventListener("click", () => {
    const n = store.repeatYesterday();
    if (!n) return toast(t("dash.noYesterday"));
    toast(t("dash.copiedYesterday", { n }));
    refresh();
  });

  root.querySelectorAll("[data-water]").forEach((btn) =>
    btn.addEventListener("click", () => { store.addWater(Number(btn.dataset.water)); refresh(); })
  );

  root.querySelector("#weekly-review")?.addEventListener("click", openWeeklyReview);
}

// Repaso semanal con IA: calcula tus stats y pide un resumen al coach.
async function openWeeklyReview() {
  const goals = store.goals();
  const weekly = store.weeklyCalories();
  const logged = weekly.filter((v) => v > 0);
  const avgCal = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const weights = store.weights();
  const wChange = weights.length >= 2 ? +(weights.at(-1).kg - weights[0].kg).toFixed(1) : 0;
  const sessions = store.sessionsThisWeek();
  const streak = store.nutritionStreak();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal"><div class="rec-detail-head"><h3>${t("wr.title")}</h3><button class="ex-close" id="wr-x">✕</button></div><div id="wr-body"><div class="spinner" style="margin:24px auto"></div></div></div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector("#wr-x").addEventListener("click", () => backdrop.remove());

  const msg = t("wr.prompt", {
    avg: avgCal, goal: goals.calories, sessions, streak,
    wchange: `${wChange >= 0 ? "+" : ""}${wChange}`,
  });

  try {
    const reply = await askCoach([{ role: "user", content: msg }], { consumed: { calories: avgCal }, target: goals });
    backdrop.querySelector("#wr-body").innerHTML = `
      <div class="wr-stats">
        <div><b>${avgCal}</b><span>${t("wr.kcalday")}</span></div>
        <div><b>${sessions}</b><span>${t("wr.trainings")}</span></div>
        <div><b>${streak}</b><span>${t("wr.streak")}</span></div>
        <div><b>${wChange >= 0 ? "+" : ""}${wChange}</b><span>${t("unit.kg")}</span></div>
      </div>
      <p class="wr-text">${escapeHtml(reply)}</p>`;
  } catch {
    backdrop.querySelector("#wr-body").innerHTML = `<p class="hist-note">${t("wr.error")}</p>`;
  }
}

function renderSlot(slot, meals) {
  const total = Math.round(meals.reduce((a, m) => a + (m.calories || 0), 0));
  return `
    <div class="card meal-card">
      <div class="meal-head">
        <span class="meal-ico">${slot.ico}</span>
        <span class="meal-slot">${slotLabel(slot.id)}</span>
        <span class="meal-kcal">${total} kcal</span>
        <button class="meal-add" data-add-slot="${slot.id}" title="${t("dash.addManual")}">＋</button>
      </div>
      ${
        meals.length === 0
          ? `<div class="meal-empty">${t("dash.slotEmpty")}</div>`
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
      <button class="meal-edit" data-edit="${m.id}" title="${t("manual.editTitle")}">✎</button>
      <button class="meal-del" data-del="${m.id}" title="${t("common.delete")}">✕</button>
    </div>`;
}

function waterCard() {
  const ml = store.water();
  const goal = store.waterGoal();
  const pct = Math.min(100, Math.round((ml / goal) * 100));
  return `
    <div class="card water-card">
      <div class="water-head"><span class="section-title" style="margin:0">${t("dash.water")}</span><span class="water-val">${ml} / ${goal} ml</span></div>
      <div class="water-bar"><div class="water-fill" style="width:${pct}%"></div></div>
      <div class="water-btns">
        <button data-water="250">+250</button>
        <button data-water="500">+500</button>
        <button data-water="-250">−250</button>
      </div>
    </div>`;
}

function progressCard() {
  const streak = store.nutritionStreak();
  const badges = store.achievements();
  const earned = badges.filter((a) => a.earned).length;
  const daysWord = streak === 1 ? t("common.day") : t("common.days");
  return `
    <div class="section-title" style="margin-top:28px">${t("dash.progress")}</div>
    <div class="card prog-card">
      <div class="prog-row">
        <div class="prog-streak">🔥 <b>${streak}</b> <span>${t("dash.streak", { n: "", days: daysWord }).trim()}</span></div>
        <button class="btn btn-ghost prog-review" id="weekly-review">${t("dash.weeklyReview")}</button>
      </div>
      <div class="badges-title">${t("dash.achievements", { earned, total: badges.length })}</div>
      <div class="badges">
        ${badges.map((a) => `<span class="badge-chip ${a.earned ? "earned" : ""}" title="${t("ach." + a.id)}">${a.icon}</span>`).join("")}
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
