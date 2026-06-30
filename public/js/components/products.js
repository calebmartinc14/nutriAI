import { store, SLOTS } from "../store.js";
import { toast } from "./ui.js";

// Busca en Open Food Facts (gratis, con CORS, sin clave).
async function buscarProductos(query, soloHacendado) {
  const params = new URLSearchParams({
    search_terms: query, search_simple: "1", action: "process", json: "1",
    page_size: "30",
    fields: "code,product_name,brands,image_front_small_url,nutriments",
  });
  if (soloHacendado) params.set("brands_tags", "hacendado");
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
  if (!res.ok) throw new Error("OFF no disponible");
  const data = await res.json();
  return (data.products || [])
    .map((p) => ({
      nombre: p.product_name,
      marca: p.brands,
      img: p.image_front_small_url,
      kcal: p.nutriments?.["energy-kcal_100g"],
      p: p.nutriments?.proteins_100g,
      c: p.nutriments?.carbohydrates_100g,
      f: p.nutriments?.fat_100g,
    }))
    .filter((x) => x.nombre && x.kcal != null);
}

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
    <label class="prod-hac"><input type="checkbox" id="prod-hac" /> Solo Hacendado (Mercadona)</label>
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

  root.querySelector("#prod-go").addEventListener("click", search);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
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
