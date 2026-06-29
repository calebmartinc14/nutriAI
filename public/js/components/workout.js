import { store } from "../store.js";
import { generateWorkout } from "../api.js";
import { isRanked } from "../lib/ranking.js";
import { toast } from "./ui.js";

// ===========================================================================
// Base de ejercicios. IMPORTANTE: NO incluye sentadilla (squat) ni peso muerto
// (deadlift) ni sus variantes. Para pierna se usan alternativas seguras.
// ===========================================================================
const MUSCLE = {
  "Press de banca con mancuernas": "Pecho",
  "Press inclinado con mancuernas": "Pecho superior",
  "Press militar con mancuernas": "Hombro",
  "Aperturas en pec-deck": "Pecho",
  "Fondos en paralelas": "Pecho / Tríceps",
  "Elevaciones laterales": "Hombro lateral",
  "Extensión de tríceps en polea": "Tríceps",
  "Press francés": "Tríceps",
  "Jalón al pecho": "Espalda (dorsal)",
  "Remo con mancuerna": "Espalda",
  "Remo en máquina": "Espalda",
  "Pull-over en polea": "Dorsal / Pecho",
  "Face pull": "Hombro posterior",
  "Curl con barra": "Bíceps",
  "Curl martillo": "Bíceps / Antebrazo",
  "Curl concentrado": "Bíceps",
  "Prensa de piernas": "Cuádriceps / Glúteo",
  "Extensión de cuádriceps": "Cuádriceps",
  "Curl femoral tumbado": "Isquiotibiales",
  "Curl femoral sentado": "Isquiotibiales",
  "Hip thrust con barra": "Glúteo",
  "Zancadas con mancuernas": "Cuádriceps / Glúteo",
  "Abductor en máquina": "Glúteo medio",
  "Elevación de gemelos": "Gemelos",
  "Plancha": "Core",
  "Crunch en polea": "Abdominales",
};

const TEMPLATES = {
  push: {
    A: ["Press de banca con mancuernas", "Press militar con mancuernas", "Press inclinado con mancuernas", "Elevaciones laterales", "Extensión de tríceps en polea"],
    B: ["Press de banca con mancuernas", "Press militar con mancuernas", "Aperturas en pec-deck", "Fondos en paralelas", "Press francés"],
    label: "Empuje (pecho · hombro · tríceps)",
  },
  pull: {
    A: ["Jalón al pecho", "Remo con mancuerna", "Face pull", "Curl con barra", "Curl martillo"],
    B: ["Jalón al pecho", "Pull-over en polea", "Remo en máquina", "Face pull", "Curl concentrado"],
    label: "Tirón (espalda · bíceps)",
  },
  legs: {
    A: ["Prensa de piernas", "Hip thrust con barra", "Extensión de cuádriceps", "Curl femoral tumbado", "Elevación de gemelos"],
    B: ["Prensa de piernas", "Zancadas con mancuernas", "Hip thrust con barra", "Curl femoral sentado", "Elevación de gemelos"],
    label: "Pierna (sin sentadilla ni peso muerto)",
  },
  upper: {
    A: ["Press de banca con mancuernas", "Jalón al pecho", "Press militar con mancuernas", "Remo con mancuerna", "Elevaciones laterales", "Curl con barra", "Extensión de tríceps en polea"],
    B: ["Press inclinado con mancuernas", "Remo en máquina", "Aperturas en pec-deck", "Face pull", "Elevaciones laterales", "Curl martillo", "Press francés"],
    label: "Torso (pecho · espalda · hombro · brazos)",
  },
  lower: {
    A: ["Prensa de piernas", "Curl femoral tumbado", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Plancha"],
    B: ["Prensa de piernas", "Extensión de cuádriceps", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Crunch en polea"],
    label: "Pierna + core (sin sentadilla ni peso muerto)",
  },
  fullA: {
    A: ["Press de banca con mancuernas", "Jalón al pecho", "Prensa de piernas", "Elevaciones laterales", "Curl con barra", "Plancha"],
    label: "Cuerpo completo A",
  },
  fullB: {
    A: ["Press inclinado con mancuernas", "Remo con mancuerna", "Hip thrust con barra", "Extensión de tríceps en polea", "Curl martillo", "Elevación de gemelos"],
    label: "Cuerpo completo B",
  },
};

function splitFor(days) {
  switch (days) {
    case 2: return [["fullA", "A"], ["fullB", "A"]];
    case 3: return [["push", "A"], ["pull", "A"], ["legs", "A"]];
    case 4: return [["upper", "A"], ["lower", "A"], ["upper", "B"], ["lower", "B"]];
    case 5: return [["push", "A"], ["pull", "A"], ["legs", "A"], ["upper", "B"], ["lower", "B"]];
    case 6: return [["push", "A"], ["pull", "A"], ["legs", "A"], ["push", "B"], ["pull", "B"], ["legs", "B"]];
    default: return [["push", "A"], ["pull", "A"], ["legs", "A"]];
  }
}

function scheme(goal) {
  if (goal === "gain")
    return { sets: 4, reps: "6-10", rest: "90-120 s", note: "Enfoque en fuerza/hipertrofia: progresa en peso cada semana.", cardio: false };
  if (goal === "lose")
    return { sets: 3, reps: "12-15", rest: "45-60 s", note: "Descansos cortos para mantener la intensidad.", cardio: true };
  return { sets: 3, reps: "8-12", rest: "60-90 s", note: "Mantén buena técnica y constancia.", cardio: false };
}

const GOAL_LABEL = { lose: "Perder grasa", maintain: "Mantener", gain: "Ganar músculo" };

export function renderWorkout(root) {
  draw(root);
}

function draw(root) {
  const profile = store.profile();
  const days = store.trainingDays();
  const sc = scheme(profile?.goal);
  const split = splitFor(days);
  const thisWeek = store.sessionsThisWeek();
  const streak = store.weekStreak();

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Rutina de entrenamiento</h2>
      <p class="page-sub">
        Personalizada para tu objetivo: <b>${GOAL_LABEL[profile?.goal] ?? "—"}</b>.
        <span class="no-tag">🚫 Sin sentadillas ni peso muerto</span>
      </p>
    </div>

    <div class="wk-streak">
      ${miniStat("🔥", streak, streak === 1 ? "semana de racha" : "semanas de racha")}
      ${miniStat("✅", `${thisWeek}/${days}`, "entrenos esta semana")}
      ${miniStat("🏆", store.sessions().length, "entrenos totales")}
    </div>

    <div class="card wk-controls">
      <label>¿Cuántos días puedes entrenar a la semana?</label>
      <div class="chip-group" id="days-group">
        ${[2, 3, 4, 5, 6]
          .map((d) => `<div class="chip ${d === days ? "active" : ""}" data-days="${d}"><span class="chip-label">${d} días</span></div>`)
          .join("")}
      </div>
      <p class="wk-scheme">📋 ${sc.sets} series · ${sc.reps} reps · descanso ${sc.rest}. ${sc.note}</p>
    </div>

    <div class="wk-days">
      ${split.map(([focus, variant], i) => dayCard(i + 1, focus, variant, sc)).join("")}
    </div>

    ${sc.cardio ? `<div class="card wk-cardio">🏃 <b>Cardio:</b> añade 15-25 min al final de cada sesión.</div>` : ""}
    <div class="card wk-warmup">🔥 <b>Calentamiento:</b> 5-10 min de movilidad + 1-2 series ligeras del primer ejercicio.</div>

    <div class="section-title" style="margin-top:28px">Plan personalizado con IA ✨</div>
    <div class="card wk-ai-card">
      <p>Genera una variación a medida con IA (respeta la regla de no sentadilla ni peso muerto).</p>
      <button class="btn btn-primary" id="ai-btn">✨ Generar con IA</button>
      <div id="ai-out" class="wk-ai-out hidden"></div>
    </div>
  `;

  // Selector de días
  root.querySelectorAll("[data-days]").forEach((chip) =>
    chip.addEventListener("click", () => {
      store.setTrainingDays(Number(chip.dataset.days));
      draw(root);
    })
  );

  // Marcar entreno como hecho
  root.querySelectorAll("[data-done]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const added = store.logSession(btn.dataset.done);
      toast(added ? "¡Entreno registrado! 💪" : "Ya estaba marcado hoy");
      draw(root);
    })
  );

  // Abrir/cerrar el registro de peso de un ejercicio
  root.querySelectorAll("[data-log-toggle]").forEach((el) =>
    el.addEventListener("click", () => {
      const panel = root.querySelector(`[data-log-panel="${cssId(el.dataset.logToggle)}"]`);
      panel?.classList.toggle("hidden");
    })
  );

  // Guardar peso levantado
  root.querySelectorAll("[data-save-lift]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = btn.dataset.saveLift;
      const panel = btn.closest(".wk-ex-log");
      const kg = Number(panel.querySelector(".lift-kg").value);
      const reps = Number(panel.querySelector(".lift-reps").value);
      if (!(kg > 0)) return toast("Pon el peso en kg");
      if (!(reps > 0)) return toast("Pon las repeticiones");
      store.addLift(ex, kg, reps);
      toast("Registro guardado 💾");
      draw(root);
    })
  );

  // Generar con IA
  const aiBtn = root.querySelector("#ai-btn");
  const aiOut = root.querySelector("#ai-out");
  aiBtn.addEventListener("click", async () => {
    aiBtn.disabled = true;
    aiBtn.textContent = "Generando…";
    aiOut.classList.remove("hidden");
    aiOut.innerHTML = `<div class="spinner" style="margin:16px auto"></div>`;
    try {
      const plan = await generateWorkout(profile, days);
      aiOut.innerHTML = `<pre class="wk-ai-text">${escapeHtml(plan)}</pre>`;
    } catch (e) {
      aiOut.innerHTML = `<p class="hist-note">No se pudo generar: ${escapeHtml(e.message)}</p>`;
      toast("Error generando la rutina");
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = "✨ Generar con IA";
    }
  });
}

function dayCard(n, focus, variant, sc) {
  const tpl = TEMPLATES[focus];
  const exercises = tpl[variant] ?? tpl.A;
  const done = store.hasSessionToday(tpl.label);
  return `
    <div class="card wk-day">
      <div class="wk-day-head">
        <span class="wk-day-n">Día ${n}</span>
        <span class="wk-day-focus">${tpl.label}</span>
        <button class="wk-done-btn ${done ? "done" : ""}" data-done="${escapeAttr(tpl.label)}">
          ${done ? "✓ Hecho hoy" : "Marcar hecho"}
        </button>
      </div>
      <div class="wk-ex-list">
        ${exercises.map((name) => exerciseRow(name, sc)).join("")}
      </div>
    </div>`;
}

function exerciseRow(name, sc) {
  const last = store.lastLift(name);
  const pr = store.bestOneRM(name);
  const id = cssId(name);
  return `
    <div class="wk-ex-wrap">
      <div class="wk-ex" data-log-toggle="${escapeAttr(name)}">
        <div class="wk-ex-info">
          <span class="wk-ex-name">${name} ${isRanked(name) ? '<span class="ranked-dot" title="Cuenta para tu rango">★</span>' : ""}</span>
          <span class="wk-ex-muscle">${MUSCLE[name] ?? ""}${last ? ` · última: ${last.kg}kg×${last.reps}` : ""}</span>
        </div>
        <span class="wk-ex-sets">${sc.sets} × ${sc.reps}</span>
        <span class="wk-ex-caret">⊕</span>
      </div>
      <div class="wk-ex-log hidden" data-log-panel="${id}">
        <input class="lift-kg" type="number" inputmode="decimal" step="0.5" placeholder="kg" />
        <input class="lift-reps" type="number" inputmode="numeric" placeholder="reps" />
        <button class="btn btn-primary lift-save" data-save-lift="${escapeAttr(name)}">Guardar</button>
        ${pr ? `<span class="lift-pr">PR ${pr.toFixed(1)}kg 1RM</span>` : ""}
      </div>
    </div>`;
}

function miniStat(emoji, value, label) {
  return `<div class="card mini-stat"><div class="ms-top">${emoji} <b>${value}</b></div><div class="ms-label">${label}</div></div>`;
}

// Helpers
function cssId(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]/g, "-");
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
