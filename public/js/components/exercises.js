import { store } from "../store.js";
import { loadExerciseDB, muscleOptions, equipOptions, MUSCLE_LABELS, EQUIP_LABELS, IMG_BASE, youtubeSearch } from "../lib/exercise_db.js";
import { toast } from "./ui.js";

const mLabel = (k) => MUSCLE_LABELS[k] || k;
const eLabel = (k) => EQUIP_LABELS[k] || k;

// Abre el explorador. onAdd(name, muscleLabel) se llama al elegir un ejercicio.
export async function openExerciseExplorer({ onAdd } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal ex-modal"><div class="spinner" style="margin:40px auto"></div></div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });

  const all = await loadExerciseDB();
  const muscles = muscleOptions(all);
  const equips = equipOptions(all);
  let fMuscle = "", fEquip = "", q = "";

  const modal = backdrop.querySelector(".ex-modal");

  function apply() {
    return all.filter((e) =>
      (!fMuscle || e.muscle === fMuscle) &&
      (!fEquip || e.equipment === fEquip) &&
      (!q || e.name.toLowerCase().includes(q.toLowerCase()))
    );
  }

  function render() {
    const list = apply().slice(0, 120); // límite para no saturar
    modal.innerHTML = `
      <div class="ex-head">
        <h3>Base de ejercicios</h3>
        <button class="ex-close" id="ex-x">✕</button>
      </div>
      <input class="ex-search" id="ex-q" type="text" placeholder="Buscar ejercicio…" value="${attr(q)}" />
      <div class="ex-filters">
        <select id="ex-m">
          <option value="">Todos los músculos</option>
          ${muscles.map((m) => `<option value="${attr(m)}" ${m === fMuscle ? "selected" : ""}>${mLabel(m)}</option>`).join("")}
        </select>
        <select id="ex-e">
          <option value="">Todo el equipo</option>
          ${equips.map((e) => `<option value="${attr(e)}" ${e === fEquip ? "selected" : ""}>${eLabel(e)}</option>`).join("")}
        </select>
      </div>
      <div class="ex-count">${apply().length} ejercicios</div>
      <div class="ex-grid">
        ${list.map(card).join("") || `<p class="hist-note">Sin resultados con esos filtros.</p>`}
      </div>`;

    modal.querySelector("#ex-x").addEventListener("click", () => backdrop.remove());
    modal.querySelector("#ex-q").addEventListener("input", (e) => { q = e.target.value; renderGridOnly(); });
    modal.querySelector("#ex-m").addEventListener("change", (e) => { fMuscle = e.target.value; render(); });
    modal.querySelector("#ex-e").addEventListener("change", (e) => { fEquip = e.target.value; render(); });
    bindCards();
  }

  function renderGridOnly() {
    const list = apply().slice(0, 120);
    modal.querySelector(".ex-count").textContent = `${apply().length} ejercicios`;
    modal.querySelector(".ex-grid").innerHTML = list.map(card).join("") || `<p class="hist-note">Sin resultados.</p>`;
    bindCards();
  }

  function card(e) {
    const thumb = e.images?.length
      ? `<img class="ex-thumb" src="${IMG_BASE}${e.images[0]}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ex-thumb ex-thumb-ph" style="display:none">🏋️</div>`
      : `<div class="ex-thumb ex-thumb-ph">🏋️</div>`;
    return `
      <div class="ex-item" data-id="${attr(e.id)}">
        ${thumb}
        <div class="ex-item-info">
          <div class="ex-item-name">${esc(e.name)}</div>
          <div class="ex-item-meta">${mLabel(e.muscle)} · ${eLabel(e.equipment)}</div>
        </div>
        <div class="ex-item-actions">
          <button class="ex-btn-play" data-play="${attr(e.id)}" title="Ver técnica">▶</button>
          <button class="ex-btn-add" data-add="${attr(e.id)}" title="Añadir">＋</button>
        </div>
      </div>`;
  }

  function bindCards() {
    modal.querySelectorAll("[data-add]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const ex = all.find((x) => x.id === btn.dataset.add);
        if (!ex) return;
        onAdd?.(ex.name, mLabel(ex.muscle));
        toast(`Añadido: ${ex.name}`);
        backdrop.remove();
      })
    );
    modal.querySelectorAll("[data-play]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const ex = all.find((x) => x.id === btn.dataset.play);
        if (ex) openMiniPlayer(ex);
      })
    );
  }

  render();
}

// Mini-reproductor flotante (PiP): anima las imágenes del ejercicio + YouTube.
let pip = null;
export function openMiniPlayer(ex) {
  pip?.remove();
  pip = document.createElement("div");
  pip.className = "pip";
  const hasImgs = ex.images && ex.images.length;
  pip.innerHTML = `
    <div class="pip-head">
      <span class="pip-title">${esc(ex.name)}</span>
      <button class="pip-x" title="Cerrar">✕</button>
    </div>
    <div class="pip-body">
      ${hasImgs
        ? `<img class="pip-img" src="${IMG_BASE}${ex.images[0]}" alt="" onerror="this.closest('.pip').querySelector('.pip-fallback').style.display='block';this.style.display='none'">`
        : ""}
      <div class="pip-fallback" style="${hasImgs ? "display:none" : ""}">
        <div class="pip-fb-emoji">🎥</div>
        <p>Mira la técnica en vídeo:</p>
      </div>
    </div>
    <a class="pip-yt" href="${youtubeSearch(ex.name)}" target="_blank" rel="noopener">▶ Buscar en YouTube</a>`;
  document.body.appendChild(pip);

  pip.querySelector(".pip-x").addEventListener("click", () => { pip.remove(); pip = null; });

  // Anima entre las imágenes (efecto GIF) si hay 2+.
  if (ex.images && ex.images.length > 1) {
    const img = pip.querySelector(".pip-img");
    let i = 0;
    const t = setInterval(() => {
      if (!document.body.contains(pip)) return clearInterval(t);
      i = (i + 1) % ex.images.length;
      img.src = `${IMG_BASE}${ex.images[i]}`;
    }, 900);
  }

  // Arrastrable
  makeDraggable(pip, pip.querySelector(".pip-head"));
}

function makeDraggable(el, handle) {
  let sx, sy, ox, oy, drag = false;
  const down = (e) => {
    drag = true;
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX; sy = p.clientY;
    const r = el.getBoundingClientRect();
    ox = r.left; oy = r.top;
    el.style.right = "auto"; el.style.bottom = "auto";
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", move, { passive: false }); document.addEventListener("touchend", up);
  };
  const move = (e) => {
    if (!drag) return;
    if (e.cancelable) e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    el.style.left = ox + (p.clientX - sx) + "px";
    el.style.top = oy + (p.clientY - sy) + "px";
  };
  const up = () => {
    drag = false;
    document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move); document.removeEventListener("touchend", up);
  };
  handle.addEventListener("mousedown", down);
  handle.addEventListener("touchstart", down, { passive: true });
}

function attr(s) { return String(s).replace(/"/g, "&quot;"); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
