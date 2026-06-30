// Persistencia local (offline-first). Todo vive en localStorage como cache
// rapida; cuando hay sesion en la nube, cada escritura se replica a Supabase
// mediante un "sync handler" (ver cloud.js). El API del store sigue siendo
// sincrono, asi los componentes no cambian.

import { rankedExercises, rankExercise, overallRank } from "./lib/ranking.js";

let KEY = "nutriai.v1";
const DEFAULT_GOALS = { calories: 2200, protein: 150, carbs: 230, fat: 70, maintenance: 2200 };

// Espacio de nombres por usuario (para no mezclar datos de varias cuentas
// en el mismo navegador). Sin usuario => clave local generica.
function setNamespace(userId) {
  KEY = userId ? `nutriai.v1.${userId}` : "nutriai.v1";
}

// Handler de sincronizacion con la nube. cloud.js lo registra tras el login.
// Firma: (entity, op, data)  ej. ("meals", "upsert", entry)
let syncHandler = null;
function setSyncHandler(fn) {
  syncHandler = fn;
}
function emit(entity, op, data) {
  try {
    syncHandler?.(entity, op, data);
  } catch (e) {
    console.warn("sync error", e);
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// Clave de día en hora LOCAL del usuario (NO UTC). Evita el desfase de 1 día:
// toISOString() convierte a UTC y para husos > 0 (ej. España) la noche se
// guardaba/mostraba como el día siguiente. Aquí usamos los componentes locales.
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parsea una clave "YYYY-MM-DD" como fecha LOCAL (no UTC) para mostrar/calcular.
export function parseLocalDate(key) {
  return new Date(`${key}T00:00:00`);
}

// Normaliza una rutina al formato por días (migra el formato antiguo de lista plana).
function normalizeRoutine(r) {
  if (Array.isArray(r.days)) return r;
  return {
    id: r.id,
    name: r.name,
    days: [{ id: crypto.randomUUID(), label: "", exercises: r.exercises ?? [] }],
  };
}

// Helpers para rutinas por días.
function findR(s, id) {
  return s.customRoutines.find((r) => r.id === id);
}
function findD(s, rid, did) {
  const r = findR(s, rid);
  return r ? r.days.find((d) => d.id === did) : null;
}
function saveRoutines(s) {
  save(s);
  emit("profile", "upsert", profileRow(s));
}

function getState() {
  const s = load();
  return {
    goals: s.goals ?? DEFAULT_GOALS,
    meals: s.meals ?? [],
    weights: s.weights ?? [], // [{ date: "YYYY-MM-DD", kg: number }]
    trainingDays: s.trainingDays ?? 3, // dias de entreno por semana
    lifts: s.lifts ?? [], // [{ id, date, exercise, kg, reps }] una fila por SERIE
    sessions: s.sessions ?? [], // [{ date, focus }] entrenos completados
    customExercises: s.customExercises ?? {}, // { focus: [{id,name,muscle}] }
    hiddenExercises: s.hiddenExercises ?? {}, // { focus: [name, ...] }
    customRoutines: (s.customRoutines ?? []).map(normalizeRoutine), // [{id,name,days:[{id,label,exercises}]}]
    hideDefaultRoutine: s.hideDefaultRoutine ?? false,
    lang: s.lang ?? null, // idioma preferido (i18n)
    profile: s.profile ?? null,
    onboarded: s.onboarded ?? false,
    username: s.username ?? null,
  };
}

// ---------------------------------------------------------------------------
// Calculo de calorias y macros a partir del perfil del usuario.
//   - Metabolismo basal (BMR): formula Mifflin-St Jeor.
//   - Mantenimiento (TDEE): BMR x factor de actividad.
//   - Objetivo: ajuste segun meta (deficit / superavit).
//   - Macros: proteina por kg de peso, grasa ~27% kcal, resto carbohidratos.
// ---------------------------------------------------------------------------
const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};

export function computeTargets(p) {
  const weight = Number(p.weight);
  const height = Number(p.height);
  const age = Number(p.age);

  const bmr =
    p.sex === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;

  const maintenance = bmr * (ACTIVITY_FACTORS[p.activity] ?? 1.2);

  let calories = maintenance;
  if (p.goal === "lose") calories = maintenance - 500;
  else if (p.goal === "gain") calories = maintenance + 350;
  calories = Math.max(1200, Math.round(calories));

  // Proteina mas alta en corte/volumen para preservar/ganar musculo.
  const protein = Math.round((p.goal === "maintain" ? 1.8 : 2.0) * weight);
  const fatKcal = calories * 0.27;
  const fat = Math.round(fatKcal / 9);
  const carbsKcal = Math.max(0, calories - protein * 4 - fatKcal);
  const carbs = Math.round(carbsKcal / 4);

  return { calories, protein, carbs, fat, maintenance: Math.round(maintenance) };
}

// ---------------------------------------------------------------------------
// Filas que se sincronizan a la nube.
// ---------------------------------------------------------------------------
function profileRow(s) {
  return {
    sex: s.profile?.sex ?? null,
    age: s.profile?.age ?? null,
    height: s.profile?.height ?? null,
    weight: s.profile?.weight ?? null,
    activity: s.profile?.activity ?? null,
    goal: s.profile?.goal ?? null,
    training_days: s.trainingDays ?? 3,
    goals: s.goals ?? null,
    onboarded: s.onboarded ?? false,
    // Personalización (ejercicios propios/ocultos, rutinas propias, idioma) -> se sincroniza.
    routine: {
      custom: s.customExercises ?? {},
      hidden: s.hiddenExercises ?? {},
      customRoutines: s.customRoutines ?? [],
      hideDefaultRoutine: s.hideDefaultRoutine ?? false,
      lang: s.lang ?? null,
    },
  };
}

// Resumen de fuerza para el leaderboard (calculado en cliente).
function computeRankSummary(s) {
  const bodyweight = [...(s.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? s.profile?.weight ?? 0;
  const sex = s.profile?.sex ?? "male";
  const per = rankedExercises().map((ex) => {
    const lifts = (s.lifts ?? []).filter((l) => l.exercise === ex);
    if (!lifts.length) return null;
    const oneRM = Math.max(...lifts.map((l) => l.kg * (1 + (l.reps || 1) / 30)));
    return rankExercise(ex, oneRM, bodyweight, sex);
  });
  return overallRank(per.filter(Boolean));
}

function publicStatsRow(s) {
  const r = computeRankSummary(s);
  const bodyweight = [...(s.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? s.profile?.weight ?? null;
  return {
    username: s.username ?? null,
    rank_index: r?.tierIndex ?? 0,
    rank_label: r?.tier?.label ?? "Sin rango",
    score: r ? +r.avg.toFixed(2) : 0,
    bodyweight,
    sessions_total: (s.sessions ?? []).length,
    updated_at: new Date().toISOString(),
  };
}

// Recalcula y sincroniza el resumen de rango publico.
function pushRankStats() {
  emit("public_stats", "upsert", publicStatsRow(getState()));
}

export const store = {
  get: getState,

  meals(date = todayKey()) {
    return getState().meals.filter((m) => m.date === date);
  },

  addMeal(meal) {
    const s = getState();
    const entry = {
      id: crypto.randomUUID(),
      date: todayKey(),
      source: "manual",
      ...meal,
    };
    s.meals.push(entry);
    save(s);
    // La foto (base64) no se sube a la nube para no inflar la BD: solo local.
    const { photo, ...cloudEntry } = entry;
    emit("meals", "upsert", cloudEntry);
    return entry;
  },

  deleteMeal(id) {
    const s = getState();
    s.meals = s.meals.filter((m) => m.id !== id);
    save(s);
    emit("meals", "delete", { id });
  },

  // ---- Consulta de historico ----
  allMeals() {
    return getState().meals;
  },

  mealsOn(dateKey) {
    return getState().meals.filter((m) => m.date === dateKey);
  },

  // ---- Seguimiento de peso ----
  weights() {
    // Ordenado por fecha ascendente.
    return [...getState().weights].sort((a, b) => a.date.localeCompare(b.date));
  },

  // Registra (o actualiza) el peso de un dia. Un valor por dia.
  addWeight(kg, dateKey = todayKey()) {
    const s = getState();
    const idx = s.weights.findIndex((w) => w.date === dateKey);
    if (idx >= 0) s.weights[idx].kg = kg;
    else s.weights.push({ date: dateKey, kg });
    save(s);
    emit("weights", "upsert", { date: dateKey, kg });
    // El peso corporal cambia el ratio de fuerza -> recalcular rango publico.
    pushRankStats();
  },

  deleteWeight(dateKey) {
    const s = getState();
    s.weights = s.weights.filter((w) => w.date !== dateKey);
    save(s);
    emit("weights", "delete", { date: dateKey });
    pushRankStats();
  },

  // ---- Entrenamiento ----
  trainingDays() {
    return getState().trainingDays;
  },

  setTrainingDays(n) {
    const s = getState();
    s.trainingDays = n;
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // ---- Registros de fuerza (peso levantado por ejercicio) ----
  addLift(exercise, kg, reps, dateKey = todayKey()) {
    const s = getState();
    const entry = { id: crypto.randomUUID(), date: dateKey, exercise, kg: Number(kg), reps: Number(reps) };
    s.lifts.push(entry);
    save(s);
    emit("lifts", "upsert", entry);
    pushRankStats(); // un nuevo PR puede cambiar tu rango en la liga
  },

  lifts() {
    return getState().lifts;
  },

  liftsFor(exercise) {
    return getState()
      .lifts.filter((l) => l.exercise === exercise)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  lastLift(exercise) {
    return this.liftsFor(exercise).at(-1) ?? null;
  },

  // Todas las series de un ejercicio en un día concreto (para multi-serie).
  liftsForDay(exercise, dateKey = todayKey()) {
    return getState().lifts.filter((l) => l.exercise === exercise && l.date === dateKey);
  },

  deleteLiftById(id) {
    const s = getState();
    const idx = s.lifts.findIndex((l) => l.id === id);
    if (idx >= 0) {
      s.lifts.splice(idx, 1);
      save(s);
      emit("lifts", "delete", { id });
      pushRankStats();
    }
  },

  // ---- Personalización de la rutina (local) ----
  customExercises() {
    return getState().customExercises;
  },
  hiddenExercises() {
    return getState().hiddenExercises;
  },
  addCustomExercise(focus, name, muscle = "") {
    const s = getState();
    s.customExercises[focus] = s.customExercises[focus] ?? [];
    s.customExercises[focus].push({ id: crypto.randomUUID(), name, muscle });
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  removeCustomExercise(focus, id) {
    const s = getState();
    s.customExercises[focus] = (s.customExercises[focus] ?? []).filter((c) => c.id !== id);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  hideExercise(focus, name) {
    const s = getState();
    s.hiddenExercises[focus] = s.hiddenExercises[focus] ?? [];
    if (!s.hiddenExercises[focus].includes(name)) s.hiddenExercises[focus].push(name);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  unhideExercise(focus, name) {
    const s = getState();
    s.hiddenExercises[focus] = (s.hiddenExercises[focus] ?? []).filter((n) => n !== name);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // Mejor 1RM estimado (formula de Epley) para un ejercicio.
  bestOneRM(exercise) {
    const lifts = this.liftsFor(exercise);
    if (!lifts.length) return 0;
    return Math.max(...lifts.map((l) => l.kg * (1 + (l.reps || 1) / 30)));
  },

  // ---- Sesiones de entreno completadas (racha) ----
  logSession(focus, dateKey = todayKey()) {
    const s = getState();
    const exists = s.sessions.some((x) => x.date === dateKey && x.focus === focus);
    if (!exists) {
      const entry = { id: crypto.randomUUID(), date: dateKey, focus };
      s.sessions.push(entry);
      save(s);
      emit("sessions", "upsert", entry);
    }
    return !exists;
  },

  hasSessionToday(focus) {
    const day = todayKey();
    return getState().sessions.some((x) => x.date === day && x.focus === focus);
  },

  sessions() {
    return getState().sessions;
  },

  sessionsThisWeek() {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return getState().sessions.filter((x) => parseLocalDate(x.date) >= monday).length;
  },

  // Racha de semanas consecutivas (hasta hoy) con al menos un entreno.
  weekStreak() {
    const dates = getState().sessions.map((x) => x.date);
    if (!dates.length) return 0;
    const weekId = (d) => {
      const dt = parseLocalDate(d);
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      return todayKey(dt);
    };
    const weeks = new Set(dates.map(weekId));
    let streak = 0;
    const cursor = new Date();
    while (weeks.has(weekId(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
  },

  // ---- Copia de seguridad ----
  exportData() {
    return JSON.stringify(load(), null, 2);
  },

  importData(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Archivo no válido");
    // Validacion minima de forma
    const clean = {
      goals: obj.goals ?? DEFAULT_GOALS,
      meals: Array.isArray(obj.meals) ? obj.meals : [],
      weights: Array.isArray(obj.weights) ? obj.weights : [],
      trainingDays: obj.trainingDays ?? 3,
      lifts: Array.isArray(obj.lifts) ? obj.lifts : [],
      sessions: Array.isArray(obj.sessions) ? obj.sessions : [],
      customExercises: obj.customExercises ?? {},
      hiddenExercises: obj.hiddenExercises ?? {},
      profile: obj.profile ?? null,
      onboarded: obj.onboarded ?? true,
    };
    save(clean);
  },

  goals() {
    return getState().goals;
  },

  setGoals(goals) {
    const s = getState();
    s.goals = { ...s.goals, ...goals };
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // ---- Perfil / onboarding ----
  profile() {
    return getState().profile;
  },

  isOnboarded() {
    return getState().onboarded;
  },

  // Guarda el perfil, calcula objetivos y marca el onboarding como hecho.
  saveProfile(profile) {
    const s = getState();
    s.profile = profile;
    s.goals = computeTargets(profile);
    s.onboarded = true;
    // Registra el peso de hoy a partir del perfil (un valor por dia).
    if (profile.weight) {
      const day = todayKey();
      const idx = s.weights.findIndex((w) => w.date === day);
      if (idx >= 0) s.weights[idx].kg = Number(profile.weight);
      else s.weights.push({ date: day, kg: Number(profile.weight) });
    }
    save(s);
    emit("profile", "upsert", profileRow(s));
    if (profile.weight) emit("weights", "upsert", { date: todayKey(), kg: Number(profile.weight) });
    pushRankStats();
    return s.goals;
  },

  // ---- Idioma (i18n) ----
  lang() {
    return getState().lang;
  },
  setLang(l) {
    const s = getState();
    s.lang = l;
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // ---- Rutinas propias ----
  customRoutines() {
    return getState().customRoutines.map(normalizeRoutine);
  },
  addRoutine(name) {
    const s = getState();
    const r = { id: crypto.randomUUID(), name, days: [{ id: crypto.randomUUID(), label: "", exercises: [] }] };
    s.customRoutines.push(r);
    saveRoutines(s);
    return r;
  },
  setRoutineName(routineId, name) {
    const s = getState();
    const r = findR(s, routineId);
    if (r) { r.name = name; saveRoutines(s); }
  },
  deleteRoutine(id) {
    const s = getState();
    s.customRoutines = s.customRoutines.map(normalizeRoutine).filter((r) => r.id !== id);
    saveRoutines(s);
  },
  addRoutineDay(routineId) {
    const s = getState();
    const r = findR(s, routineId);
    if (r) { r.days.push({ id: crypto.randomUUID(), label: "", exercises: [] }); saveRoutines(s); }
  },
  deleteRoutineDay(routineId, dayId) {
    const s = getState();
    const r = findR(s, routineId);
    if (r) { r.days = r.days.filter((d) => d.id !== dayId); saveRoutines(s); }
  },
  setRoutineDayLabel(routineId, dayId, label) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (d) { d.label = label; saveRoutines(s); }
  },
  addExerciseToRoutineDay(routineId, dayId, name, muscle = "") {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (d) { d.exercises.push({ name, muscle }); saveRoutines(s); }
  },
  removeExerciseFromRoutineDay(routineId, dayId, idx) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (d) { d.exercises.splice(idx, 1); saveRoutines(s); }
  },
  hideDefaultRoutine() {
    return getState().hideDefaultRoutine;
  },
  setHideDefaultRoutine(v) {
    const s = getState();
    s.hideDefaultRoutine = !!v;
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // ---- Identidad / nube ----
  setNamespace,
  setSyncHandler,

  setUsername(name) {
    const s = getState();
    s.username = name;
    save(s);
  },

  username() {
    return getState().username;
  },

  // Vuelca todo el estado (para subir el primer set de datos a la nube).
  snapshot() {
    return load();
  },

  // Reemplaza el estado local con lo descargado de la nube (tras login).
  replaceAll(data) {
    save({
      goals: data.goals ?? DEFAULT_GOALS,
      meals: data.meals ?? [],
      weights: data.weights ?? [],
      trainingDays: data.trainingDays ?? 3,
      lifts: data.lifts ?? [],
      sessions: data.sessions ?? [],
      customExercises: data.customExercises ?? {},
      hiddenExercises: data.hiddenExercises ?? {},
      customRoutines: data.customRoutines ?? [],
      hideDefaultRoutine: data.hideDefaultRoutine ?? false,
      lang: data.lang ?? null,
      profile: data.profile ?? null,
      onboarded: data.onboarded ?? false,
      username: data.username ?? null,
    });
  },

  // Resumen de rango para la liga (lo consume cloud.js y la pestaña Liga).
  rankSummary() {
    return computeRankSummary(getState());
  },

  profileRow() {
    return profileRow(getState());
  },

  publicStatsRow() {
    return publicStatsRow(getState());
  },

  // Calorias de los ultimos 7 dias (lunes->domingo de la semana actual).
  weeklyCalories() {
    const now = new Date();
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - offset);
    const all = getState().meals;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = todayKey(d);
      return all
        .filter((m) => m.date === key)
        .reduce((acc, m) => acc + (m.calories || 0), 0);
    });
  },

  todayIndex() {
    return (new Date().getDay() + 6) % 7;
  },
};

export const SLOTS = [
  { id: "breakfast", label: "Desayuno", ico: "🌅" },
  { id: "lunch", label: "Almuerzo", ico: "🍱" },
  { id: "dinner", label: "Cena", ico: "🍽️" },
  { id: "snacks", label: "Snacks", ico: "🍪" },
];

export function sumMacros(meals) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
