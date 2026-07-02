import { store, parseLocalDate, todayKey } from "../store.js";
import { generateWorkout } from "../api.js";
import { isRanked } from "../lib/ranking.js";
import { openExerciseExplorer } from "./exercises.js";
import { escapeHtml, toast, showLimitModal } from "./ui.js";
import { icon } from "../lib/icons.js";

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
  legs: { A: ["Prensa de piernas", "Hip thrust con barra", "Extensión de cuádriceps", "Curl femoral tumbado", "Elevación de gemelos"], B: ["Prensa de piernas", "Zancadas con mancuernas", "Hip thrust con barra", "Curl femoral sentado", "Elevación de gemelos"], label: "Pierna" },
  upper: { A: ["Press de banca con mancuernas", "Jalón al pecho", "Press militar con mancuernas", "Remo con mancuerna", "Elevaciones laterales", "Curl con barra", "Extensión de tríceps en polea"], B: ["Press inclinado con mancuernas", "Remo en máquina", "Aperturas en pec-deck", "Face pull", "Elevaciones laterales", "Curl martillo", "Press francés"], label: "Torso (pecho · espalda · hombro · brazos)" },
  lower: { A: ["Prensa de piernas", "Curl femoral tumbado", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Plancha"], B: ["Prensa de piernas", "Extensión de cuádriceps", "Hip thrust con barra", "Zancadas con mancuernas", "Elevación de gemelos", "Crunch en polea"], label: "Pierna + core" },
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

// Estado del calendario de entrenos (persiste entre re-renders).
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selDate = null;

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
      <p class="wk-scheme">${icon('clipboard', 14)} Sugerido: ${sc.sets} series - ${sc.reps} reps - descanso ${sc.rest}. ${sc.note}</p>
    </div>
    <div class="wk-days">
      ${split.map(([focus, variant], i) => dayCard(i + 1, focus, variant, sc)).join("")}
    </div>
    ${sc.cardio ? `<div class="card wk-cardio">${icon('run', 16)} <b>Cardio:</b> 15-25 min al final de cada sesi&oacute;n.</div>` : ""}
    <div class="card wk-warmup">${icon('flame', 16)} <b>Calentamiento:</b> 5-10 min de movilidad + 1-2 series ligeras del primer ejercicio.</div>`;

  const activeRoutine = store.activeRoutine();

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Rutina de entrenamiento</h2>
      <p class="page-sub">Para tu objetivo: <b>${GOAL_LABEL[profile?.goal] ?? "-"}</b>${activeRoutine ? ` · Rutina activa: <b class="active-routine-name">${icon('zap', 14)} ${activeRoutine.name}</b>` : ""}</p>
    </div>

    <div class="wk-streak">
      ${miniStat('flame', streak, streak === 1 ? "semana de racha" : "semanas de racha")}
      ${miniStat('check', `${store.sessionsThisWeek()}/${days}`, "entrenos esta semana")}
      ${miniStat('trophy', store.sessions().length, "entrenos totales")}
    </div>

    ${myRoutinesSection()}

    ${workoutHistorySection()}

    <div class="section-title" style="margin-top:24px; display:flex; justify-content:space-between; align-items:center">
      <span>Rutina sugerida</span>
      <button class="wk-toggle-def" id="toggle-def">${hideDef ? "Mostrar" : "Ocultar"}</button>
    </div>
    ${hideDef ? "" : generated}

    <div class="section-title" style="margin-top:28px">Plan personalizado con IA ${icon('sparkles', 16)}</div>
    <div class="card wk-ai-card" id="ai-card">
      <p>Genera una variaci&oacute;n a medida con IA.</p>
      <button class="btn btn-primary" id="ai-btn">${icon('sparkles', 16)} Generar con IA</button>
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

  // Marcar/desmarcar entreno hecho
  root.querySelectorAll("[data-done]").forEach((btn) =>
    btn.addEventListener("click", () => { store.toggleSession(btn.dataset.done); draw(root); })
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
      toast("Serie añadida");
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

  // --- Activar rutina ---
  root.querySelectorAll("[data-setactive]").forEach((btn) =>
    btn.addEventListener("click", () => { store.setActiveRoutine(btn.dataset.setactive); draw(root); toast("Rutina activa actualizada"); })
  );

  // --- Series en rutinas propias ---
  root.querySelectorAll("[data-add-rs]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [rid, did, eidx] = btn.dataset.addRs.split("|");
      const wrap = btn.closest(".mr-ex-wrap");
      const kg = Number(wrap?.querySelector(".mr-set-kg")?.value);
      const reps = Number(wrap?.querySelector(".mr-set-reps")?.value);
      if (!(kg > 0 && reps > 0)) return toast("kg y reps deben ser > 0");
      store.addSetToRoutineExercise(rid, did, Number(eidx), kg, reps);
      draw(root);
    })
  );

  root.querySelectorAll("[data-rm-rs]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [rid, did, eidx, sid] = btn.dataset.rmRs.split("|");
      store.removeSetFromRoutineExercise(rid, did, Number(eidx), sid);
      draw(root);
    })
  );

  // --- Marcar/desmarcar hecho en rutinas propias ---
  root.querySelectorAll("[data-rdone]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const label = btn.dataset.rdone;
      if (label) { store.toggleSession(label); draw(root); }
    })
  );

  // --- Historial de ejercicio (log exercise set) ---
  root.querySelectorAll("[data-logex]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = btn.dataset.logex;
      const wrap = btn.closest(".mr-ex-wrap") || btn.closest(".wk-ex-wrap");
      const kg = Number(wrap?.querySelector(".set-kg")?.value || wrap?.querySelector(".mr-set-kg")?.value);
      const reps = Number(wrap?.querySelector(".set-reps")?.value || wrap?.querySelector(".mr-set-reps")?.value);
      if (!(kg > 0 && reps > 0)) return toast("kg y reps deben ser > 0");
      store.logExerciseSet(ex, kg, reps);
      toast("Serie registrada en historial");
      draw(root);
    })
  );

  // --- IA: Event delegation para botones dinámicos ---
  const aiCard = root.querySelector("#ai-card");
  aiCard?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.id === "ai-save-routine") {
      const planText = root.querySelector("#ai-out-text")?.textContent || "";
      if (!planText) return;
      const name = "Plan IA " + new Date().toLocaleDateString();
      store.addRoutine(name);
      const routines = store.customRoutines();
      const last = routines[routines.length - 1];
      if (last) store.setActiveRoutine(last.id);
      toast("Rutina guardada y activada");
      draw(root);
    } else if (btn.id === "ai-discard") {
      const aiOut = root.querySelector("#ai-out");
      aiOut.classList.add("hidden");
      aiOut.innerHTML = "";
      const aiBtn = root.querySelector("#ai-btn");
      if (aiBtn) { aiBtn.disabled = false; aiBtn.innerHTML = `${icon('sparkles', 16)} Generar con IA`; }
    } else if (btn.id === "ai-regenerate") {
      const aiBtn = root.querySelector("#ai-btn");
      if (aiBtn) aiBtn.click();
    }
  });

  // --- Ciclo de reset automático (cambio de semana) ---
  tryAutoReset();

  // --- Mis rutinas (por días) ---
  root.querySelector("#create-routine")?.addEventListener("click", () => {
    const name = root.querySelector("#new-routine-name").value.trim();
    if (!name) return toast("Ponle un nombre a la rutina");
    store.addRoutine(name);
    toast("Rutina creada");
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
  // Asignar día de la semana a un día de rutina (chips L M X J V S D).
  root.querySelectorAll("[data-daywd]").forEach((el) =>
    el.addEventListener("click", () => {
      const [rid, did, wd] = el.dataset.daywd.split("|");
      store.toggleRoutineDayWeekday(rid, did, Number(wd));
      draw(root);
    })
  );

  // Abrir formulario manual para añadir ejercicio a un día de rutina.
  root.querySelectorAll("[data-addform-day]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".mr-day");
      wrap.querySelector(".mr-addpanel")?.classList.toggle("hidden");
    })
  );

  // Guardar ejercicio manual en un día de rutina.
  root.querySelectorAll("[data-saverex]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [rid, did] = btn.dataset.saverex.split("|");
      const wrap = btn.closest(".mr-day");
      const name = wrap.querySelector(".mr-add-name").value.trim();
      const muscle = wrap.querySelector(".mr-add-muscle").value.trim();
      if (!name) return toast("Pon el nombre del ejercicio");
      store.addExerciseToRoutineDay(rid, did, name, muscle);
      toast("Ejercicio añadido");
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
      toast("Ejercicio añadido");
      draw(root);
    })
  );

  // Generar con IA
  const aiBtn = root.querySelector("#ai-btn");
  const aiOut = root.querySelector("#ai-out");
  aiBtn?.addEventListener("click", async () => {
    if (!store.canUse("workout")) {
      showLimitModal("workout", store.remainingCredits);
      return;
    }
    aiBtn.disabled = true; aiBtn.textContent = "Generando...";
    aiOut.classList.remove("hidden"); aiOut.innerHTML = `<div class="spinner" style="margin:16px auto"></div>`;
    try {
      const plan = await generateWorkout(profile, days);
      store.useCredit("workout");
      const cleanPlan = new DOMParser().parseFromString(plan, "text/html").body.textContent || plan;
      aiOut.innerHTML = `
        <pre class="wk-ai-text" id="ai-out-text">${escapeHtml(cleanPlan)}</pre>
        <div class="ai-actions">
          <button class="btn btn-primary" id="ai-save-routine">${icon('check', 14)} A&ntilde;adir como rutina</button>
          <button class="btn btn-ghost" id="ai-regenerate">${icon('sparkles', 14)} Generar otra rutina</button>
          <button class="btn btn-ghost-danger" id="ai-discard">${icon('x', 14)} Descartar</button>
        </div>`;
    }
    catch (e) { aiOut.innerHTML = `<p class="hist-note">No se pudo generar: ${escapeHtml(e.message)}</p>`; toast("Error generando la rutina"); }
    finally { aiBtn.disabled = false; aiBtn.innerHTML = `${icon('sparkles', 16)} Generar con IA`; }
  });

  // Navegación del calendario (mes anterior/siguiente).
  root.querySelectorAll("[data-calnav]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.dataset.calnav === "prev") {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
      } else {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
      }
      selDate = null;
      draw(root);
    })
  );

  // Seleccionar día del calendario.
  root.querySelectorAll("[data-caldate]").forEach((el) =>
    el.addEventListener("click", () => {
      selDate = el.dataset.caldate;
      draw(root);
    })
  );
}

// Reset automático de sesiones al cambiar de semana.
function tryAutoReset() {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Lun...6=Dom
  // Si es domingo (6) después de las 20:00, resetear las sesiones de la semana pasada
  if (dayOfWeek === 6 && now.getHours() >= 20) {
    const sessions = store.sessions();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const mondayKey = todayKey(monday);
    const oldSessions = sessions.filter(s => s.date < mondayKey);
    if (oldSessions.length > 0) {
      oldSessions.forEach(s => store.unlogSession(s.focus, s.date));
    }
  }
  // Si todos los días de la rutina activa están completados, resetear todo
  const activeRoutine = store.activeRoutine();
  if (activeRoutine) {
    const allDone = activeRoutine.days.every(d => store.hasSessionToday(d.label || `Día ${activeRoutine.days.indexOf(d) + 1}`));
    if (allDone && activeRoutine.days.length > 0) {
      activeRoutine.days.forEach(d => {
        const focus = d.label || `Día ${activeRoutine.days.indexOf(d) + 1}`;
        store.unlogSession(focus);
      });
    }
  }
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
        <button class="wk-done-btn ${done ? "done" : ""}" data-done="${attr(tpl.label)}">${done ? `${icon('check', 12)} Hecho hoy` : "Marcar hecho"}</button>
      </div>
      <div class="wk-ex-list">
        ${exercises.map((ex, i) => exerciseRow(ex, focus, sc, `${focus}${variant}${n}-${i}`)).join("")}
      </div>
      <div class="wk-add-row">
        <button class="wk-add-ex" data-explorer="${focus}">${icon('book-open', 14)} Desde la base de datos</button>
        <button class="wk-add-ex" data-addform="${addId}">${icon('pencil', 14)} Manual</button>
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
  const todayTxt = sets.length ? sets.map((s) => `${s.kg}x${s.reps}`).join(", ") : "sin series hoy";
  const ranked = isRanked(ex.name);

  const setsList = sets
    .map((s, i) => `<div class="set-item"><span>Serie ${i + 1}: <b>${s.kg} kg x ${s.reps}</b></span><button class="set-del" data-del-set="${s.id}" data-uid="${uid}" title="Borrar serie">${icon('x', 12)}</button></div>`)
    .join("");

  return `
    <div class="wk-ex-wrap">
      <div class="wk-ex" data-toggle="${uid}">
        <div class="wk-ex-info">
          <span class="wk-ex-name">${escapeHtml(ex.name)} ${ranked ? `<span class="ranked-dot" title="Cuenta para tu rango">${icon('star', 12)}</span>` : ""}</span>
          <span class="wk-ex-muscle">${escapeHtml(ex.muscle)}${sc ? ` - sugerido ${sc.sets}x${sc.reps}` : ""} - hoy: ${todayTxt}</span>
        </div>
        ${ex.custom
          ? `<button class="ex-remove" data-rmcustom="${ex.id}" data-focus="${focus}" title="Quitar ejercicio">${icon('trash-2', 14)}</button>`
          : `<button class="ex-remove" data-hide="${attr(ex.name)}" data-focus="${focus}" title="Ocultar ejercicio">${icon('x', 14)}</button>`}
        <span class="wk-ex-caret">${icon('plus-circle', 16)}</span>
      </div>
      <div class="wk-ex-log hidden" data-panel="${uid}">
        ${sets.length ? `<div class="sets-list">${setsList}</div>` : ""}
        <div class="set-add-row">
          <input class="set-kg" type="number" inputmode="decimal" step="0.5" placeholder="kg" />
          <input class="set-reps" type="number" inputmode="numeric" placeholder="reps" />
          <button class="btn btn-primary set-add-btn" data-add-set="${attr(ex.name)}" data-uid="${uid}">${icon('plus', 14)} Serie</button>
        </div>
        ${pr ? `<div class="lift-pr">PR estimado: ${pr.toFixed(1)} kg (1RM)</div>` : ""}
      </div>
    </div>`;
}

function miniStat(iconName, value, label) {
  return `<div class="card mini-stat"><div class="ms-top">${icon(iconName, 18)} <b>${value}</b></div><div class="ms-label">${label}</div></div>`;
}

function myRoutinesSection() {
  const routines = store.customRoutines();
  const listHtml = routines.length
    ? `<div class="my-routines-list">${routines.map((r) => `
      <div class="card mr-index-row ${r.isActive ? 'mr-active' : ''}">
        <div class="mr-index-info">
          <span class="mr-index-name">${icon('dumbbell', 14)} ${escapeHtml(r.name)}</span>
          <span class="mr-index-meta">${r.days.length} d&iacute;a(s) ${r.isActive ? '· <span class="mr-active-badge">Activa</span>' : ''}</span>
        </div>
        <div class="mr-index-actions">
          ${r.isActive ? '' : `<button class="wk-toggle-def" data-setactive="${r.id}">${icon('play', 12)} Activar</button>`}
          <button class="btn-ghost-danger" style="padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" data-delroutine="${r.id}" title="Borrar rutina">${icon('trash-2', 12)} Borrar</button>
        </div>
      </div>`).join("")}</div>`
    : `<p class="hist-note">Aun no tienes rutinas propias. Crea una y organizala por dias.</p>`;
  return `
    <div class="section-title" style="margin-top:8px">Mis rutinas</div>
    ${listHtml}
    <div class="my-routines">
      ${routines.map(routineCard).join("")}
    </div>
    <div class="wk-newroutine">
      <input id="new-routine-name" type="text" placeholder="Nombre (ej. Push Pull Legs)" />
      <button class="btn btn-primary" id="create-routine">${icon('plus', 14)} Crear rutina</button>
    </div>`;
}

function routineCard(r) {
  const active = r.isActive;
  return `
    <div class="card my-routine ${active ? 'mr-active' : ''}">
      <div class="mr-head">
        <input class="mr-name" type="text" value="${attr(r.name)}" data-routinename="${r.id}" />
        <div class="mr-head-actions">
          ${active ? `<span class="mr-active-badge">${icon('zap', 12)} Activa</span>` : `<button class="wk-toggle-def" data-setactive="${r.id}">${icon('play', 12)} Activar</button>`}
          <button class="btn-ghost-danger" style="padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" data-delroutine="${r.id}" title="Borrar rutina">${icon('trash-2', 12)}</button>
        </div>
      </div>
      ${r.days.map((d, i) => routineDay(r.id, d, i + 1)).join("")}
      <button class="wk-add-ex" data-addday="${r.id}">${icon('plus', 14)} A&ntilde;adir d&iacute;a</button>
    </div>`;
}

function routineDay(rid, d, n) {
  const daysLabel = ['L','M','X','J','V','S','D'];
  const wdChips = daysLabel.map((label, wd) =>
    `<span class="mr-wd-chip ${d.weekdays?.includes(wd) ? 'active' : ''}" data-daywd="${rid}|${d.id}|${wd}">${label}</span>`
  ).join('');
  const dayFocus = d.label || `Día ${n}`;
  const done = store.hasSessionToday(dayFocus);
  return `
    <div class="mr-day">
      <div class="mr-day-head">
        <span class="mr-day-n">Día ${n}</span>
        <input class="mr-day-label" type="text" placeholder="Músculo / zona (ej. Pecho y tríceps)" value="${attr(d.label || "")}" data-daylabel="${rid}|${d.id}" />
        <button class="wk-done-btn ${done ? "done" : ""}" data-rdone="${attr(dayFocus)}">${done ? `${icon('check', 12)} Hecho` : "Marcar hecho"}</button>
        <button class="set-del" data-delday="${rid}|${d.id}" title="Borrar d&iacute;a">${icon('x', 12)}</button>
      </div>
      <div class="mr-wd-row">${wdChips}</div>
      <div class="mr-exs">
        ${d.exercises.length
          ? d.exercises.map((e, i) => routineExerciseRow(rid, d.id, e, i)).join("")
          : `<div class="meal-empty" style="padding-left:0">Sin ejercicios este día</div>`}
      </div>
      <button class="wk-add-ex wk-add-small" data-addtoday="${rid}|${d.id}">${icon('book-open', 14)} Base de datos</button>
      <button class="wk-add-ex wk-add-small" data-addform-day="${rid}|${d.id}">${icon('pencil', 14)} Manual</button>
      <div class="mr-addpanel hidden">
        <input class="mr-add-name" type="text" placeholder="Nombre del ejercicio" />
        <input class="mr-add-muscle" type="text" placeholder="Músculo (opcional)" />
        <button class="btn btn-primary" data-saverex="${rid}|${d.id}">Añadir</button>
      </div>
    </div>`;
}

function routineExerciseRow(rid, did, e, i) {
  const sets = e.sets ?? [];
  const setsHtml = sets.length
    ? sets.map((s, si) =>
      `<div class="set-item"><span>Serie ${si + 1}: <b>${s.weight} kg x ${s.reps}</b></span><button class="set-del" data-rm-rs="${rid}|${did}|${i}|${s.id}" title="Borrar serie">${icon('x', 12)}</button></div>`
    ).join("")
    : "";
  return `
    <div class="mr-ex-wrap">
      <div class="mr-ex">
        <span>${escapeHtml(e.name)}${e.muscle ? ` - <span class="mr-ex-m">${escapeHtml(e.muscle)}</span>` : ""}</span>
        <button class="set-del" data-rmrex="${rid}|${did}|${i}" title="Quitar ejercicio">${icon('x', 12)}</button>
      </div>
      ${sets.length ? `<div class="sets-list" style="margin:6px 0 6px 12px">${setsHtml}</div>` : ""}
      <div class="set-add-row mr-set-row">
        <input class="mr-set-kg" type="number" inputmode="decimal" step="0.5" placeholder="kg" />
        <input class="mr-set-reps" type="number" inputmode="numeric" placeholder="reps" />
        <button class="btn btn-primary set-add-btn" data-add-rs="${rid}|${did}|${i}">${icon('plus', 12)} Serie</button>
        <button class="btn btn-ghost set-add-btn" data-logex="${attr(e.name)}">${icon('clipboard', 12)} Hist.</button>
      </div>
    </div>`;
}

// Calendario de entrenos (reemplaza el historial plano).
function workoutHistorySection() {
  const lifts = store.lifts();
  const sessions = store.sessions();
  const routines = store.customRoutines();

  // Si no hay datos de entreno, muestra mensaje.
  if (!lifts.length && !sessions.length) {
    return `<div class="section-title" style="margin-top:28px">Calendario de entrenos</div><p class="hist-note">Aún no has registrado series. Al registrar entrenos aparecerán aquí en el calendario.</p>`;
  }

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const today = todayKey();

  // Fechas con al menos un entreno (lifts o sesión).
  const trainedDates = new Set();
  for (const l of lifts) trainedDates.add(l.date);
  for (const s of sessions) trainedDates.add(s.date);

  // Días programados según weekdays de las rutinas.
  const scheduled = {};
  const cursor = new Date(firstDay);
  while (cursor <= lastDay) {
    const wd = (cursor.getDay() + 6) % 7;
    const key = todayKey(cursor);
    const entries = [];
    for (const r of routines) {
      for (const d of r.days) {
        if (d.weekdays?.includes(wd)) {
          entries.push({ routineName: r.name, dayLabel: d.label });
        }
      }
    }
    if (entries.length) scheduled[key] = entries;
    cursor.setDate(cursor.getDate() + 1);
  }

  // Cabecera del mes.
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const monthLabel = `${monthNames[calMonth]} ${calYear}`;

  // Celdas del calendario.
  const startWD = (firstDay.getDay() + 6) % 7; // 0=Lun
  const totalDays = lastDay.getDate();
  let cells = '';

  for (let i = 0; i < startWD; i++) {
    cells += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(calYear, calMonth, day);
    const key = todayKey(date);
    const isToday = key === today;
    const isSelected = key === selDate;
    const isTrained = trainedDates.has(key);
    const isScheduled = !!scheduled[key];

    let cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isSelected) cls += ' cal-selected';
    if (isTrained) cls += ' cal-trained';
    if (!isTrained && isScheduled) cls += ' cal-scheduled';

    cells += `<div class="${cls}" data-caldate="${key}">${day}</div>`;
  }

  // Rellena la última fila para que quede cuadrada.
  const remainder = (startWD + totalDays) % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells += `<div class="cal-cell cal-empty"></div>`;
    }
  }

  // Detalle del día seleccionado.
  let detail = '';
  if (selDate) {
    const d = parseLocalDate(selDate);
    const fmt = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
    const dayLifts = lifts.filter(l => l.date === selDate);
    const daySessions = sessions.filter(s => s.date === selDate);

    detail = `<div class="card cal-detail"><div class="cal-detail-date">${cap(fmt)}</div>`;

    if (daySessions.length || dayLifts.length) {
      if (daySessions.length) {
        detail += `<div class="cal-detail-sesiones"><span class="cal-detail-label">Sesiones:</span> ${daySessions.map(s => escapeHtml(s.focus)).join(', ')}</div>`;
      }
      if (dayLifts.length) {
        const byEx = {};
        for (const l of dayLifts) {
          (byEx[l.exercise] = byEx[l.exercise] || []).push(`${l.kg}×${l.reps}`);
        }
        detail += `<div class="cal-detail-ejercicios">`;
        for (const [ex, sets] of Object.entries(byEx)) {
          detail += `<div class="wh-ex"><span class="wh-ex-name">${escapeHtml(ex)}</span><span class="wh-ex-sets">${sets.join(", ")}</span></div>`;
        }
        detail += `</div>`;
      }
    } else if (scheduled[selDate]?.length) {
      detail += `<p class="hist-note">No entrenaste este día. Tocaba: ${scheduled[selDate].map(s => `${escapeHtml(s.routineName)}: ${escapeHtml(s.dayLabel || 'Día sin etiqueta')}`).join(', ')}.</p>`;
    } else {
      detail += `<p class="hist-note">No hubo entreno este día ni estaba programado.</p>`;
    }
    detail += `</div>`;
  }

  return `
    <div class="section-title" style="margin-top:28px">Calendario de entrenos</div>
    <div class="card cal-card">
      <div class="cal-nav">
        <button class="hist-nav" data-calnav="prev">${icon('arrow-left', 18)}</button>
        <span class="cal-nav-label">${monthLabel}</span>
        <button class="hist-nav" data-calnav="next">${icon('arrow-right', 18)}</button>
      </div>
      <div class="cal-grid">
        <div class="cal-wd">L</div><div class="cal-wd">M</div><div class="cal-wd">X</div><div class="cal-wd">J</div><div class="cal-wd">V</div><div class="cal-wd">S</div><div class="cal-wd">D</div>
        ${cells}
      </div>
      <div class="cal-legend"><span class="cal-legend-dot cal-dot-trained"></span> Entrenado <span class="cal-legend-dot cal-dot-scheduled" style="margin-left:14px"></span> Programado</div>
    </div>
    ${detail}`;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function attr(s) { return String(s).replace(/"/g, "&quot;"); }

