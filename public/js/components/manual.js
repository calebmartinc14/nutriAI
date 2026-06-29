import { store, SLOTS } from "../store.js";
import { toast } from "./ui.js";

// Modal de registro manual (100% gratis y offline).
export function openManualModal(slotId = "breakfast", onSaved, prefill = null) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${prefill ? "Confirmar comida" : "Añadir comida"}</h3>
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
