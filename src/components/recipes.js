import { store, SLOTS } from "../store.js";
import { RECIPES, COMIDA_PCT, COMIDA_SLOT, escalarReceta, totalesPlan } from "../lib/recipes.js";
import { estimateFood } from "../api.js";
import { escapeHtml, toast } from "./ui.js";
import { t, slotLabel } from "../lib/i18n.js";
import { icon } from "../lib/icons.js";

export function renderRecipes(root) {
  const mine = store.userRecipes();
  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">${t("rec.title")}</h2>
      <p class="page-sub">${t("rec.subtitle")}</p>
    </div>

    <div class="section-title" style="margin-top:4px; display:flex; justify-content:space-between; align-items:center">
      <span>${t("rec.mine")}</span>
      <button class="wk-toggle-def" id="new-user-rec">${icon('plus', 14)} ${t("rec.create")}</button>
    </div>
    ${mine.length ? `<div class="rec-grid">${mine.map(userCard).join("")}</div>` : `<p class="hist-note">${t("rec.mineHint")}</p>`}

    <div class="section-title" style="margin-top:24px">${t("rec.suggested")}</div>
    <div class="rec-grid">
      ${RECIPES.map(card).join("")}
    </div>
    <div id="rec-detail"></div>
  `;
  root.querySelectorAll("[data-rec]").forEach((el) =>
    el.addEventListener("click", () => openRecipe(root, el.dataset.rec))
  );
  root.querySelectorAll("[data-userrec]").forEach((el) =>
    el.addEventListener("click", () => openUserRecipe(root, el.dataset.userrec))
  );
  root.querySelector("#new-user-rec").addEventListener("click", () => openRecipeCreator(root));
}

function userTotals(r) {
  return r.ingredients.reduce((a, i) => ({
    calories: a.calories + (+i.calories || 0), protein: a.protein + (+i.protein || 0),
    carbs: a.carbs + (+i.carbs || 0), fat: a.fat + (+i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function userCard(r) {
  const tt = userTotals(r);
  return `
    <div class="card rec-card" data-userrec="${r.id}">
      <div class="rec-emoji">${icon('book', 30)}</div>
      <div class="rec-info">
        <div class="rec-title">${escapeHtml(r.name)}</div>
        <div class="rec-meal">${Math.round(tt.calories)} kcal · ${r.ingredients.length} ${t("rec.ingr")}</div>
      </div>
    </div>`;
}

function openUserRecipe(root, id) {
  const r = store.userRecipes().find((x) => x.id === id);
  if (!r) return;
  let pct = 30;
  const detail = root.querySelector("#rec-detail");

  function drawUser() {
    const goals = store.goals();
    const objetivo = { p: (goals.protein * pct) / 100, c: (goals.carbs * pct) / 100, f: (goals.fat * pct) / 100 };
    const scale = (tt, target) => target > 0 ? Math.min(tt / target, 3) : 1;
    const s = scale(userTotals(r).calories, objetivo.p * 4 + objetivo.c * 4 + objetivo.f * 9);
    const scaled = { calories: Math.round(userTotals(r).calories / s), protein: Math.round(userTotals(r).protein / s), carbs: Math.round(userTotals(r).carbs / s), fat: Math.round(userTotals(r).fat / s) };
    const tt = scaled;

    detail.innerHTML = `
      <div class="card rec-detail-card">
        <div class="rec-detail-head"><span>${icon('book', 18)} <b>${escapeHtml(r.name)}</b></span><button class="ex-close" id="ur-x">${icon('x', 18)}</button></div>

        <label class="rec-pct-label">${t("rec.pct", { pct: `<b>${pct.toFixed(2)}%</b>` })}</label>
        <input id="ur-pct" type="range" min="10" max="60" step="any" value="${pct}" class="rec-range" />

        <div class="rec-target">${t("rec.target")}: ${Math.round(objetivo.p)}P · ${Math.round(objetivo.c)}C · ${Math.round(objetivo.f)}G</div>

        <div class="section-title" style="margin-top:8px">${t("rec.ingredients")}</div>
        <div class="rec-ings">
          ${r.ingredients.map((i) => `<div class="rec-ing"><span>${escapeHtml(i.name)} · ${i.grams} g</span><b>${Math.round(i.calories)} kcal</b></div>`).join("")}
        </div>
        <div class="rec-totals">≈ ${Math.round(tt.calories)} kcal · ${Math.round(tt.protein)}P · ${Math.round(tt.carbs)}C · ${Math.round(tt.fat)}G</div>
        <div class="rec-addrow">
          <select id="ur-slot" class="prod-slot">${SLOTS.map((s) => `<option value="${s.id}">${slotLabel(s.id)}</option>`).join("")}</select>
          <button class="btn btn-primary" id="ur-add">${t("rec.addDiary")}</button>
          <button class="btn btn-ghost-danger" id="ur-del">${t("common.delete")}</button>
        </div>
      </div>`;

    detail.querySelector("#ur-x").addEventListener("click", () => (detail.innerHTML = ""));
    const rangeEl = detail.querySelector("#ur-pct");
    rangeEl.addEventListener("input", (e) => { pct = Number(e.target.value); drawUser(); });
    rangeEl.addEventListener("pointerdown", (e) => {
      const rect = rangeEl.getBoundingClientRect();
      const onMove = (ev) => { pct = Math.min(60, Math.max(10, ((ev.clientX - rect.left) / rect.width) * 60)); drawUser(); };
      const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      pct = Math.min(60, Math.max(10, ((e.clientX - rect.left) / rect.width) * 60));
      drawUser();
    });
    detail.querySelector("#ur-add").addEventListener("click", () => {
      store.addMeal({ name: r.name, slot: detail.querySelector("#ur-slot").value, calories: Math.round(tt.calories), protein: Math.round(tt.protein), carbs: Math.round(tt.carbs), fat: Math.round(tt.fat), source: "recipe" });
      toast(t("rec.addedDiary"));
      detail.innerHTML = "";
    });
    detail.querySelector("#ur-del").addEventListener("click", () => {
      store.deleteUserRecipe(r.id);
      toast(t("rec.deleted"));
      renderRecipes(root);
    });
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  drawUser();
}

// Creador de receta propia: ingredientes con gramos + macros (a mano o con IA).
function openRecipeCreator(root) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  let rows = [{ name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" }];

  const rowHtml = (r, i) => `
    <div class="ing-row" data-i="${i}">
      <input class="ing-name" placeholder="${t("rec.ingFood")}" value="${attr(r.name)}" />
      <input class="ing-g" type="number" inputmode="numeric" placeholder="g" value="${attr(r.grams)}" />
      <input class="ing-kcal" type="number" inputmode="numeric" placeholder="kcal" value="${attr(r.calories)}" />
      <input class="ing-p" type="number" inputmode="numeric" placeholder="P" value="${attr(r.protein)}" />
      <input class="ing-c" type="number" inputmode="numeric" placeholder="C" value="${attr(r.carbs)}" />
      <input class="ing-f" type="number" inputmode="numeric" placeholder="G" value="${attr(r.fat)}" />
      <button class="ing-ai" data-ai="${i}" title="${t("rec.aiTitle")}">${icon('sparkles', 14)}</button>
      <button class="ing-rm" data-rm="${i}" title="${t("rec.remove")}">${icon('x', 14)}</button>
    </div>`;

  const draw = () => {
    backdrop.innerHTML = `
      <div class="modal rec-creator">
        <div class="rec-detail-head"><h3>${t("rec.newRecipe")}</h3><button class="ex-close" id="rc-x">${icon('x', 18)}</button></div>
        <div class="field"><label>${t("rec.name")}</label><input id="rc-name" type="text" placeholder="${t("rec.namePlaceholder")}" /></div>
        <div class="ing-head"><span>${t("rec.ingredients")}</span>        <small>gramos + macros (${icon('sparkles', 12)} = calcular con IA)</small></div>
        <div id="ing-list">${rows.map(rowHtml).join("")}</div>
        <button class="wk-add-ex" id="rc-adding">${icon('plus', 14)} ${t("rec.addIngredient")}</button>
        <div class="rec-totals" id="rc-tot"></div>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-ghost" id="rc-cancel">${t("common.cancel")}</button>
          <button class="btn btn-primary" id="rc-save" style="flex:1">${t("rec.save")}</button>
        </div>
      </div>`;
    const nameEl = backdrop.querySelector("#rc-name");
    if (draw._name) nameEl.value = draw._name;
    updateTotals();

    backdrop.querySelector("#rc-x").addEventListener("click", () => backdrop.remove());
    backdrop.querySelector("#rc-cancel").addEventListener("click", () => backdrop.remove());
    nameEl.addEventListener("input", () => { draw._name = nameEl.value; });

    backdrop.querySelectorAll(".ing-row").forEach((row) => {
      const i = Number(row.dataset.i);
      const read = () => { rows[i] = {
        name: row.querySelector(".ing-name").value, grams: row.querySelector(".ing-g").value,
        calories: row.querySelector(".ing-kcal").value, protein: row.querySelector(".ing-p").value,
        carbs: row.querySelector(".ing-c").value, fat: row.querySelector(".ing-f").value }; };
      row.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => { read(); updateTotals(); }));
      row.querySelector("[data-rm]").addEventListener("click", () => { read(); rows.splice(i, 1); if (!rows.length) rows.push({ name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" }); draw(); });
      row.querySelector("[data-ai]").addEventListener("click", async () => {
        read();
        const r = rows[i];
        if (!r.name || !(Number(r.grams) > 0)) return toast(t("rec.needFoodGrams"));
        const btn = row.querySelector("[data-ai]");
        btn.textContent = "..."; btn.disabled = true;
        try {
          const m = await estimateFood(r.name, Number(r.grams));
          rows[i] = { ...r, calories: Math.round(m.calories), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
          draw();
        } catch { toast(t("rec.aiError")); btn.innerHTML = `${icon('sparkles', 14)}`; btn.disabled = false; }
      });
    });

    backdrop.querySelector("#rc-adding").addEventListener("click", () => { rows.push({ name: "", grams: "", calories: "", protein: "", carbs: "", fat: "" }); draw(); });
    backdrop.querySelector("#rc-save").addEventListener("click", save);
  };

  function updateTotals() {
    const tot = rows.reduce((a, r) => ({ c: a.c + (+r.calories || 0), p: a.p + (+r.protein || 0), ca: a.ca + (+r.carbs || 0), f: a.f + (+r.fat || 0) }), { c: 0, p: 0, ca: 0, f: 0 });
    const el = backdrop.querySelector("#rc-tot");
    if (el) el.textContent = `Total ≈ ${Math.round(tot.c)} kcal · ${Math.round(tot.p)}P · ${Math.round(tot.ca)}C · ${Math.round(tot.f)}G`;
  }

  function save() {
    const name = (draw._name || backdrop.querySelector("#rc-name").value).trim();
    if (!name) return toast(t("rec.needName"));
    const ingredients = rows
      .filter((r) => r.name && r.name.trim())
      .map((r) => ({ name: r.name.trim(), grams: Number(r.grams) || 0, calories: Number(r.calories) || 0, protein: Number(r.protein) || 0, carbs: Number(r.carbs) || 0, fat: Number(r.fat) || 0 }));
    if (!ingredients.length) return toast(t("rec.needIngredient"));
    store.addUserRecipe({ name, ingredients });
    backdrop.remove();
    toast(t("rec.saved"));
    renderRecipes(root);
  }

  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  draw();
}

function attr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

function card(r) {
  return `
    <div class="card rec-card" data-rec="${r.id}">
      <div class="rec-emoji">${icon(r.icon, 30)}</div>
      <div class="rec-info">
        <div class="rec-title">${escapeHtml(r.titulo)}</div>
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
          <span>${icon(r.icon, 18)} <b>${escapeHtml(r.titulo)}</b></span>
          <button class="ex-close" id="rec-x">${icon('x', 18)}</button>
        </div>

        <label class="rec-pct-label">${t("rec.pct", { pct: `<b>${pct.toFixed(2)}%</b>` })}</label>
        <input id="rec-pct" type="range" min="10" max="60" step="any" value="${pct}" class="rec-range" />

        <div class="rec-target">${t("rec.target")}: ${Math.round(objetivo.p)}P · ${Math.round(objetivo.c)}C · ${Math.round(objetivo.f)}G</div>

        <div class="section-title" style="margin-top:14px">${t("rec.ingAdjusted")}</div>
        <div class="rec-ings">
          ${plan.map((it) => `<div class="rec-ing"><span>${escapeHtml(it.nombre)}</span><b>${it.gramos} g</b></div>`).join("")}
        </div>

        <div class="rec-totals">
          ≈ ${Math.round(tot.calories)} kcal · ${Math.round(tot.protein)}P · ${Math.round(tot.carbs)}C · ${Math.round(tot.fat)}G
        </div>

        <div class="section-title" style="margin-top:14px">${t("rec.steps")}</div>
        <ol class="rec-steps">${r.pasos.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ol>

        <button class="btn btn-primary btn-block" id="rec-add">${t("rec.addDiary")} (${cap(r.comida)})</button>
      </div>`;

    detail.querySelector("#rec-x").addEventListener("click", () => (detail.innerHTML = ""));
    const rangeEl = detail.querySelector("#rec-pct");
    rangeEl.addEventListener("input", (e) => { pct = Number(e.target.value); draw(); });
    rangeEl.addEventListener("pointerdown", (e) => {
      const rect = rangeEl.getBoundingClientRect();
      const onMove = (ev) => { pct = Math.min(60, Math.max(10, ((ev.clientX - rect.left) / rect.width) * 60)); draw(); };
      const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      pct = Math.min(60, Math.max(10, ((e.clientX - rect.left) / rect.width) * 60));
      draw();
    });
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
      toast(t("rec.addedDiary"));
      detail.innerHTML = "";
    });
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  draw();
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

