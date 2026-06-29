import { store, computeTargets } from "../store.js";
import { toast } from "./ui.js";

const ACTIVITIES = [
  { id: "sedentary", label: "Sedentario", desc: "Poco o nada" },
  { id: "light", label: "Ligero", desc: "1-3 días/sem" },
  { id: "moderate", label: "Moderado", desc: "3-5 días/sem" },
  { id: "active", label: "Activo", desc: "6-7 días/sem" },
  { id: "very", label: "Muy activo", desc: "Trabajo físico" },
];

const GOALS = [
  { id: "lose", label: "Perder grasa", desc: "Déficit −500" },
  { id: "maintain", label: "Mantener", desc: "Mantenimiento" },
  { id: "gain", label: "Ganar músculo", desc: "Superávit +350" },
];

// Muestra el formulario. Por defecto bloqueante (primera vez); en modo edicion
// se puede cerrar sin guardar.
export function openOnboarding({ isEdit = false, onDone } = {}) {
  const saved = store.profile() ?? {};
  const sel = {
    sex: saved.sex ?? "male",
    activity: saved.activity ?? "moderate",
    goal: saved.goal ?? "maintain",
  };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  document.body.appendChild(backdrop);

  renderForm();

  function renderForm() {
    backdrop.innerHTML = `
      <div class="modal">
        <h3>${isEdit ? "Editar mi perfil" : "¡Bienvenido a NutriAI! 👋"}</h3>
        <p class="sub">${isEdit ? "Ajusta tus datos y recalculamos tu plan." : "Cuéntanos sobre ti y calcularemos tus calorías y macros ideales."}</p>

        <div class="field">
          <label>Sexo</label>
          <div class="chip-group" data-group="sex">
            <div class="chip ${sel.sex === "male" ? "active" : ""}" data-val="male"><span class="chip-label">Hombre</span></div>
            <div class="chip ${sel.sex === "female" ? "active" : ""}" data-val="female"><span class="chip-label">Mujer</span></div>
          </div>
        </div>

        <div class="grid-3">
          <div class="field"><label>Edad</label><input id="f-age" type="number" inputmode="numeric" placeholder="años" value="${saved.age ?? ""}" /></div>
          <div class="field"><label>Altura</label><input id="f-height" type="number" inputmode="numeric" placeholder="cm" value="${saved.height ?? ""}" /></div>
          <div class="field"><label>Peso</label><input id="f-weight" type="number" inputmode="decimal" placeholder="kg" value="${saved.weight ?? ""}" /></div>
        </div>

        <div class="field">
          <label>Nivel de actividad</label>
          <div class="chip-group" data-group="activity">
            ${ACTIVITIES.map(
              (a) => `<div class="chip ${sel.activity === a.id ? "active" : ""}" data-val="${a.id}">
                <span class="chip-label">${a.label}</span><span class="chip-desc">${a.desc}</span>
              </div>`
            ).join("")}
          </div>
        </div>

        <div class="field">
          <label>Tu objetivo</label>
          <div class="chip-group" data-group="goal">
            ${GOALS.map(
              (g) => `<div class="chip ${sel.goal === g.id ? "active" : ""}" data-val="${g.id}">
                <span class="chip-label">${g.label}</span><span class="chip-desc">${g.desc}</span>
              </div>`
            ).join("")}
          </div>
        </div>

        <div class="btn-row" style="margin-top:8px">
          ${isEdit ? `<button class="btn btn-ghost" id="f-cancel">Cancelar</button>` : ""}
          <button class="btn btn-primary btn-block" id="f-calc" style="flex:1">Calcular mi plan</button>
        </div>
      </div>`;

    // Selección de chips (un valor por grupo)
    backdrop.querySelectorAll(".chip-group").forEach((group) => {
      const key = group.dataset.group;
      group.querySelectorAll(".chip").forEach((chip) =>
        chip.addEventListener("click", () => {
          sel[key] = chip.dataset.val;
          group.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
        })
      );
    });

    if (isEdit) {
      backdrop.querySelector("#f-cancel").addEventListener("click", () => backdrop.remove());
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    }

    backdrop.querySelector("#f-calc").addEventListener("click", onCalc);
  }

  function onCalc() {
    const age = Number(backdrop.querySelector("#f-age").value);
    const height = Number(backdrop.querySelector("#f-height").value);
    const weight = Number(backdrop.querySelector("#f-weight").value);

    if (!(age >= 10 && age <= 100)) return toast("Pon una edad válida (10-100)");
    if (!(height >= 100 && height <= 250)) return toast("Pon una altura válida en cm (100-250)");
    if (!(weight >= 30 && weight <= 300)) return toast("Pon un peso válido en kg (30-300)");

    const profile = { sex: sel.sex, age, height, weight, activity: sel.activity, goal: sel.goal };
    const targets = computeTargets(profile);
    renderResult(profile, targets);
  }

  function renderResult(profile, t) {
    const goalLabel = GOALS.find((g) => g.id === profile.goal)?.label ?? "";
    backdrop.innerHTML = `
      <div class="modal plan-result">
        <h3>Tu plan diario 🎯</h3>
        <p class="sub">${goalLabel} · Mantenimiento estimado: ${t.maintenance} kcal</p>
        <div class="plan-kcal">${t.calories}</div>
        <div class="sub">kcal objetivo / día</div>
        <div class="plan-macros">
          <div class="plan-macro"><div class="pm-val" style="color:var(--protein)">${t.protein}g</div><div class="pm-label">Proteínas</div></div>
          <div class="plan-macro"><div class="pm-val" style="color:var(--carbs)">${t.carbs}g</div><div class="pm-label">Carbohidratos</div></div>
          <div class="plan-macro"><div class="pm-val" style="color:var(--fat)">${t.fat}g</div><div class="pm-label">Grasas</div></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="r-back">Volver</button>
          <button class="btn btn-primary" id="r-go" style="flex:1">Empezar a trackear</button>
        </div>
      </div>`;

    backdrop.querySelector("#r-back").addEventListener("click", renderForm);
    backdrop.querySelector("#r-go").addEventListener("click", () => {
      store.saveProfile(profile);
      backdrop.remove();
      toast(`Plan fijado: ${t.calories} kcal/día`);
      onDone?.();
    });
  }
}
