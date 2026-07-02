// Persistencia local (offline-first). Todo vive en localStorage como cache
// rapida; cuando hay sesion en la nube, cada escritura se replica a Supabase
// mediante un "sync handler" (ver cloud.js). El API del store sigue siendo
// sincrono, asi los componentes no cambian.

import { rankedExercises, rankExercise, overallRank } from "./lib/ranking.js";

let KEY = "nutveo.v1";
const DEFAULT_GOALS = { calories: 2200, protein: 150, carbs: 230, fat: 70, maintenance: 2200 };

// Espacio de nombres por usuario (para no mezclar datos de varias cuentas
// en el mismo navegador). Sin usuario => clave local generica.
function setNamespace(userId) {
  KEY = userId ? `nutveo.v1.${userId}` : "nutveo.v1";
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

// Clave de hoy (también exportada para componentes).
export { todayKey };

// Normaliza una rutina al formato por días (migra el formato antiguo de lista plana).
function normalizeRoutine(r) {
  if (Array.isArray(r.days)) {
    r.days.forEach(d => {
      if (!d.weekdays) d.weekdays = [];
      if (d.exercises) d.exercises.forEach(e => { if (!e.sets) e.sets = []; });
    });
    return { isActive: r.isActive ?? false, ...r };
  }
  return {
    id: r.id,
    name: r.name,
    isActive: r.isActive ?? false,
    days: [{ id: crypto.randomUUID(), label: "", exercises: (r.exercises ?? []).map(e => ({ ...e, sets: e.sets ?? [] })), weekdays: [] }],
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

const CREDIT_LIMITS = { scan: 2, coach: 5, workout: 2 };

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
    customRoutines: (s.customRoutines ?? []).map(normalizeRoutine), // [{id,name,isActive,days:[{id,label,exercises:[{name,muscle,sets}],weekdays}]}]
    exerciseHistory: s.exerciseHistory ?? {}, // { "exercise_name": [{ date, reps, weight }] }
    favorites: s.favorites ?? [], // [{id,name,calories,protein,carbs,fat}]
    userRecipes: s.userRecipes ?? [], // [{id,name,ingredients:[{name,grams,calories,protein,carbs,fat}]}]
    water: s.water ?? {}, // { "YYYY-MM-DD": ml }
    hideDefaultRoutine: s.hideDefaultRoutine ?? false,
    lang: s.lang ?? null, // idioma preferido (i18n)
    profile: s.profile ?? null,
    onboarded: s.onboarded ?? false,
    username: s.username ?? null,
    isPremium: s.isPremium ?? false,
    theme: s.theme ?? "dark",
    dailyUsage: s.dailyUsage ?? {},
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
      exerciseHistory: s.exerciseHistory ?? {},
      hideDefaultRoutine: s.hideDefaultRoutine ?? false,
      theme: s.theme ?? "dark",
      lang: s.lang ?? null,
      favorites: s.favorites ?? [],
      userRecipes: s.userRecipes ?? [],
      water: s.water ?? {},
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
    const cloudEntry = { ...entry };
    delete cloudEntry.photo;
    emit("meals", "upsert", cloudEntry);
    return entry;
  },

  deleteMeal(id) {
    const s = getState();
    s.meals = s.meals.filter((m) => m.id !== id);
    save(s);
    emit("meals", "delete", { id });
  },

  // Edita una comida ya registrada (nombre y macros).
  updateMeal(id, fields) {
    const s = getState();
    const m = s.meals.find((x) => x.id === id);
    if (!m) return;
    Object.assign(m, fields);
    save(s);
    const cloud = { ...m };
    delete cloud.photo;
    emit("meals", "upsert", cloud);
  },

  // ---- Consulta de historico ----
  allMeals() {
    return getState().meals;
  },

  // ---- Añadir rápido: recientes, favoritos, repetir ayer ----
  recentMeals(limit = 8) {
    const seen = new Set();
    const out = [];
    for (const m of [...getState().meals].reverse()) { // más recientes primero
      const key = (m.name || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      if (out.length >= limit) break;
    }
    return out;
  },

  favorites() {
    return getState().favorites;
  },
  addFavorite(meal) {
    const s = getState();
    if (s.favorites.some((f) => f.name.toLowerCase() === (meal.name || "").toLowerCase())) return;
    s.favorites.push({ id: crypto.randomUUID(), name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  removeFavorite(id) {
    const s = getState();
    s.favorites = s.favorites.filter((f) => f.id !== id);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  isFavorite(name) {
    return getState().favorites.some((f) => f.name.toLowerCase() === (name || "").toLowerCase());
  },

  // ---- Agua ----
  waterGoal() {
    return 2000;
  },
  water(dateKey = todayKey()) {
    return getState().water[dateKey] || 0;
  },
  addWater(ml, dateKey = todayKey()) {
    const s = getState();
    s.water[dateKey] = Math.max(0, (s.water[dateKey] || 0) + ml);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // ---- Racha de registro de nutrición ----
  nutritionStreak() {
    const days = new Set(getState().meals.map((m) => m.date));
    if (!days.size) return 0;
    const d = new Date();
    if (!days.has(todayKey(d))) {
      d.setDate(d.getDate() - 1);
      if (!days.has(todayKey(d))) return 0; // ni hoy ni ayer -> racha rota
    }
    let streak = 0;
    while (days.has(todayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  },

  // ---- Logros / medallas ----
  achievements() {
    const s = getState();
    const nut = this.nutritionStreak();
    const goalCal = s.goals?.calories || 0;
    const byDate = {};
    s.meals.forEach((m) => { byDate[m.date] = (byDate[m.date] || 0) + (m.calories || 0); });
    const hitGoal = goalCal > 0 && Object.values(byDate).some((c) => c >= goalCal * 0.9 && c <= goalCal * 1.1);
    return [
      { id: "first", icon: "utensils", label: "Primer registro", earned: s.meals.length >= 1 },
      { id: "streak7", icon: "flame", label: "Racha 7 días", earned: nut >= 7 },
      { id: "streak30", icon: "medal", label: "Racha 30 días", earned: nut >= 30 },
      { id: "goal", icon: "target", label: "Objetivo diario cumplido", earned: hitGoal },
      { id: "ai", icon: "camera", label: "Escáner con IA", earned: s.meals.some((m) => m.source === "ai") },
      { id: "recipe", icon: "book", label: "Receta propia creada", earned: (s.userRecipes || []).length >= 1 },
      { id: "train1", icon: "dumbbell", label: "Primer entreno", earned: s.sessions.length >= 1 },
      { id: "train10", icon: "award", label: "10 entrenos", earned: s.sessions.length >= 10 },
      { id: "lift", icon: "zap", label: "Primera serie registrada", earned: s.lifts.length >= 1 },
      { id: "weigh", icon: "scale", label: "Peso registrado", earned: s.weights.length >= 1 },
    ];
  },

  // ---- Recetas propias ----
  userRecipes() {
    return getState().userRecipes;
  },
  addUserRecipe(recipe) {
    const s = getState();
    s.userRecipes.push({ id: crypto.randomUUID(), name: recipe.name, ingredients: recipe.ingredients || [] });
    save(s);
    emit("profile", "upsert", profileRow(s));
  },
  deleteUserRecipe(id) {
    const s = getState();
    s.userRecipes = s.userRecipes.filter((r) => r.id !== id);
    save(s);
    emit("profile", "upsert", profileRow(s));
  },

  // Copia las comidas de ayer al día de hoy.
  repeatYesterday() {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = todayKey(y);
    const meals = getState().meals.filter((m) => m.date === yKey);
    meals.forEach((m) => this.addMeal({ name: m.name, slot: m.slot, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, source: m.source || "manual" }));
    return meals.length;
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

  unlogSession(focus, dateKey = todayKey()) {
    const s = getState();
    const before = s.sessions.length;
    s.sessions = s.sessions.filter((x) => !(x.date === dateKey && x.focus === focus));
    if (s.sessions.length !== before) { save(s); emit("sessions", "delete", { date: dateKey, focus }); }
  },

  toggleSession(focus, dateKey = todayKey()) {
    if (this.hasSessionToday(focus)) { this.unlogSession(focus, dateKey); return false; }
    else { this.logSession(focus, dateKey); return true; }
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

    const warn = (field) => console.warn(`importData: campo "${field}" no encontrado o inválido, usando valor por defecto`);

    const clean = {
      goals: obj.goals ?? DEFAULT_GOALS,
      meals: Array.isArray(obj.meals) ? obj.meals : (warn("meals"), []),
      weights: Array.isArray(obj.weights) ? obj.weights : (warn("weights"), []),
      trainingDays: obj.trainingDays ?? 3,
      lifts: Array.isArray(obj.lifts) ? obj.lifts : (warn("lifts"), []),
      sessions: Array.isArray(obj.sessions) ? obj.sessions : (warn("sessions"), []),
      customExercises: obj.customExercises ?? (warn("customExercises"), {}),
      hiddenExercises: obj.hiddenExercises ?? (warn("hiddenExercises"), {}),
      customRoutines: Array.isArray(obj.customRoutines) ? obj.customRoutines : (warn("customRoutines"), []),
      exerciseHistory: obj.exerciseHistory && typeof obj.exerciseHistory === "object" ? obj.exerciseHistory : (warn("exerciseHistory"), {}),
      hideDefaultRoutine: obj.hideDefaultRoutine ?? false,
      theme: obj.theme ?? "dark",
      lang: obj.lang ?? null,
      favorites: Array.isArray(obj.favorites) ? obj.favorites : (warn("favorites"), []),
      userRecipes: Array.isArray(obj.userRecipes) ? obj.userRecipes : (warn("userRecipes"), []),
      water: obj.water && typeof obj.water === "object" ? obj.water : (warn("water"), {}),
      profile: obj.profile ?? null,
      onboarded: obj.onboarded ?? true,
      username: obj.username ?? null,
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
    const r = { id: crypto.randomUUID(), name, days: [{ id: crypto.randomUUID(), label: "", exercises: [], weekdays: [] }] };
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
    if (r) { r.days.push({ id: crypto.randomUUID(), label: "", exercises: [], weekdays: [] }); saveRoutines(s); }
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
    if (d) { d.exercises.push({ name, muscle, sets: [] }); saveRoutines(s); }
  },
  removeExerciseFromRoutineDay(routineId, dayId, idx) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (d) { d.exercises.splice(idx, 1); saveRoutines(s); }
  },

  // Series de una fecha concreta.
  liftsOn(dateKey) {
    return getState().lifts.filter((l) => l.date === dateKey);
  },

  // Sesiones de una fecha concreta.
  sessionsOn(dateKey) {
    return getState().sessions.filter((s) => s.date === dateKey);
  },

  // ---- Rutina activa ----
  activeRoutine() {
    return getState().customRoutines.find((r) => r.isActive) ?? null;
  },

  setActiveRoutine(id) {
    const s = getState();
    s.customRoutines = s.customRoutines.map((r) => ({ ...r, isActive: r.id === id }));
    saveRoutines(s);
  },

  // ---- Series dentro de ejercicios de rutina propia ----
  addSetToRoutineExercise(routineId, dayId, exerciseIdx, weight, reps) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (!d || !d.exercises[exerciseIdx]) return;
    const ex = d.exercises[exerciseIdx];
    if (!ex.sets) ex.sets = [];
    ex.sets.push({ id: crypto.randomUUID(), weight: Number(weight), reps: Number(reps) });
    saveRoutines(s);
  },

  removeSetFromRoutineExercise(routineId, dayId, exerciseIdx, setId) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (!d || !d.exercises[exerciseIdx]) return;
    d.exercises[exerciseIdx].sets = (d.exercises[exerciseIdx].sets ?? []).filter((st) => st.id !== setId);
    saveRoutines(s);
  },

  // ---- Historial de series por ejercicio (para evolución de fuerza) ----
  logExerciseSet(exercise, weight, reps, dateKey = todayKey()) {
    const s = getState();
    if (!s.exerciseHistory) s.exerciseHistory = {};
    if (!s.exerciseHistory[exercise]) s.exerciseHistory[exercise] = [];
    s.exerciseHistory[exercise].push({ date: dateKey, weight: Number(weight), reps: Number(reps) });
    save(s);
    emit("lifts", "upsert", { id: crypto.randomUUID(), date: dateKey, exercise, kg: Number(weight), reps: Number(reps) });
    pushRankStats();
  },

  exerciseHistoryFor(exercise) {
    const s = getState();
    return (s.exerciseHistory ?? {})[exercise] ?? [];
  },

  // Asigna/desasigna un día de la semana (0=Lun…6=Dom) a un día de rutina.
  toggleRoutineDayWeekday(routineId, dayId, wd) {
    const s = getState();
    const d = findD(s, routineId, dayId);
    if (!d) return;
    if (!Array.isArray(d.weekdays)) d.weekdays = [];
    const idx = d.weekdays.indexOf(wd);
    if (idx >= 0) d.weekdays.splice(idx, 1);
    else d.weekdays.push(wd);
    saveRoutines(s);
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
      exerciseHistory: data.exerciseHistory ?? {},
      hideDefaultRoutine: data.hideDefaultRoutine ?? false,
      lang: data.lang ?? null,
      favorites: data.favorites ?? [],
      userRecipes: data.userRecipes ?? [],
      water: data.water ?? {},
      profile: data.profile ?? null,
      onboarded: data.onboarded ?? false,
      username: data.username ?? null,
      theme: data.theme ?? "dark",
      isPremium: data.isPremium ?? false,
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

  // ---- Creditos / Límites diarios ----
  isPremium() {
    return getState().isPremium;
  },

  setPremium(v) {
    const s = getState();
    s.isPremium = !!v;
    save(s);
  },

  // ---- Tema (claro/oscuro) ----
  theme() {
    return getState().theme;
  },
  setTheme(t) {
    const s = getState();
    s.theme = t;
    save(s);
  },

  remainingCredits(action) {
    if (getState().isPremium) return Infinity;
    const today = todayKey();
    const usage = getState().dailyUsage;
    const used = usage[today]?.[action] ?? 0;
    return Math.max(0, (CREDIT_LIMITS[action] ?? 0) - used);
  },

  canUse(action) {
    return this.remainingCredits(action) > 0;
  },

  useCredit(action) {
    if (getState().isPremium) return;
    const s = getState();
    const today = todayKey();
    if (!s.dailyUsage[today]) s.dailyUsage[today] = {};
    s.dailyUsage[today][action] = (s.dailyUsage[today][action] ?? 0) + 1;
    save(s);
  },
};

export const SLOTS = [
  { id: "breakfast", label: "Desayuno", ico: "sunrise" },
  { id: "lunch", label: "Almuerzo", ico: "sun" },
  { id: "dinner", label: "Cena", ico: "moon" },
  { id: "snacks", label: "Snacks", ico: "cookie" },
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
