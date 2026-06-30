import { store, parseLocalDate } from "../store.js";
import { generateWorkout } from "../api.js";
import { isRanked } from "../lib/ranking.js";
import { openExerciseExplorer } from "./exercises.js";
import { toast } from "./ui.js";

// Base de ejercicios. NO incluye sentadilla ni peso muerto.
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
  push: { A: ["Press de banca con mancuernas", "Press militar con mancuernas", "Press inclinado con mancuernas", "Elevaciones laterales", "Extensión de tríceps en polea"], B: ["Press de banca con mancuernas", "Press militar con mancuernas", "Aperturas en pec-deck", "Fondos en paralelas", "Press francés"], label: "Empuje (pecho · hombro · tríceps)" },
  pull: { A: ["Jalón al pecho", "Remo con mancuerna", "Face pull", "Curl con barra", "Curl martillo"], B: ["Jalón al pecho", "Pull-over en polea", "Remo en máquina", "Face pull", "Curl concentrado"], label: "Tirón (espalda · bíceps)" },
  legs: { A: ["Prensa de piernas", "Hip thrust con barra", "Extensión de cuádriceps", "Curl femoral tumbado", "Elevación de gemelos"], B: ["Prensa de piernas", "Zancadas con mancuernas", "Hip thrust con barra", "Curl femoral sentado", "Elevación de gemelos"], label: "Pierna (sin sentadilla ni peso muerto)" },
  upper: { A: ["Press de banca con mancuernas", "Jalón al pecho", "Press militar con mancuernas", "Remo con mancuerna", "Elevaciones laterales", "Curl con barra", "Extensión de tríceps en polea"], B: ["Press inclinado con mancuernas", "Remo en máquina", "Aperturas en pec-deck", "Face pull", "Elevaciones laterales", "Curl martillo", "Press francés"], label: "Torso (pecho · espalda · hombro · brazos)" },
  lower: { A: ["Prensa de piernas", "Curl femoral tumbado", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Plancha"], B: ["Prensa de piernas", "Extensión de cuádriceps", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Crunch en polea"], label: "Pierna + core (sin sentadilla ni peso muerto)" },
  fullA: { A: ["Press de banca con mancuernas", "Jalón al pecho", "Prensa de piernas", "Elevaciones laterales", "Curl con barra", "Plancha"], label: "Cuerpo completo A" },
  fullB: { A: ["Press inclinado con mancuernas", "Remo con mancuerna", "Hip thrust con barra", "Extensión de tríceps en polea", "Curl martillo", "Elevación de gemelos"], label: "Cuerpo completo B" },
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
  if (goal === "gain") return { sets: 4, reps: "6-10", rest: "90-120 s", note: "Enfoque en fuerza/hipertrofia: progresa en peso cada semana.", cardio: false };
  if (goal === "lose") return { sets: 3, reps: "12-15", rest: "45-60 s", note: "Descansos cortos para mantener la intensidad.", cardio: true };
  return { sets: 3, reps: "8-12", rest: "60-90 s", note: "Mantén buena técnica y constancia.", cardio: false };
}

const GOAL_LABEL = { lose: "Perder grasa", maintain: "Mantener", gain: "Ganar músculo" };

// Construye la lista de ejercicios de un día: por defecto (menos ocultos) + propios.
function dayExercises(focus, variant) {
  const tpl = TEMPLATES[focus];
  const hidden = store.hiddenExercises()[focus] ?? [];
  const base = (tpl[variant] ?? tpl.A)
    .filter((n) => !hidden.includes(n))
    .map((n) => ({ name: n, muscle: MUSCLE[n] ?? "", custom: false }));
  const custom = (store.customExercises()[focus] ?? [])
    .map((c) => ({ name: c.name, muscle: c.muscle ?? "", custom: true, id: c.id }));
  return [...base, ...custom];
}

export function renderWorkout(root) {
  draw(root);
}

function draw(root) {
  const profile = store.profile();
  const days = store.trainingDays();
  const sc = scheme(profile?.goal);
  const split = splitFor(days);
  const streak = store.weekStreak();
  const hideDef = store.hideDefaultRoutine();

  const generated = `
    <div class="card wk-controls">
      <label>¿Cuántos días puedes entrenar a la semana?</label>
      <div class="chip-group" id="days-group">
        ${[2, 3, 4, 5, 6].map((d) => `<div class="chip ${d === days ? "active" : ""}" data-days="${d}"><span class="chip-label">${d} días</span></div>`).join("")}
      </div>
      <p class="wk-scheme">📋 Sugerido: ${sc.sets} series · ${sc.reps} reps · descanso ${sc.rest}. ${sc.note}</p>
    </div>
    <div class="wk-days">
      ${split.map(([focus, variant], i) => dayCard(i + 1, focus, variant, sc)).join("")}
    </div>
    ${sc.cardio ? `<div class="card wk-cardio">🏃 <b>Cardio:</b> 15-25 min al final de cada sesión.</div>` : ""}
    <div class="card wk-warmup">🔥 <b>Calentamiento:</b> 5-10 min de movilidad + 1-2 series ligeras del primer ejercicio.</div>`;

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Rutina de entrenamiento</h2>
      <p class="page-sub">Para tu objetivo: <b>${GOAL_LABEL[profile?.goal] ?? "—"}</b>. <span class="no-tag">🚫 Sin sentadillas ni peso muerto</span></p>
    </div>

    <div class="wk-streak">
      ${miniStat("🔥", streak, streak === 1 ? "semana de racha" : "semanas de racha")}
      ${miniStat("✅", `${store.sessionsThisWeek()}/${days}`, "entrenos esta semana")}
      ${miniStat("🏆", store.sessions().length, "entrenos totales")}
    </div>

    ${myRoutinesSection()}

    ${workoutHistorySection()}

    <div class="section-title" style="margin-top:24px; display:flex; justify-content:space-between; align-items:center">
      <span>Rutina sugerida</span>
      <button class="wk-toggle-def" id="toggle-def">${hideDef ? "Mostrar" : "Ocultar"}</button>
    </div>
    ${hideDef ? "" : generated}

    <div class="section-title" style="margin-top:28px">Plan personalizado con IA ✨</div>
    <div class="card wk-ai-card">
      <p>Genera una variación a medida con IA (respeta no sentadilla ni peso muerto).</p>
      <button class="btn btn-primary" id="ai-btn">✨ Generar con IA</button>
      <div id="ai-out" class="wk-ai-out hidden"></div>
    </div>
  `;

  bind(root);
}

function bind(root) {
  const profile = store.profile();
  const days = store.trainingDays();

  // Días/semana
  root.querySelectorAll("[data-days]").forEach((chip) =>
    chip.addEventListener("click", () => { store.setTrainingDays(Number(chip.dataset.days)); draw(root); })
  );

  // Marcar entreno hecho
  root.querySelectorAll("[data-done]").forEach((btn) =>
    btn.addEventListener("click", () => { const a = store.logSession(btn.dataset.done); toast(a ? "¡Entreno registrado! 💪" : "Ya estaba marcado hoy"); draw(root); })
  );

  // Abrir/cerrar panel de un ejercicio
  root.querySelectorAll("[data-toggle]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-hide],[data-rmcustom]")) return; // no abrir si pulsan borrar
      root.querySelector(`[data-panel="${el.dataset.toggle}"]`)?.classList.toggle("hidden");
    })
  );

  // Añadir una SERIE (multi-serie por día)
  root.querySelectorAll("[data-add-set]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const panel = btn.closest(".wk-ex-log");
      const ex = btn.dataset.addSet;
      const kg = Number(panel.querySelector(".set-kg").value);
      const reps = Number(panel.querySelector(".set-reps").value);
      if (!(kg > 0)) return toast("Pon el peso (kg)");
      if (!(reps > 0)) return toast("Pon las repeticiones");
      store.addLift(ex, kg, reps);
      toast("Serie añadida 💪");
      draw(root);
      // reabrir el panel de ese ejercicio tras redibujar
      root.querySelector(`[data-panel="${btn.dataset.uid}"]`)?.classList.remove("hidden");
    })
  );

  // Borrar una serie
  root.querySelectorAll("[data-del-set]").forEach((btn) =>
    btn.addEventListener("click", () => { store.deleteLiftById(btn.dataset.delSet); draw(root); root.querySelector(`[data-panel="${btn.dataset.uid}"]`)?.classList.remove("hidden"); })
  );

  // Ocultar ejercicio por defecto
  root.querySelectorAll("[data-hide]").forEach((btn) =>
    btn.addEventListener("click", (e) => { e.stopPropagation(); store.hideExercise(btn.dataset.focus, btn.dataset.hide); draw(root); })
  );

  // Quitar ejercicio propio
  root.querySelectorAll("[data-rmcustom]").forEach((btn) =>
    btn.addEventListener("click", (e) => { e.stopPropagation(); store.removeCustomExercise(btn.dataset.focus, btn.dataset.rmcustom); draw(root); })
  );

  // Mostrar el form de "añadir ejercicio propio"
  root.querySelectorAll("[data-addform]").forEach((btn) =>
    btn.addEventListener("click", () => root.querySelector(`[data-addpanel="${btn.dataset.addform}"]`)?.classList.toggle("hidden"))
  );

  // Abrir el explorador de la base de datos de ejercicios
  root.querySelectorAll("[data-explorer]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const focus = btn.dataset.explorer;
      openExerciseExplorer({
        onAdd: (name, muscle) => { store.addCustomExercise(focus, name, muscle); draw(root); },
      });
    })
  );

  // --- Mis rutinas (por días) ---
  root.querySelector("#create-routine")?.addEventListener("click", () => {
    const name = root.querySelector("#new-routine-name").value.trim();
    if (!name) return toast("Ponle un nombre a la rutina");
    store.addRoutine(name);
    toast("Rutina creada 💪");
    draw(root);
  });
  // Renombrar rutina / etiqueta de día (al perder foco, sin re-render para no perder el cursor)
  root.querySelectorAll("[data-routinename]").forEach((inp) =>
    inp.addEventListener("change", () => store.setRoutineName(inp.dataset.routinename, inp.value.trim() || "Rutina"))
  );
  root.querySelectorAll("[data-daylabel]").forEach((inp) =>
    inp.addEventListener("change", () => { const [rid, did] = inp.dataset.daylabel.split("|"); store.setRoutineDayLabel(rid, did, inp.value.trim()); })
  );
  root.querySelectorAll("[data-delroutine]").forEach((btn) =>
    btn.addEventListener("click", () => { store.deleteRoutine(btn.dataset.delroutine); draw(root); })
  );
  root.querySelectorAll("[data-addday]").forEach((btn) =>
    btn.addEventListener("click", () => { store.addRoutineDay(btn.dataset.addday); draw(root); })
  );
  root.querySelectorAll("[data-delday]").forEach((btn) =>
    btn.addEventListener("click", () => { const [rid, did] = btn.dataset.delday.split("|"); store.deleteRoutineDay(rid, did); draw(root); })
  );
  root.querySelectorAll("[data-addtoday]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [rid, did] = btn.dataset.addtoday.split("|");
      openExerciseExplorer({ onAdd: (name, muscle) => { store.addExerciseToRoutineDay(rid, did, name, muscle); draw(root); } });
    })
  );
  root.querySelectorAll("[data-rmrex]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [rid, did, idx] = btn.dataset.rmrex.split("|");
      store.removeExerciseFromRoutineDay(rid, did, Number(idx));
      draw(root);
    })
  );
  // Ocultar/mostrar rutina sugerida
  root.querySelector("#toggle-def")?.addEventListener("click", () => {
    store.setHideDefaultRoutine(!store.hideDefaultRoutine());
    draw(root);
  });

  // Guardar ejercicio propio
  root.querySelectorAll("[data-saveexercise]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".wk-addpanel");
      const name = wrap.querySelector(".new-ex-name").value.trim();
      const muscle = wrap.querySelector(".new-ex-muscle").value.trim();
      if (!name) return toast("Pon el nombre del ejercicio");
      store.addCustomExercise(btn.dataset.saveexercise, name, muscle);
      toast("Ejercicio añadido ✅");
      draw(root);
    })
  );

  // Generar con IA
  const aiBtn = root.querySelector("#ai-btn");
  const aiOut = root.querySelector("#ai-out");
  aiBtn?.addEventListener("click", async () => {
    aiBtn.disabled = true; aiBtn.textContent = "Generando…";
    aiOut.classList.remove("hidden"); aiOut.innerHTML = `<div class="spinner" style="margin:16px auto"></div>`;
    try { const plan = await generateWorkout(profile, days); aiOut.innerHTML = `<pre class="wk-ai-text">${esc(plan)}</pre>`; }
    catch (e) { aiOut.innerHTML = `<p class="hist-note">No se pudo generar: ${esc(e.message)}</p>`; toast("Error generando la rutina"); }
    finally { aiBtn.disabled = false; aiBtn.textContent = "✨ Generar con IA"; }
  });
}

function dayCard(n, focus, variant, sc) {
  const tpl = TEMPLATES[focus];
  const done = store.hasSessionToday(tpl.label);
  const exercises = dayExercises(focus, variant);
  const addId = `add-${focus}-${variant}-${n}`;
  return `
    <div class="card wk-day">
      <div class="wk-day-head">
        <span class="wk-day-n">Día ${n}</span>
        <span class="wk-day-focus">${tpl.label}</span>
        <button class="wk-done-btn ${done ? "done" : ""}" data-done="${attr(tpl.label)}">${done ? "✓ Hecho hoy" : "Marcar hecho"}</button>
      </div>
      <div class="wk-ex-list">
        ${exercises.map((ex, i) => exerciseRow(ex, focus, sc, `${focus}${variant}${n}-${i}`)).join("")}
      </div>
      <div class="wk-add-row">
        <button class="wk-add-ex" data-explorer="${focus}">📚 Desde la base de datos</button>
        <button class="wk-add-ex" data-addform="${addId}">✏️ Manual</button>
      </div>
      <div class="wk-addpanel hidden" data-addpanel="${addId}">
        <input class="new-ex-name" type="text" placeholder="Nombre del ejercicio" />
        <input class="new-ex-muscle" type="text" placeholder="Músculo (opcional)" />
        <button class="btn btn-primary" data-saveexercise="${focus}">Añadir</button>
      </div>
    </div>`;
}

function exerciseRow(ex, focus, sc, uid) {
  const sets = store.liftsForDay(ex.name); // series de HOY
  const pr = store.bestOneRM(ex.name);
  const todayTxt = sets.length ? sets.map((s) => `${s.kg}×${s.reps}`).join(", ") : "sin series hoy";
  const ranked = isRanked(ex.name);

  const setsList = sets
    .map((s, i) => `<div class="set-item"><span>Serie ${i + 1}: <b>${s.kg} kg × ${s.reps}</b></span><button class="set-del" data-del-set="${s.id}" data-uid="${uid}" title="Borrar serie">✕</button></div>`)
    .join("");

  return `
    <div class="wk-ex-wrap">
      <div class="wk-ex" data-toggle="${uid}">
        <div class="wk-ex-info">
          <span class="wk-ex-name">${esc(ex.name)} ${ranked ? '<span class="ranked-dot" title="Cuenta para tu rango">★</span>' : ""}</span>
          <span class="wk-ex-muscle">${esc(ex.muscle)}${sc ? ` · sugerido ${sc.sets}×${sc.reps}` : ""} · hoy: ${todayTxt}</span>
        </div>
        ${ex.custom
          ? `<button class="ex-remove" data-rmcustom="${ex.id}" data-focus="${focus}" title="Quitar ejercicio">🗑</button>`
          : `<button class="ex-remove" data-hide="${attr(ex.name)}" data-focus="${focus}" title="Ocultar ejercicio">✕</button>`}
        <span class="wk-ex-caret">⊕</span>
      </div>
      <div class="wk-ex-log hidden" data-panel="${uid}">
        ${sets.length ? `<div class="sets-list">${setsList}</div>` : ""}
        <div class="set-add-row">
          <input class="set-kg" type="number" inputmode="decimal" step="0.5" placeholder="kg" />
          <input class="set-reps" type="number" inputmode="numeric" placeholder="reps" />
          <button class="btn btn-primary set-add-btn" data-add-set="${attr(ex.name)}" data-uid="${uid}">＋ Serie</button>
        </div>
        ${pr ? `<div class="lift-pr">PR estimado: ${pr.toFixed(1)} kg (1RM)</div>` : ""}
      </div>
    </div>`;
}

function miniStat(emoji, value, label) {
  return `<div class="card mini-stat"><div class="ms-top">${emoji} <b>${value}</b></div><div class="ms-label">${label}</div></div>`;
}

function myRoutinesSection() {
  const routines = store.customRoutines();
  return `
    <div class="section-title" style="margin-top:8px">Mis rutinas</div>
    ${routines.length ? `<div class="my-routines">${routines.map(routineCard).join("")}</div>` : `<p class="hist-note">Aún no tienes rutinas propias. Crea una y organízala por días 💪</p>`}
    <div class="wk-newroutine">
      <input id="new-routine-name" type="text" placeholder="Nombre (ej. Push Pull Legs)" />
      <button class="btn btn-primary" id="create-routine">＋ Crear rutina</button>
    </div>`;
}

function routineCard(r) {
  return `
    <div class="card my-routine">
      <div class="mr-head">
        <input class="mr-name" type="text" value="${attr(r.name)}" data-routinename="${r.id}" />
        <button class="ex-remove" data-delroutine="${r.id}" title="Borrar rutina">🗑</button>
      </div>
      ${r.days.map((d, i) => routineDay(r.id, d, i + 1)).join("")}
      <button class="wk-add-ex" data-addday="${r.id}">＋ Añadir día</button>
    </div>`;
}

function routineDay(rid, d, n) {
  return `
    <div class="mr-day">
      <div class="mr-day-head">
        <span class="mr-day-n">Día ${n}</span>
        <input class="mr-day-label" type="text" placeholder="Músculo / zona (ej. Pecho y tríceps)" value="${attr(d.label || "")}" data-daylabel="${rid}|${d.id}" />
        <button class="set-del" data-delday="${rid}|${d.id}" title="Borrar día">✕</button>
      </div>
      <div class="mr-exs">
        ${d.exercises.length
          ? d.exercises.map((e, i) => `<div class="mr-ex"><span>${esc(e.name)}${e.muscle ? ` · <span class="mr-ex-m">${esc(e.muscle)}</span>` : ""}</span><button class="set-del" data-rmrex="${rid}|${d.id}|${i}" title="Quitar">✕</button></div>`).join("")
          : `<div class="meal-empty" style="padding-left:0">Sin ejercicios este día</div>`}
      </div>
      <button class="wk-add-ex wk-add-small" data-addtoday="${rid}|${d.id}">📚 Añadir ejercicio</button>
    </div>`;
}

// Historial de entrenos por día (esta semana / semana pasada / anteriores).
function workoutHistorySection() {
  const lifts = store.lifts();
  if (!lifts.length) return `<div class="section-title" style="margin-top:28px">Historial de entrenos</div><p class="hist-note">Aún no has registrado series. Regístralas en la rutina y aparecerán aquí por día.</p>`;

  // Agrupa por fecha -> ejercicios -> series
  const byDate = {};
  for (const l of lifts) {
    (byDate[l.date] = byDate[l.date] || {});
    (byDate[l.date][l.exercise] = byDate[l.date][l.exercise] || []).push(`${l.kg}×${l.reps}`);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const mondayOffset = (dt) => { const x = new Date(dt); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const thisMon = mondayOffset(new Date());
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);

  const groups = { "Esta semana": [], "Semana pasada": [], "Anteriores": [] };
  for (const date of dates) {
    const d = parseLocalDate(date);
    if (d >= thisMon) groups["Esta semana"].push(date);
    else if (d >= lastMon) groups["Semana pasada"].push(date);
    else groups["Anteriores"].push(date);
  }

  const fmt = (key) => new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "short" }).format(parseLocalDate(key));
  const dayBlock = (date) => `
    <div class="card wh-day">
      <div class="wh-date">${cap(fmt(date))}</div>
      ${Object.entries(byDate[date]).map(([ex, sets]) => `<div class="wh-ex"><span class="wh-ex-name">${esc(ex)}</span><span class="wh-ex-sets">${sets.join(", ")}</span></div>`).join("")}
    </div>`;

  return `
    <div class="section-title" style="margin-top:28px">Historial de entrenos</div>
    ${Object.entries(groups).filter(([, ds]) => ds.length).map(([title, ds]) => `
      <div class="wh-group-title">${title}</div>
      ${ds.slice(0, title === "Anteriores" ? 10 : 99).map(dayBlock).join("")}
    `).join("")}`;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function attr(s) { return String(s).replace(/"/g, "&quot;"); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
