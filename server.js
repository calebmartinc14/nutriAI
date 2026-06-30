import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// La foto en base64 puede ser grande -> subimos el limite del body.
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const DEMO_MODE = !GEMINI_API_KEY;

// ---------------------------------------------------------------------------
// System prompt: obliga a la IA a devolver SOLO JSON con los macros.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `
Eres un nutricionista experto en analisis visual de alimentos.
Analiza la imagen de comida y estima sus valores nutricionales para la
porcion que se ve en la foto (no por 100g). Si hay varios elementos, suma todo.

Reglas:
- Estima la porcion real visible usando referencias (plato, cubiertos) para el tamano.
- Si la imagen NO contiene comida, responde con "is_food": false.
- Devuelve EXCLUSIVAMENTE un objeto JSON valido, sin texto adicional ni markdown.
- "confidence" refleja que tan seguro estas (0.0 a 1.0).
`.trim();

// Instruccion compartida: el coach puede registrar comidas en el diario.
const LOG_INSTRUCTIONS = `
MUY IMPORTANTE: si el usuario dice que ha comido o bebido algo (ej. "me he comido 2 huevos y una tostada"),
ademas de tu respuesta normal y breve, anade al FINAL uno o varios bloques EXACTOS
(uno por alimento o plato) con tus mejores estimaciones de macros de la porcion indicada.
Escribe cada bloque en UNA SOLA LINEA, sin markdown ni comillas de codigo:
<<LOG>>{"name":"Nombre corto","slot":"breakfast|lunch|dinner|snacks","calories":N,"protein":N,"carbs":N,"fat":N}<<END>>
Usa numeros (gramos y kcal). Elige el slot segun la hora del dia si no se especifica.
NO uses bloques de codigo (nada de triple comilla). Si el usuario NO reporta comida, NO incluyas ningun bloque.`.trim();

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_food: { type: "BOOLEAN" },
    dish_name: { type: "STRING" },
    calories: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    confidence: { type: "NUMBER" },
    notes: { type: "STRING" },
  },
  required: ["is_food", "dish_name", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
};

// ---------------------------------------------------------------------------
// POST /api/analyze-food  -> foto (base64) a macros
// ---------------------------------------------------------------------------
app.post("/api/analyze-food", async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", mealHint } = req.body ?? {};
  if (!imageBase64) {
    return res.status(400).json({ error: "Falta imageBase64" });
  }

  // --- Modo demo: sin clave, devolvemos un analisis plausible ---
  if (DEMO_MODE) {
    await wait(900); // simula latencia de red
    return res.json({ analysis: demoFoodAnalysis(), demo: true });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: mealHint ? `Contexto: es el ${mealHint} del usuario.` : "Analiza este plato." },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, detail);
      return res.status(502).json({ error: "Servicio de IA no disponible" });
    }

    const payload = await geminiRes.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const analysis = JSON.parse(raw);

    if (analysis.is_food === false) {
      return res.status(422).json({ error: "La imagen no contiene comida" });
    }
    res.json({ analysis, demo: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error procesando el analisis" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/coach  -> chat con el coach nutricional (mantiene contexto)
// ---------------------------------------------------------------------------
app.post("/api/coach", async (req, res) => {
  const { messages = [], context } = req.body ?? {};

  if (DEMO_MODE) {
    await wait(700);
    return res.json({ reply: demoCoachReply(messages), demo: true });
  }

  try {
    const contextText = context
      ? `Contexto del usuario hoy: ${context.consumed.calories} de ${context.target.calories} kcal, ` +
        `proteina ${context.consumed.protein}/${context.target.protein}g, ` +
        `carbos ${context.consumed.carbs}/${context.target.carbs}g, ` +
        `grasa ${context.consumed.fat}/${context.target.fat}g.`
      : "";

    const coachPrompt = `
Eres "Coach Nutricional IA", cercano y motivador. Respondes en espanol, breve y
accionable. Usa el contexto de macros del usuario para personalizar consejos,
sugerir recetas y ajustar el menu. No des consejo medico; recomienda un
profesional para condiciones de salud. ${contextText}
${LOG_INSTRUCTIONS}`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: coachPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.7 },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, detail);
      return res.status(502).json({ error: "Servicio de IA no disponible" });
    }

    const payload = await geminiRes.json();
    const reply = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "...";
    res.json({ reply, demo: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el coach" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/workout  -> plan de entrenamiento personalizado
// ---------------------------------------------------------------------------
app.post("/api/workout", async (req, res) => {
  const { profile, days } = req.body ?? {};

  if (DEMO_MODE) {
    await wait(800);
    return res.json({ plan: demoWorkout(days), demo: true });
  }

  try {
    const trainerPrompt = `
Eres un entrenador personal experto en hipertrofia y fuerza.
Crea una rutina de gimnasio semanal personalizada y clara, en español.

RESTRICCIONES OBLIGATORIAS (muy importante):
- PROHIBIDO incluir sentadillas (squat) o cualquier variante (sentadilla búlgara,
  hack, frontal, goblet, etc.).
- PROHIBIDO incluir peso muerto (deadlift) o cualquier variante (rumano, sumo,
  piernas rígidas, buenos días).
- Para pierna usa alternativas: prensa, extensiones, curl femoral, hip thrust,
  zancadas, gemelos, abductor/aductor.

Formato: para cada día indica el enfoque y una lista de ejercicios con
series x repeticiones. Añade una nota breve de descanso y técnica. Sé conciso.`.trim();

    const userMsg = `Perfil: sexo ${profile?.sex ?? "?"}, edad ${profile?.age ?? "?"}, ` +
      `peso ${profile?.weight ?? "?"} kg, altura ${profile?.height ?? "?"} cm, ` +
      `actividad ${profile?.activity ?? "?"}, objetivo ${profile?.goal ?? "?"}. ` +
      `Quiero entrenar ${days ?? 3} días por semana.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: trainerPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.6 },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, detail);
      return res.status(502).json({ error: "Servicio de IA no disponible" });
    }

    const payload = await geminiRes.json();
    const plan = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "...";
    res.json({ plan, demo: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando la rutina" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/product-search  -> proxy a Open Food Facts (evita CORS)
// ---------------------------------------------------------------------------
app.post("/api/product-search", async (req, res) => {
  const { query, hacendado } = req.body ?? {};
  try {
    const params = new URLSearchParams({
      search_terms: String(query || ""), search_simple: "1", action: "process",
      json: "1", page_size: "30",
      fields: "code,product_name,brands,image_front_small_url,nutriments",
    });
    if (hacendado) params.set("brands_tags", "hacendado");
    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: { "User-Agent": "NutriAI/1.0 (app de nutricion)" },
    });
    if (!r.ok) return res.status(502).json({ error: "Open Food Facts no disponible" });
    const data = await r.json();
    const products = (data.products || [])
      .map((p) => ({
        nombre: p.product_name, marca: p.brands, img: p.image_front_small_url,
        kcal: p.nutriments?.["energy-kcal_100g"], p: p.nutriments?.proteins_100g,
        c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g,
      }))
      .filter((x) => x.nombre && x.kcal != null);
    res.json({ products });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Error buscando productos" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/product-barcode  -> producto de Open Food Facts por código de barras
// ---------------------------------------------------------------------------
app.post("/api/product-barcode", async (req, res) => {
  try {
    const code = String(req.body?.barcode || "").replace(/\D/g, "");
    if (!code) return res.status(400).json({ error: "Código no válido" });
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,image_front_small_url,nutriments`, {
      headers: { "User-Agent": "NutriAI/1.0 (app de nutricion)" },
    });
    if (!r.ok) return res.status(502).json({ error: "Open Food Facts no disponible" });
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.status(404).json({ error: "Producto no encontrado" });
    const p = data.product;
    res.json({ product: {
      nombre: p.product_name, marca: p.brands, img: p.image_front_small_url,
      kcal: p.nutriments?.["energy-kcal_100g"], p: p.nutriments?.proteins_100g,
      c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g,
    } });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Error buscando el producto" });
  }
});

// Estado del servidor (lo usa el front para mostrar el badge demo/IA real).
app.get("/api/status", (_req, res) => {
  res.json({ demo: DEMO_MODE, model: DEMO_MODE ? null : GEMINI_MODEL });
});

app.listen(PORT, () => {
  console.log(`\n  NutriAI corriendo en  http://localhost:${PORT}`);
  console.log(`  Modo IA: ${DEMO_MODE ? "DEMO (sin clave - macros simulados)" : `REAL (${GEMINI_MODEL})`}\n`);
});

// ---------------------------------------------------------------------------
// Helpers de modo demo
// ---------------------------------------------------------------------------
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function demoFoodAnalysis() {
  const platos = [
    { dish_name: "Bowl de pollo, arroz y aguacate", calories: 640, protein_g: 44, carbs_g: 62, fat_g: 21 },
    { dish_name: "Ensalada cesar con pollo", calories: 410, protein_g: 33, carbs_g: 18, fat_g: 23 },
    { dish_name: "Pasta boloñesa", calories: 720, protein_g: 30, carbs_g: 85, fat_g: 26 },
    { dish_name: "Salmon con verduras al horno", calories: 480, protein_g: 38, carbs_g: 20, fat_g: 27 },
    { dish_name: "Huevos revueltos con tostada y palta", calories: 390, protein_g: 19, carbs_g: 28, fat_g: 22 },
  ];
  const p = platos[Math.floor(Math.random() * platos.length)];
  return { is_food: true, ...p, confidence: 0.82, notes: "Modo demo: valores de ejemplo. Anade tu GEMINI_API_KEY para analisis real." };
}

function demoWorkout(days) {
  return (
    `Modo demo 🏋️ (añade tu GEMINI_API_KEY para un plan personalizado real)\n\n` +
    `Ejemplo para ${days ?? 3} días/semana — sin sentadillas ni peso muerto:\n\n` +
    `• Día 1 — Empuje: press banca mancuernas, press militar, aperturas, elevaciones laterales, tríceps en polea.\n` +
    `• Día 2 — Tirón: jalón al pecho, remo con mancuerna, face pull, curl con barra, curl martillo.\n` +
    `• Día 3 — Pierna: prensa, extensión de cuádriceps, curl femoral, hip thrust, gemelos.\n\n` +
    `3-4 series de 8-12 reps, 60-90 s de descanso.`
  );
}

function demoCoachReply(messages) {
  const last = messages.at(-1)?.content?.toLowerCase() ?? "";
  // Modo demo: detecta que el usuario reporta comida y devuelve un bloque LOG de ejemplo.
  if (/(comid|comí|comí|cen[eé]|desayun|merend|bebid|me he comido|he comido|tom[eé])/i.test(last)) {
    return (
      "¡Anotado! 💪 Buena elección. (Modo demo: macros estimados de ejemplo.)\n" +
      '<<LOG>>{"name":"Comida del chat","slot":"lunch","calories":420,"protein":28,"carbs":40,"fat":15}<<END>>'
    );
  }
  if (last.includes("receta")) {
    return "Modo demo 🍳 Prueba: bowl de quinoa con pollo, garbanzos y aguacate (~520 kcal, 38g proteina). Anade tu clave de Gemini para respuestas reales y personalizadas a tus macros.";
  }
  if (last.includes("proteina") || last.includes("proteína")) {
    return "Modo demo 💪 Para subir proteina sin pasarte de calorias: claras, atun, pechuga, yogur griego 0%, tofu. Configura tu GEMINI_API_KEY para consejos a medida.";
  }
  return "Modo demo 🤖 Soy tu coach. Cuando agregues tu GEMINI_API_KEY en .env te respondere con IA real usando tus macros del dia. Preguntame por recetas, ajustes de menu o como llegar a tu objetivo.";
}
