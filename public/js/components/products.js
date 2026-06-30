import { store, SLOTS } from "../store.js";
import { searchProducts as buscarProductos, getProductByBarcode } from "../api.js";
import { toast } from "./ui.js";

export function renderProducts(root) {
  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Buscar productos</h2>
      <p class="page-sub">Añade alimentos por peso. Datos de Open Food Facts.</p>
    </div>
    <div class="prod-search">
      <input id="prod-q" type="text" placeholder="Ej. yogur, atún, pan…" />
      <button class="btn btn-primary" id="prod-go">Buscar</button>
    </div>
    <div class="prod-bar-row">
      <button class="btn btn-ghost" id="prod-scan">📷 Escanear código de barras</button>
      <label class="prod-hac"><input type="checkbox" id="prod-hac" /> Solo Hacendado</label>
    </div>
    <div id="prod-results"></div>
  `;

  const input = root.querySelector("#prod-q");
  const results = root.querySelector("#prod-results");

  const search = async () => {
    const q = input.value.trim();
    if (!q) return;
    results.innerHTML = `<div class="spinner" style="margin:24px auto"></div>`;
    try {
      const list = await buscarProductos(q, root.querySelector("#prod-hac").checked);
      if (!list.length) { results.innerHTML = `<p class="hist-note">Sin resultados. Prueba otro término.</p>`; return; }
      results.innerHTML = list.map(card).join("");
      bindResults(results, list);
    } catch {
      results.innerHTML = `<p class="hist-note">No se pudo conectar con Open Food Facts. Revisa tu conexión e inténtalo de nuevo.</p>`;
    }
  };

  // Buscar por código de barras (tras escanear o introducir manual)
  const lookupBarcode = async (code) => {
    results.innerHTML = `<div class="spinner" style="margin:24px auto"></div>`;
    try {
      const product = await getProductByBarcode(code);
      results.innerHTML = card(product, 0);
      bindResults(results, [product]);
    } catch (e) {
      results.innerHTML = `<p class="hist-note">${e.status === 404 ? "Producto no encontrado para ese código." : "No se pudo buscar el producto."}</p>`;
    }
  };

  root.querySelector("#prod-go").addEventListener("click", search);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
  root.querySelector("#prod-scan").addEventListener("click", () => openBarcodeScanner(lookupBarcode));
}

// Escáner de código de barras. Usa BarcodeDetector nativo (Android/Chrome) si
// está disponible; si no, pide el código manualmente.
async function openBarcodeScanner(onFound) {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    return manualBarcode(onFound);
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch {
    return manualBarcode(onFound);
  }

  const overlay = document.createElement("div");
  overlay.className = "bc-overlay";
  overlay.innerHTML = `
    <div class="bc-box">
      <video class="bc-video" autoplay muted playsinline></video>
      <div class="bc-frame"></div>
      <p class="bc-hint">Apunta al código de barras…</p>
      <button class="btn btn-ghost" id="bc-cancel">Cancelar</button>
      <button class="btn btn-ghost" id="bc-manual">Introducir a mano</button>
    </div>`;
  document.body.appendChild(overlay);
  const video = overlay.querySelector(".bc-video");
  video.srcObject = stream;

  let stopped = false;
  const stop = () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); overlay.remove(); };
  overlay.querySelector("#bc-cancel").addEventListener("click", stop);
  overlay.querySelector("#bc-manual").addEventListener("click", () => { stop(); manualBarcode(onFound); });

  const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const loop = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length) { const code = codes[0].rawValue; stop(); onFound(code); return; }
    } catch { /* sigue intentando */ }
    setTimeout(loop, 350);
  };
  video.addEventListener("loadeddata", loop);
}

function manualBarcode(onFound) {
  const code = prompt("Introduce el código de barras del producto (los números bajo las barras):");
  if (code && code.trim()) onFound(code.trim());
}

function card(p, i) {
  const thumb = p.img
    ? `<img class="prod-thumb" src="${p.img}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="prod-thumb prod-ph">🛒</div>`;
  return `
    <div class="card prod-item" data-i="${i}">
      ${thumb}
      <div class="prod-info">
        <div class="prod-name">${esc(p.nombre)}</div>
        <div class="prod-meta">${esc(p.marca || "")} · ${Math.round(p.kcal)} kcal/100g · P${r1(p.p)} C${r1(p.c)} G${r1(p.f)}</div>
        <div class="prod-add hidden" data-form="${i}">
          <input class="prod-g" type="number" inputmode="numeric" value="100" /> g
          <select class="prod-slot">${SLOTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join("")}</select>
          <button class="btn btn-primary prod-save" data-save="${i}">Añadir</button>
        </div>
      </div>
      <button class="prod-plus" data-plus="${i}" title="Añadir">＋</button>
    </div>`;
}

function bindResults(root, list) {
  root.querySelectorAll("[data-plus]").forEach((btn) =>
    btn.addEventListener("click", () => root.querySelector(`[data-form="${btn.dataset.plus}"]`)?.classList.toggle("hidden"))
  );
  root.querySelectorAll("[data-save]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const p = list[Number(btn.dataset.save)];
      const form = btn.closest(".prod-add");
      const gramos = Number(form.querySelector(".prod-g").value) || 100;
      const slot = form.querySelector(".prod-slot").value;
      const fct = gramos / 100;
      store.addMeal({
        name: `${p.nombre} (${gramos} g)`,
        slot,
        calories: Math.round((p.kcal || 0) * fct),
        protein: Math.round((p.p || 0) * fct),
        carbs: Math.round((p.c || 0) * fct),
        fat: Math.round((p.f || 0) * fct),
        source: "product",
      });
      toast("Añadido a tu diario ✅");
      form.classList.add("hidden");
    })
  );
}

const r1 = (n) => Math.round((n || 0) * 10) / 10;
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
