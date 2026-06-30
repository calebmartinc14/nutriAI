import { store, SLOTS } from "../store.js";
import { toast } from "./ui.js";

// Modal de registro manual (100% gratis y offline).
export function openManualModal(slotId = "breakfast", onSaved, prefill = null) {
  const recents = prefill ? [] : store.recentMeals(8);
  const favs = prefill ? [] : store.favorites();
  const data = (m) => encodeURIComponent(JSON.stringify({ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat }));

  const favItem = (m) =>
    `<div class="qa-item"><button class="qa-chip" data-quick='${data(m)}'>★ ${escapeHtml(m.name)} <small>${Math.round(m.calories || 0)}</small></button><button class="qa-x" data-rmfav="${m.id}" title="Quitar de favoritos">✕</button></div>`;
  const recItem = (m) =>
    `<div class="qa-item"><button class="qa-chip" data-quick='${data(m)}'>${escapeHtml(m.name)} <small>${Math.round(m.calories || 0)}</small></button><button class="qa-x" data-fav='${data(m)}' title="Guardar en favoritos">★</button></div>`;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${prefill ? "Confirmar comida" : "Añadir comida"}</h3>

      ${!prefill && (favs.length || recents.length) ? `
      <div class="qa-wrap">
        ${favs.length ? `<div class="qa-title">★ Favoritos</div><div class="qa-row">${favs.map(favItem).join("")}</div>` : ""}
        ${recents.length ? `<div class="qa-title">Recientes</div><div class="qa-row">${recents.map(recItem).join("")}</div>` : ""}
        <div class="qa-hint">Toca un alimento para añadirlo al tramo seleccionado.</div>
      </div>` : ""}

      <div class="field">
        <label>Nombre</label>
        <input id="m-name" type="text" placeholder="Ej. Pechuga con arroz" value="${prefill?.name ?? ""}" />
      </div>
      <div class="field">
        <label>Tramo</label>
        <div class="slot-picker" id="m-slots">
          ${SLOTS.map(
            (s) =>
              `<button class="slot-chip ${s.id === slotId ? "active" : ""}" data-slot="${s.id}">${s.label}</button>`
          ).join("")}
        </div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Calorías</label><input id="m-cal" type="number" inputmode="numeric" value="${prefill?.calories ?? ""}" /></div>
        <div class="field"><label>Proteína (g)</label><input id="m-pro" type="number" inputmode="numeric" value="${prefill?.protein ?? ""}" /></div>
        <div class="field"><label>Carbos (g)</label><input id="m-car" type="number" inputmode="numeric" value="${prefill?.carbs ?? ""}" /></div>
        <div class="field"><label>Grasas (g)</label><input id="m-fat" type="number" inputmode="numeric" value="${prefill?.fat ?? ""}" /></div>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-primary" id="m-save">Guardar</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedSlot = slotId;
  backdrop.querySelectorAll("[data-slot]").forEach((chip) =>
    chip.addEventListener("click", () => {
      selectedSlot = chip.dataset.slot;
      backdrop.querySelectorAll(".slot-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    })
  );

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#m-cancel").addEventListener("click", close);

  // Quick-add: tocar un favorito/reciente lo añade al tramo seleccionado.
  backdrop.querySelectorAll("[data-quick]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const m = JSON.parse(decodeURIComponent(btn.dataset.quick));
      store.addMeal({ name: m.name, slot: selectedSlot, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, source: "manual" });
      close();
      toast(`Añadido: ${m.name}`);
      onSaved?.();
    })
  );
  // Guardar un reciente como favorito.
  backdrop.querySelectorAll("[data-fav]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      store.addFavorite(JSON.parse(decodeURIComponent(btn.dataset.fav)));
      toast("Guardado en favoritos ★");
      btn.classList.add("qa-x-on");
    })
  );
  // Quitar favorito.
  backdrop.querySelectorAll("[data-rmfav]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      store.removeFavorite(btn.dataset.rmfav);
      btn.closest(".qa-item").remove();
    })
  );

  backdrop.querySelector("#m-save").addEventListener("click", () => {
    const name = backdrop.querySelector("#m-name").value.trim();
    if (!name) return toast("Ponle un nombre a la comida");
    store.addMeal({
      name,
      slot: selectedSlot,
      calories: num("#m-cal"),
      protein: num("#m-pro"),
      carbs: num("#m-car"),
      fat: num("#m-fat"),
      photo: prefill?.photo ?? null,
      source: prefill?.source ?? "manual",
    });
    close();
    toast("Guardado ✅");
    onSaved?.();
  });

  function num(sel) {
    return Number(backdrop.querySelector(sel).value) || 0;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
