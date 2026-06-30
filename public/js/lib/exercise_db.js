// Base de datos de ejercicios.
// Fuente principal: free-exercise-db (dominio público) vía jsDelivr, con
// imágenes reales del movimiento. Si el CDN falla, usa una lista local de
// respaldo para que el explorador siga funcionando offline.
//
// Respeta la preferencia del usuario: se excluyen sentadilla y peso muerto.

const DB_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
export const IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
const CACHE_KEY = "nutriai.exdb.v1";
const CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 días

// Etiquetas en español para los filtros.
export const MUSCLE_LABELS = {
  chest: "Pecho", back: "Espalda", lats: "Dorsales", "middle back": "Espalda media",
  "lower back": "Lumbares", shoulders: "Hombros", traps: "Trapecio",
  biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos",
  quadriceps: "Cuádriceps", hamstrings: "Isquios", glutes: "Glúteos",
  calves: "Gemelos", abdominals: "Abdomen", abductors: "Abductores",
  adductors: "Aductores", neck: "Cuello",
};
export const EQUIP_LABELS = {
  dumbbell: "Mancuerna", barbell: "Barra", cable: "Polea", machine: "Máquina",
  "body only": "Peso corporal", kettlebells: "Kettlebell", bands: "Banda",
  "medicine ball": "Balón medicinal", "exercise ball": "Fitball",
  "e-z curl bar": "Barra Z", "foam roll": "Foam roller", other: "Otro",
};

const EXCLUDE = /squat|deadlift|sentadilla|peso muerto/i;

let cache = null;

export async function loadExerciseDB() {
  if (cache) return cache;

  // 1) Cache local
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (raw && Date.now() - raw.t < CACHE_TTL && Array.isArray(raw.data)) {
      cache = raw.data;
      return cache;
    }
  } catch { /* ignore */ }

  // 2) CDN
  try {
    const res = await fetch(DB_URL);
    if (!res.ok) throw new Error("fetch fallo");
    const list = await res.json();
    cache = list
      .filter((e) => e?.name && !EXCLUDE.test(e.name))
      .map((e) => ({
        id: e.id,
        name: e.name,
        muscle: (e.primaryMuscles && e.primaryMuscles[0]) || "other",
        equipment: e.equipment || "other",
        level: e.level || "",
        images: Array.isArray(e.images) ? e.images : [],
        instructions: Array.isArray(e.instructions) ? e.instructions : [],
      }));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: cache })); } catch { /* quota */ }
    return cache;
  } catch {
    // 3) Respaldo local
    cache = FALLBACK;
    return cache;
  }
}

// Listas de valores presentes (para construir los filtros) a partir de los datos.
export function muscleOptions(list) {
  return [...new Set(list.map((e) => e.muscle))].filter(Boolean).sort();
}
export function equipOptions(list) {
  return [...new Set(list.map((e) => e.equipment))].filter(Boolean).sort();
}

export function youtubeSearch(name) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent("como hacer " + name + " tecnica")}`;
}

// Respaldo mínimo (sin imágenes; usa el botón de YouTube). Sin squat/deadlift.
const FALLBACK = [
  { id: "fb1", name: "Press de banca con mancuernas", muscle: "chest", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb2", name: "Press inclinado con mancuernas", muscle: "chest", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb3", name: "Aperturas en pec-deck", muscle: "chest", equipment: "machine", images: [], instructions: [] },
  { id: "fb4", name: "Fondos en paralelas", muscle: "triceps", equipment: "body only", images: [], instructions: [] },
  { id: "fb5", name: "Press militar con mancuernas", muscle: "shoulders", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb6", name: "Elevaciones laterales", muscle: "shoulders", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb7", name: "Face pull", muscle: "shoulders", equipment: "cable", images: [], instructions: [] },
  { id: "fb8", name: "Jalón al pecho", muscle: "lats", equipment: "cable", images: [], instructions: [] },
  { id: "fb9", name: "Remo con mancuerna", muscle: "back", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb10", name: "Remo en máquina", muscle: "back", equipment: "machine", images: [], instructions: [] },
  { id: "fb11", name: "Pull-over en polea", muscle: "lats", equipment: "cable", images: [], instructions: [] },
  { id: "fb12", name: "Curl con barra", muscle: "biceps", equipment: "barbell", images: [], instructions: [] },
  { id: "fb13", name: "Curl martillo", muscle: "biceps", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb14", name: "Extensión de tríceps en polea", muscle: "triceps", equipment: "cable", images: [], instructions: [] },
  { id: "fb15", name: "Press francés", muscle: "triceps", equipment: "barbell", images: [], instructions: [] },
  { id: "fb16", name: "Prensa de piernas", muscle: "quadriceps", equipment: "machine", images: [], instructions: [] },
  { id: "fb17", name: "Extensión de cuádriceps", muscle: "quadriceps", equipment: "machine", images: [], instructions: [] },
  { id: "fb18", name: "Curl femoral tumbado", muscle: "hamstrings", equipment: "machine", images: [], instructions: [] },
  { id: "fb19", name: "Hip thrust con barra", muscle: "glutes", equipment: "barbell", images: [], instructions: [] },
  { id: "fb20", name: "Zancadas con mancuernas", muscle: "quadriceps", equipment: "dumbbell", images: [], instructions: [] },
  { id: "fb21", name: "Elevación de gemelos", muscle: "calves", equipment: "machine", images: [], instructions: [] },
  { id: "fb22", name: "Plancha", muscle: "abdominals", equipment: "body only", images: [], instructions: [] },
  { id: "fb23", name: "Crunch en polea", muscle: "abdominals", equipment: "cable", images: [], instructions: [] },
  { id: "fb24", name: "Abductor en máquina", muscle: "glutes", equipment: "machine", images: [], instructions: [] },
];
