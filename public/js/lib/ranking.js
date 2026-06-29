// Sistema de rango estilo videojuego basado en FUERZA RELATIVA:
//   ratio = 1RM estimado / peso corporal.
// Es una estimación orientativa y motivadora, no un test de laboratorio.

export const TIERS = [
  { key: "bronce", label: "Bronce", color: "#cd7f32", emoji: "🥉" },
  { key: "plata", label: "Plata", color: "#b8c2cc", emoji: "🥈" },
  { key: "oro", label: "Oro", color: "#ffd700", emoji: "🥇" },
  { key: "platino", label: "Platino", color: "#3fe0c5", emoji: "💠" },
  { key: "diamante", label: "Diamante", color: "#5b8def", emoji: "💎" },
  { key: "maestro", label: "Maestro", color: "#b06bff", emoji: "👑" },
  { key: "leyenda", label: "Leyenda", color: "#ff6b6b", emoji: "🔥" },
];

// Umbrales de ratio (1RM/peso corporal) para alcanzar, en orden:
// Plata, Oro, Platino, Diamante, Maestro, Leyenda. (Bronce = por debajo de Plata.)
// Valores para hombre; para mujer se multiplican por FEMALE_FACTOR.
// Mancuernas = por mancuerna. Maquinas/barra = peso total.
const STANDARDS = {
  "Press de banca con mancuernas": [0.25, 0.35, 0.45, 0.55, 0.65, 0.8],
  "Press inclinado con mancuernas": [0.2, 0.3, 0.4, 0.5, 0.6, 0.72],
  "Press militar con mancuernas": [0.15, 0.22, 0.3, 0.38, 0.46, 0.58],
  "Jalón al pecho": [0.5, 0.7, 0.9, 1.1, 1.3, 1.55],
  "Remo con mancuerna": [0.25, 0.35, 0.45, 0.55, 0.68, 0.85],
  "Prensa de piernas": [1.0, 1.5, 2.0, 2.6, 3.2, 4.0],
  "Hip thrust con barra": [0.75, 1.25, 1.75, 2.3, 2.9, 3.6],
  "Curl con barra": [0.3, 0.4, 0.5, 0.6, 0.72, 0.9],
};

const FEMALE_FACTOR = 0.65;

export function rankedExercises() {
  return Object.keys(STANDARDS);
}

export function isRanked(exercise) {
  return exercise in STANDARDS;
}

// Devuelve thresholds ajustados por sexo.
function thresholdsFor(exercise, sex) {
  const base = STANDARDS[exercise];
  if (!base) return null;
  const factor = sex === "female" ? FEMALE_FACTOR : 1;
  return base.map((t) => +(t * factor).toFixed(3));
}

// Calcula el rango de un ejercicio a partir del 1RM y el peso corporal.
export function rankExercise(exercise, oneRM, bodyweight, sex) {
  const thr = thresholdsFor(exercise, sex);
  if (!thr || !oneRM || !bodyweight) return null;

  const ratio = oneRM / bodyweight;
  let tierIndex = 0; // Bronce
  for (let i = 0; i < thr.length; i++) {
    if (ratio >= thr[i]) tierIndex = i + 1;
  }

  // Progreso hacia el siguiente tier y peso objetivo para subir.
  let progress = 1;
  let nextWeight = null;
  if (tierIndex < TIERS.length - 1) {
    const lower = tierIndex === 0 ? 0 : thr[tierIndex - 1];
    const upper = thr[tierIndex];
    progress = Math.max(0, Math.min(1, (ratio - lower) / (upper - lower)));
    nextWeight = +(upper * bodyweight).toFixed(1);
  }

  return {
    exercise,
    oneRM: +oneRM.toFixed(1),
    ratio: +ratio.toFixed(2),
    tierIndex,
    tier: TIERS[tierIndex],
    nextTier: TIERS[tierIndex + 1] ?? null,
    nextWeight,
    progress,
  };
}

// Rango global = media (redondeada) de los tiers de los ejercicios con datos.
export function overallRank(perExercise) {
  const valid = perExercise.filter(Boolean);
  if (!valid.length) return null;
  const avg = valid.reduce((a, r) => a + r.tierIndex, 0) / valid.length;
  const idx = Math.round(avg);
  return { tier: TIERS[idx], tierIndex: idx, avg: +avg.toFixed(2), count: valid.length };
}
