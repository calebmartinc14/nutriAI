import { SLOTS } from "../store.js";
import { analyzeFood, fileToCompressedBase64 } from "../api.js";
import { store } from "../store.js";
import { openManualModal } from "./manual.js";
import { toast } from "./ui.js";

// Pantalla de escaner de comida por foto (IA). Uso ilimitado.
export function renderScanner(root, { navigate, refresh, params }) {
  let slot = params?.slot ?? "lunch";
  root.innerHTML = pickerView(slot);
  bindPicker(root, slot, { navigate, refresh });
}

function pickerView(slot) {
  return `
    <div class="scanner">
      <div class="scanner-ico">🍽️</div>
      <h2>Escanea tu plato</h2>
      <p>Toma o sube una foto y la IA estimará calorías y macros automáticamente.</p>

      <div class="slot-picker">
        ${SLOTS.map(
          (s) => `<button class="slot-chip ${s.id === slot ? "active" : ""}" data-slot="${s.id}">${s.label}</button>`
        ).join("")}
      </div>

      <input id="file-camera" type="file" accept="image/*" capture="environment" class="hidden" />
      <input id="file-gallery" type="file" accept="image/*" class="hidden" />

      <button class="btn btn-primary btn-block" id="btn-camera">📷 Cámara</button>
      <button class="btn btn-ghost btn-block" id="btn-gallery">🖼️ Subir foto</button>
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
    if (file) handleFile(root, file, slot, ctx);
  };
  camera.addEventListener("change", onFile);
  gallery.addEventListener("change", onFile);
}

async function handleFile(root, file, slot, ctx) {
  let preview;
  try {
    preview = await fileToCompressedBase64(file);
  } catch {
    return toast("No se pudo leer la imagen");
  }

  root.innerHTML = `
    <div class="scanner">
      <img class="preview" src="${preview.dataUrl}" alt="plato" />
      <p>Analizando con IA…</p>
      <div class="result-rows" aria-hidden="true">
        <div class="skeleton sk-line mid"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
        <div class="skeleton sk-line short"></div>
      </div>
      <div class="spinner"></div>
    </div>`;

  try {
    const analysis = await analyzeFood(preview.base64, slotLabel(slot));
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
      <p class="confidence">Confianza ${Math.round((a.confidence ?? 0.5) * 100)}%</p>
      <div class="result-rows">
        ${row("Calorías", `${Math.round(a.calories)} kcal`, "var(--cal)")}
        ${row("Proteínas", `${Math.round(a.protein_g)} g`, "var(--protein)")}
        ${row("Carbohidratos", `${Math.round(a.carbs_g)} g`, "var(--carbs)")}
        ${row("Grasas", `${Math.round(a.fat_g)} g`, "var(--fat)")}
      </div>
      <button class="btn btn-primary btn-block" id="save">Guardar en mi diario</button>
      <button class="btn btn-ghost btn-block" id="edit">Ajustar valores</button>
      <button class="btn btn-ghost btn-block" id="retry">Repetir foto</button>
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
    toast("Guardado ✅");
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
      <div class="scanner-ico">⚠️</div>
      <h2>Ups</h2>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary btn-block" id="retry">Reintentar</button>
    </div>`;
  root.querySelector("#retry").addEventListener("click", () => ctx.navigate("scanner"));
}

const row = (label, value, color) => `
  <div class="result-row">
    <span class="dot" style="background:${color}"></span>
    <span class="rl">${label}</span>
    <span class="rv">${value}</span>
  </div>`;

const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label ?? "";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
