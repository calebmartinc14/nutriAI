import { SLOTS } from "../store.js";
import { analyzeFood, fileToCompressedBase64 } from "../api.js";
import { store } from "../store.js";
import { openManualModal } from "./manual.js";
import { escapeHtml, toast, showLimitModal } from "./ui.js";
import { t, slotLabel } from "../lib/i18n.js";
import { icon } from "../lib/icons.js";

// Pantalla de escaner de comida por foto (IA). Uso ilimitado.
export function renderScanner(root, { navigate, refresh, params }) {
  let slot = params?.slot ?? "lunch";
  root.innerHTML = pickerView(slot);
  bindPicker(root, slot, { navigate, refresh });
}

function pickerView(slot) {
  return `
    <div class="scanner">
      <div class="scanner-ico">${icon('utensils', 64)}</div>
      <h2>${t("scan.title")}</h2>
      <p>${t("scan.subtitle")}</p>

      <div class="slot-picker">
        ${SLOTS.map(
          (s) => `<button class="slot-chip ${s.id === slot ? "active" : ""}" data-slot="${s.id}">${slotLabel(s.id)}</button>`
        ).join("")}
      </div>

      <textarea id="scan-desc" class="scan-desc" rows="2" placeholder="${t("scan.descPlaceholder")}"></textarea>

      <input id="file-camera" type="file" accept="image/*" capture="environment" class="hidden" />
      <input id="file-gallery" type="file" accept="image/*" class="hidden" />

      <button class="btn btn-primary btn-block" id="btn-camera">${icon('camera', 16)} ${t("scan.camera")}</button>
      <button class="btn btn-ghost btn-block" id="btn-gallery">${icon('image', 16)} ${t("scan.gallery")}</button>
    </div>`;
}

function bindPicker(root, slot, ctx) {
  root.querySelectorAll("[data-slot]").forEach((chip) =>
    chip.addEventListener("click", () => {
      slot = chip.dataset.slot;
      root.querySelectorAll(".slot-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    })
  );

  const camera = root.querySelector("#file-camera");
  const gallery = root.querySelector("#file-gallery");
  root.querySelector("#btn-camera").addEventListener("click", () => camera.click());
  root.querySelector("#btn-gallery").addEventListener("click", () => gallery.click());

  const onFile = (e) => {
    const file = e.target.files?.[0];
    const desc = root.querySelector("#scan-desc")?.value.trim() || "";
    if (file) handleFile(root, file, slot, ctx, desc);
  };
  camera.addEventListener("change", onFile);
  gallery.addEventListener("change", onFile);
}

async function handleFile(root, file, slot, ctx, desc = "") {
  let preview;
  try {
    preview = await fileToCompressedBase64(file);
  } catch {
    return toast(t("scan.readError"));
  }

  root.innerHTML = `
    <div class="scanner">
      <img class="preview" src="${preview.dataUrl}" alt="plato" />
      <p>${t("scan.analyzing")}</p>
      <div class="result-rows" aria-hidden="true">
        <div class="skeleton sk-line mid"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
        <div class="skeleton sk-line short"></div>
      </div>
      <div class="spinner"></div>
    </div>`;

  // Combina la descripción del usuario con el tramo para dar más contexto a la IA.
  const hint = [desc, t("scan.isMeal", { slot: slotLabel(slot) })].filter(Boolean).join(". ");

  if (!store.canUse("scan")) {
    root.innerHTML = noCreditsView(ctx);
    root.querySelector("#go-premium")?.addEventListener("click", () => {
      store.setPremium(true);
      toast("🎉 ¡Ya eres Premium! Todos los límites eliminados.");
      setTimeout(() => ctx.navigate("scanner", { slot }), 1200);
    });
    root.querySelector("#credits-back")?.addEventListener("click", () => ctx.navigate("dashboard"));
    return;
  }

  try {
    const analysis = await analyzeFood(preview.base64, hint);
    store.useCredit("scan");
    renderResult(root, { analysis, photo: preview.dataUrl, slot }, ctx);
  } catch (err) {
    renderError(root, err.message, ctx);
  }
}

function renderResult(root, { analysis, photo, slot }, ctx) {
  const a = analysis;
  root.innerHTML = `
    <div class="scanner">
      <img class="preview" src="${photo}" alt="plato" />
      <h2>${escapeHtml(a.dish_name)}</h2>
      <p class="confidence">${t("scan.confidence", { n: Math.round((a.confidence ?? 0.5) * 100) })}</p>
      <div class="result-rows">
        ${row(t("macro.calories"), `${Math.round(a.calories)} kcal`, "var(--cal)")}
        ${row(t("macro.protein"), `${Math.round(a.protein_g)} g`, "var(--protein)")}
        ${row(t("macro.carbs"), `${Math.round(a.carbs_g)} g`, "var(--carbs)")}
        ${row(t("macro.fat"), `${Math.round(a.fat_g)} g`, "var(--fat)")}
      </div>
      <button class="btn btn-primary btn-block" id="save">${t("scan.saveDiary")}</button>
      <button class="btn btn-ghost btn-block" id="edit">${t("scan.adjust")}</button>
      <button class="btn btn-ghost btn-block" id="retry">${t("scan.retryPhoto")}</button>
    </div>`;

  const meal = {
    name: a.dish_name,
    slot,
    calories: Math.round(a.calories),
    protein: Math.round(a.protein_g),
    carbs: Math.round(a.carbs_g),
    fat: Math.round(a.fat_g),
    photo,
    source: "ai",
  };

  root.querySelector("#save").addEventListener("click", () => {
    store.addMeal(meal);
    toast(t("common.saved"));
    ctx.navigate("dashboard");
  });
  root.querySelector("#edit").addEventListener("click", () => {
    openManualModal(slot, () => ctx.navigate("dashboard"), meal);
  });
  root.querySelector("#retry").addEventListener("click", () => ctx.navigate("scanner", { slot }));
}

function renderError(root, message, ctx) {
  root.innerHTML = `
    <div class="scanner">
      <div class="scanner-ico">${icon('alert-triangle', 64)}</div>
      <h2>${t("scan.oops")}</h2>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary btn-block" id="retry">${t("common.retry")}</button>
    </div>`;
  root.querySelector("#retry").addEventListener("click", () => ctx.navigate("scanner"));
}

const row = (label, value, color) => `
  <div class="result-row">
    <span class="dot" style="background:${color}"></span>
    <span class="rl">${label}</span>
    <span class="rv">${value}</span>
  </div>`;

function noCreditsView(ctx) {
  return `
    <div class="scanner">
      <div class="scanner-ico">${icon('ban', 64)}</div>
      <h2>${t("scan.limitTitle")}</h2>
      <p>${t("scan.limitDesc")}</p>
      <div class="credit-bar">
        <span>📸 ${store.remainingCredits("scan")}/${2}</span>
        <span>💬 ${store.remainingCredits("coach")}/${5}</span>
        <span>🏋️ ${store.remainingCredits("workout")}/${2}</span>
      </div>
      <button class="btn btn-primary btn-block" id="go-premium">${t("scan.getPremium")}</button>
      <button class="btn btn-ghost btn-block" id="credits-back">${t("common.back")}</button>
    </div>`;
}


