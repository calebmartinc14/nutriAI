// Recetas dinámicas: se recalculan los gramos según el objetivo de macros
// del usuario para esa comida. Incluye recetas de ejemplo (sin depender de BD).

// Resuelve A·x = b (3x3) por eliminación gaussiana con pivoteo.
function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

// ingredientes: [{ nombre, prod:{kcal,p,c,f por 100g}, rol:'protein|carb|fat|free', w, gramosFijos }]
// objetivo: { p, c, f } gramos para esa comida
export function escalarReceta(ingredientes, objetivo) {
  const cats = ["protein", "carb", "fat"];
  const items = {}, coef = {};
  for (const cat of cats) {
    const list = ingredientes.filter((i) => i.rol === cat);
    items[cat] = list;
    const tw = list.reduce((a, i) => a + (i.w || 1), 0) || 1;
    coef[cat] = { p: 0, c: 0, f: 0 };
    for (const it of list) {
      const s = (it.w || 1) / tw;
      coef[cat].p += (s * it.prod.p) / 100;
      coef[cat].c += (s * it.prod.c) / 100;
      coef[cat].f += (s * it.prod.f) / 100;
    }
  }
  let P0 = 0, C0 = 0, F0 = 0;
  for (const it of ingredientes.filter((i) => i.rol === "free")) {
    const g = it.gramosFijos || 0;
    P0 += (it.prod.p * g) / 100; C0 += (it.prod.c * g) / 100; F0 += (it.prod.f * g) / 100;
  }
  const A = [
    [coef.protein.p, coef.carb.p, coef.fat.p],
    [coef.protein.c, coef.carb.c, coef.fat.c],
    [coef.protein.f, coef.carb.f, coef.fat.f],
  ];
  const sol = solve3(A, [objetivo.p - P0, objetivo.c - C0, objetivo.f - F0]).map((g) => (isFinite(g) ? Math.max(0, g) : 0));
  const G = { protein: sol[0], carb: sol[1], fat: sol[2] };

  const out = [];
  for (const cat of cats) {
    const tw = items[cat].reduce((a, i) => a + (i.w || 1), 0) || 1;
    for (const it of items[cat]) out.push({ nombre: it.nombre, gramos: Math.round((G[cat] * (it.w || 1)) / tw), prod: it.prod });
  }
  for (const it of ingredientes.filter((i) => i.rol === "free"))
    out.push({ nombre: it.nombre, gramos: it.gramosFijos || 0, prod: it.prod });
  return out;
}

// Suma macros/kcal de un plan de ingredientes ya escalado.
export function totalesPlan(plan) {
  return plan.reduce(
    (a, it) => {
      const f = it.gramos / 100;
      a.calories += (it.prod.kcal || 0) * f;
      a.protein += (it.prod.p || 0) * f;
      a.carbs += (it.prod.c || 0) * f;
      a.fat += (it.prod.f || 0) * f;
      return a;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// Macros por 100 g de alimentos base.
const A = {
  pollo: { kcal: 165, p: 31, c: 0, f: 3.6 },
  arrozC: { kcal: 130, p: 2.7, c: 28, f: 0.3 },
  pasta: { kcal: 158, p: 6, c: 31, f: 0.9 },
  ternera: { kcal: 250, p: 26, c: 0, f: 15 },
  salmon: { kcal: 208, p: 20, c: 0, f: 13 },
  huevo: { kcal: 155, p: 13, c: 1.1, f: 11 },
  atun: { kcal: 132, p: 28, c: 0, f: 1 },
  aceite: { kcal: 884, p: 0, c: 0, f: 100 },
  aguacate: { kcal: 160, p: 2, c: 9, f: 15 },
  pan: { kcal: 265, p: 9, c: 49, f: 3.2 },
  avena: { kcal: 389, p: 17, c: 66, f: 7 },
  yogurG: { kcal: 59, p: 10, c: 3.6, f: 0.4 },
  verdura: { kcal: 35, p: 2, c: 5, f: 0.3 },
  tomate: { kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  platano: { kcal: 89, p: 1.1, c: 23, f: 0.3 },
  patata: { kcal: 77, p: 2, c: 17, f: 0.1 },
  queso: { kcal: 350, p: 25, c: 1.3, f: 28 },
};

const RECIPE_ICONS = { r1: "utensils", r2: "award", r3: "sunrise", r4: "utensils", r5: "sun" };

export const RECIPES = [
  {
    id: "r1", titulo: "Bowl de pollo y arroz", comida: "almuerzo", icon: "utensils",
    pasos: ["Cocina el arroz.", "Haz el pollo a la plancha.", "Saltea las verduras con el aceite.", "Monta el bowl y añade el aguacate."],
    ingredientes: [
      { nombre: "Pollo", prod: A.pollo, rol: "protein", w: 1 },
      { nombre: "Arroz (cocido)", prod: A.arrozC, rol: "carb", w: 1 },
      { nombre: "Aceite de oliva", prod: A.aceite, rol: "fat", w: 1 },
      { nombre: "Verduras", prod: A.verdura, rol: "free", gramosFijos: 150 },
    ],
  },
  {
    id: "r2", titulo: "Salmón con patata", comida: "cena", icon: "award",
    pasos: ["Hornea el salmón.", "Cuece o asa la patata.", "Aliña con aceite y verduras."],
    ingredientes: [
      { nombre: "Salmón", prod: A.salmon, rol: "fat", w: 1 },
      { nombre: "Patata", prod: A.patata, rol: "carb", w: 1 },
      { nombre: "Atún (extra proteína)", prod: A.atun, rol: "protein", w: 1 },
      { nombre: "Verduras", prod: A.verdura, rol: "free", gramosFijos: 150 },
    ],
  },
  {
    id: "r3", titulo: "Avena proteica con plátano", comida: "desayuno", icon: "sunrise",
    pasos: ["Mezcla la avena con el yogur.", "Añade el plátano troceado.", "Top de mantequilla de cacahuete (aceite/grasa)."],
    ingredientes: [
      { nombre: "Yogur griego", prod: A.yogurG, rol: "protein", w: 1 },
      { nombre: "Avena", prod: A.avena, rol: "carb", w: 1 },
      { nombre: "Crema de cacahuete", prod: A.aceite, rol: "fat", w: 1 },
      { nombre: "Plátano", prod: A.platano, rol: "free", gramosFijos: 120 },
    ],
  },
  {
    id: "r4", titulo: "Pasta con ternera", comida: "almuerzo", icon: "utensils",
    pasos: ["Cuece la pasta.", "Sofríe la ternera con tomate.", "Mezcla y sirve."],
    ingredientes: [
      { nombre: "Ternera magra", prod: A.ternera, rol: "fat", w: 1 },
      { nombre: "Pasta (cocida)", prod: A.pasta, rol: "carb", w: 1 },
      { nombre: "Atún (extra proteína)", prod: A.atun, rol: "protein", w: 1 },
      { nombre: "Tomate triturado", prod: A.tomate, rol: "free", gramosFijos: 100 },
    ],
  },
  {
    id: "r5", titulo: "Tostadas de huevo y aguacate", comida: "desayuno", icon: "sun",
    pasos: ["Tuesta el pan.", "Haz los huevos.", "Machaca el aguacate y monta."],
    ingredientes: [
      { nombre: "Huevo", prod: A.huevo, rol: "protein", w: 1 },
      { nombre: "Pan integral", prod: A.pan, rol: "carb", w: 1 },
      { nombre: "Aguacate", prod: A.aguacate, rol: "fat", w: 1 },
    ],
  },
];

export const COMIDA_PCT = { desayuno: 0.25, almuerzo: 0.35, cena: 0.3, snack: 0.1 };
export const COMIDA_SLOT = { desayuno: "breakfast", almuerzo: "lunch", cena: "dinner", snack: "snacks" };
