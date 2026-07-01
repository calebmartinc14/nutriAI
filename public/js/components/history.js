import { store, SLOTS, sumMacros } from "../store.js";
import { toast } from "./ui.js";
import { t, getLocale, dayLetters } from "../lib/i18n.js";

let weekOffset = 0; // 0 = semana actual, -1 = semana pasada, ...

export function resetHistoryWeek() {
  weekOffset = 0;
}

export function renderHistory(root, ctx) {
  draw(root, ctx);
}

function draw(root, ctx) {
  const monday = mondayOf(weekOffset);
  const week = buildWeek(monday); // [{dateKey, dateObj, meals, totals}] x7
  const goals = store.goals();
  const daysWithData = week.filter((d) => d.meals.length > 0);
  const n = daysWithData.length || 1;

  // Promedios sobre los dias registrados.
  const sum = week.reduce(
    (a, d) => ({
      calories: a.calories + d.totals.calories,
      protein: a.protein + d.totals.protein,
      carbs: a.carbs + d.totals.carbs,
      fat: a.fat + d.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const avg = {
    calories: Math.round(sum.calories / n),
    protein: Math.round(sum.protein / n),
    carbs: Math.round(sum.carbs / n),
    fat: Math.round(sum.fat / n),
  };
  const maxBar = Math.max(goals.calories, ...week.map((d) => d.totals.calories), 1);
  const days = dayLetters();
  const isCurrentWeek = weekOffset === 0;

  root.innerHTML = `
    <div class="hist-head">
      <button class="hist-nav" id="prev-week" title="${t("hist.prevWeek")}">‹</button>
      <div class="hist-range">
        <div class="hist-range-title">${rangeLabel(monday)}</div>
        <div class="hist-range-sub">${isCurrentWeek ? t("hist.currentWeek") : ""}</div>
      </div>
      <button class="hist-nav" id="next-week" title="${t("hist.nextWeek")}" ${isCurrentWeek ? "disabled" : ""}>›</button>
    </div>

    <div class="card week-card">
      <div class="bars">
        ${week
          .map((d, i) => {
            const h = Math.round((d.totals.calories / maxBar) * 90);
            const over = d.totals.calories > goals.calories;
            const today = isCurrentWeek && i === store.todayIndex();
            const cls = ["bar", today ? "today" : "", over ? "over" : ""].join(" ");
            return `<div class="bar-col ${today ? "today" : ""}">
              <div class="bar-val">${d.totals.calories ? Math.round(d.totals.calories) : ""}</div>
              <div class="${cls}" style="height:0" data-h="${h}"></div>
              <div class="bar-day">${days[i]}</div>
            </div>`;
          })
          .join("")}
      </div>
    </div>

    <div class="hist-stats">
      ${stat(t("hist.dailyAvg"), `${avg.calories}`, "kcal", "var(--cal)")}
      ${stat(t("macro.protein"), `${avg.protein}`, t("macro.perday"), "var(--protein)")}
      ${stat(t("macro.carbs.short"), `${avg.carbs}`, t("macro.perday"), "var(--carbs)")}
      ${stat(t("macro.fat"), `${avg.fat}`, t("macro.perday"), "var(--fat)")}
    </div>
    <p class="hist-note">${t("hist.avgNote", { n: daysWithData.length, total: Math.round(sum.calories), goal: goals.calories })}</p>

    <div class="section-title" style="margin-top:24px">${t("hist.dayByDay")}</div>
    <div class="hist-days">
      ${week.map((d, i) => dayRow(d, days[i])).join("")}
    </div>

    <div class="section-title" style="margin-top:28px">${t("hist.backup")}</div>
    <div class="card backup-card">
      <p>${t("hist.backupText")}</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="export-btn">${icon('download', 14)} ${t("hist.export")}</button>
        <button class="btn btn-ghost" id="import-btn">${icon('upload', 14)} ${t("hist.import")}</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      </div>
    </div>
  `;

  // Animacion de barras
  requestAnimationFrame(() => {
    root.querySelectorAll(".bar").forEach((b) => (b.style.height = b.dataset.h + "px"));
  });

  // Navegacion de semanas
  root.querySelector("#prev-week").addEventListener("click", () => {
    weekOffset -= 1;
    draw(root, ctx);
  });
  root.querySelector("#next-week").addEventListener("click", () => {
    if (weekOffset < 0) {
      weekOffset += 1;
      draw(root, ctx);
    }
  });

  // Expandir un dia para ver sus comidas
  root.querySelectorAll("[data-day-toggle]").forEach((el) =>
    el.addEventListener("click", () => {
      const panel = root.querySelector(`[data-day-meals="${el.dataset.dayToggle}"]`);
      if (panel) panel.classList.toggle("hidden");
    })
  );

  // Exportar
  root.querySelector("#export-btn").addEventListener("click", () => {
    const data = store.exportData();
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nutveo-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t("hist.downloaded"));
  });

  // Importar
  const fileInput = root.querySelector("#import-file");
  root.querySelector("#import-btn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importData(JSON.parse(text));
      toast(t("hist.imported"));
      draw(root, ctx);
    } catch {
      toast(t("hist.fileError"));
    }
  });
}

// ---- Helpers de presentacion ----
function stat(label, value, unit, color) {
  return `<div class="card stat-card">
    <div class="stat-val" style="color:${color}">${value}</div>
    <div class="stat-unit">${unit}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function dayRow(d, dayLetter) {
  const has = d.meals.length > 0;
  const dateStr = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short" }).format(d.dateObj);
  const head = `
    <div class="day-head" data-day-toggle="${d.dateKey}">
      <span class="day-letter">${dayLetter}</span>
      <span class="day-date">${dateStr}</span>
      ${
        has
          ? `<span class="day-macros">P ${Math.round(d.totals.protein)} · C ${Math.round(d.totals.carbs)} · G ${Math.round(d.totals.fat)}</span>
             <span class="day-kcal">${Math.round(d.totals.calories)} kcal</span>
             <span class="day-caret">${icon('chevron-down', 12)}</span>`
          : `<span class="day-empty">${t("hist.noRecords")}</span>`
      }
    </div>`;

  const meals = has
    ? `<div class="day-meals hidden" data-day-meals="${d.dateKey}">
        ${d.meals
          .map(
            (m) => `<div class="day-meal">
              <span class="dm-slot">${icon(SLOTS.find((s) => s.id === m.slot)?.ico ?? 'utensils', 15)}</span>
              <span class="dm-name">${escapeHtml(m.name)}</span>
              <span class="dm-kcal">${Math.round(m.calories)} kcal</span>
            </div>`
          )
          .join("")}
      </div>`
    : "";

  return `<div class="card day-card ${has ? "has-data" : "no-data"}">${head}${meals}</div>`;
}

// ---- Helpers de fecha (LOCAL, no UTC, para evitar el desfase de 1 día) ----
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(offset) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = lunes
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day + offset * 7);
  return monday;
}

function buildWeek(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const dateObj = new Date(monday);
    dateObj.setDate(monday.getDate() + i);
    const dateKey = todayKey(dateObj);
    const meals = store.mealsOn(dateKey);
    return { dateKey, dateObj, meals, totals: sumMacros(meals) };
  });
}

function rangeLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short" }).format(d);
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
