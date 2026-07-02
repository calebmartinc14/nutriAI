// Sincronización con Supabase. Traduce las escrituras del store a la BD y
// descarga los datos del usuario al iniciar sesión.
import { getSupabase } from "./lib/supabase.js";
import { store } from "./store.js";
import { setLang } from "./lib/i18n.js";

let USER_ID = null;

// Descarga todos los datos del usuario y los vuelca en el store local.
export async function pullAll(user) {
  USER_ID = user.id;
  store.setNamespace(user.id);

  const sb = await getSupabase();
  const [profile, meals, weights, lifts, sessions, stats] = await Promise.all([
    sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    sb.from("meals").select("*").eq("user_id", user.id),
    sb.from("weights").select("*").eq("user_id", user.id),
    sb.from("lifts").select("*").eq("user_id", user.id),
    sb.from("sessions").select("*").eq("user_id", user.id),
    sb.from("public_stats").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const p = profile.data;
  const username =
    stats.data?.username ?? user.user_metadata?.username ?? (user.email ?? "").split("@")[0];

  store.replaceAll({
    profile: p
      ? { sex: p.sex, age: p.age, height: p.height, weight: p.weight, activity: p.activity, goal: p.goal }
      : null,
    isPremium: p?.is_premium ?? false,
    goals: p?.goals ?? undefined,
    trainingDays: p?.training_days ?? 3,
    onboarded: p?.onboarded ?? false,
    customExercises: p?.routine?.custom ?? {},
    hiddenExercises: p?.routine?.hidden ?? {},
    customRoutines: p?.routine?.customRoutines ?? [],
    hideDefaultRoutine: p?.routine?.hideDefaultRoutine ?? false,
    lang: p?.routine?.lang ?? null,
    favorites: p?.routine?.favorites ?? [],
    userRecipes: p?.routine?.userRecipes ?? [],
    water: p?.routine?.water ?? {},
    username,
    meals: (meals.data ?? []).map((m) => ({
      id: m.id, date: m.date, name: m.name, slot: m.slot,
      calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
      source: m.source, photo: null,
    })),
    weights: (weights.data ?? []).map((w) => ({ date: w.date, kg: w.kg })),
    lifts: (lifts.data ?? []).map((l) => ({ id: l.id, date: l.date, exercise: l.exercise, kg: l.kg, reps: l.reps })),
    sessions: (sessions.data ?? []).map((x) => ({ id: x.id, date: x.date, focus: x.focus })),
  });

  // Propaga el idioma remoto al módulo i18n (variable de módulo).
  const remoteLang = store.lang();
  if (remoteLang) {
    setLang(remoteLang);
  }

  // Asegura que el nombre y stats existan en la nube (primer login).
  store.setUsername(username);
  await push("public_stats", "upsert", store.publicStatsRow());
}

// Handler que registra el store: cada cambio local se replica a Supabase.
export async function push(entity, op, data) {
  if (!USER_ID) return;
  const sb = await getSupabase();
  const row = { ...data, user_id: USER_ID };

  try {
    if (entity === "meals") {
      if (op === "delete") await sb.from("meals").delete().eq("id", data.id).eq("user_id", USER_ID);
      else await sb.from("meals").upsert(row, { onConflict: "id" });
    } else if (entity === "weights") {
      if (op === "delete") await sb.from("weights").delete().eq("date", data.date).eq("user_id", USER_ID);
      else await sb.from("weights").upsert(row, { onConflict: "user_id,date" });
    } else if (entity === "lifts") {
      if (op === "delete") await sb.from("lifts").delete().eq("id", data.id).eq("user_id", USER_ID);
      else await sb.from("lifts").upsert(row, { onConflict: "id" });
    } else if (entity === "sessions") {
      await sb.from("sessions").upsert(row, { onConflict: "id" });
    } else if (entity === "profile") {
      await sb.from("profiles").upsert(row, { onConflict: "user_id" });
    } else if (entity === "public_stats") {
      await sb.from("public_stats").upsert(row, { onConflict: "user_id" });
    }
  } catch (e) {
    console.warn("cloud push fallo:", entity, op, e);
  }
}

// ---- Ligas ----
export async function createLeague(name) {
  const sb = await getSupabase();
  const code = crypto.randomUUID().slice(0, 6).toUpperCase();
  const { data, error } = await sb.from("leagues").insert({ name, code, owner_id: USER_ID }).select().single();
  if (error) throw error;
  await joinLeague(code);
  return data;
}

export async function joinLeague(code) {
  const sb = await getSupabase();
  const { data: leagueId, error } = await sb.rpc("join_league_by_code", { p_code: code });
  if (error) throw error;
  const { data: league } = await sb.from("leagues").select("*").eq("id", leagueId).single();
  return league;
}

export async function myLeagues() {
  const sb = await getSupabase();
  const { data: mem } = await sb.from("league_members").select("league_id").eq("user_id", USER_ID);
  const ids = (mem ?? []).map((m) => m.league_id);
  if (!ids.length) return [];
  const { data } = await sb.from("leagues").select("*").in("id", ids);
  return data ?? [];
}

// Clasificación de una liga: miembros ordenados por rango.
export async function leagueLeaderboard(leagueId) {
  const sb = await getSupabase();
  const { data: members } = await sb.from("league_members").select("user_id").eq("league_id", leagueId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return [];
  const { data: stats } = await sb.from("public_stats").select("*").in("user_id", ids);
  return (stats ?? []).sort((a, b) => b.score - a.score || b.sessions_total - a.sessions_total);
}
