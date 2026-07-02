import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { existsSync } from "node:fs";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  validate: { xForwardedForHeader: false },
});
app.use("/api/", limiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  validate: { xForwardedForHeader: false },
});
app.use("/api/analyze-food", aiLimiter);
app.use("/api/coach", aiLimiter);

// La foto en base64 puede ser grande -> subimos el limite del body.
app.use(express.json({ limit: "5mb" }));

// En producción (dist/) servimos el build de Vite; si no, servimos public/ (dev).
const STATIC_DIR = existsSync(path.join(__dirname, "dist"))
  ? path.join(__dirname, "dist")
  : path.join(__dirname, "public");
app.use(express.static(STATIC_DIR));

const PORT = process.env.PORT || 3000;

// AI Provider: "gemini" (default) or "openrouter"
const AI_PROVIDER = process.env.AI_PROVIDER?.trim() || "gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash:free";

const HAS_AI_KEY = AI_PROVIDER === "openrouter" ? !!OPENROUTER_API_KEY : !!GEMINI_API_KEY;
const DEMO_MODE = !HAS_AI_KEY;

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

// Idioma en el que debe responder la IA (segun la interfaz del usuario).
const LANG_NAMES = { es: "español", en: "inglés (English)", fr: "francés (français)" };
const langLine = (lang) => `Responde SIEMPRE en ${LANG_NAMES[lang] ?? "español"}.`;

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
// AI helper: llama a Gemini o OpenRouter según AI_PROVIDER
// ---------------------------------------------------------------------------
async function callAI(systemPrompt, messages, opts = {}) {
  if (AI_PROVIDER === "openrouter") {
    return callOpenRouter(systemPrompt, messages, opts);
  }
  return callGeminiAPI(systemPrompt, messages, opts);
}

async function callOpenRouter(systemPrompt, messages, opts = {}) {
  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.responseJson) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://nutveo.app",
      "X-Title": "Nutveo",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("OpenRouter error:", res.status, detail);
    throw new Error(`OpenRouter: ${res.status}`);
  }
  const payload = await res.json();
  return payload?.choices?.[0]?.message?.content ?? "";
}

async function callGeminiAPI(systemPrompt, messages, opts = {}) {
  const model = opts.model || GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
    }
    return { role: "user", parts: m.content };
  });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: opts.temperature ?? 0.2 },
  };
  if (opts.responseJson && opts.responseSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = opts.responseSchema;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error:", res.status, detail);
    throw new Error(`Gemini: ${res.status}`);
  }
  const payload = await res.json();
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Extrae JSON de una respuesta de texto (tolerante a markdown ```json ... ```)
function extractJSON(text) {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim());
  return JSON.parse(text.trim());
}

// ---------------------------------------------------------------------------
// POST /api/analyze-food  -> foto (base64) a macros
// ---------------------------------------------------------------------------
app.post("/api/analyze-food", async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", mealHint } = req.body ?? {};
  if (!imageBase64) {
    return res.status(400).json({ error: "Falta imageBase64" });
  }

  if (DEMO_MODE) {
    await wait(900);
    return res.json({ analysis: demoFoodAnalysis(), demo: true });
  }

  try {
    const lang = req.body?.lang;
    const prompt = `${SYSTEM_PROMPT}\nEscribe "dish_name" y "notes" en el idioma del usuario. ${langLine(lang)}`;

    let raw;
    if (AI_PROVIDER === "openrouter") {
      const textContent = mealHint
        ? `El usuario describe lo que hay en la foto: "${mealHint}". Usa esa información para estimar con MÁS precisión las cantidades y macros.`
        : "Analiza este plato.";
      raw = await callOpenRouter(prompt, [{
        role: "user",
        content: [
          { type: "text", text: textContent },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }], { responseJson: true, temperature: 0.2 });
    } else {
      raw = await callGeminiAPI(prompt, [{
        role: "user",
        content: [
          { text: mealHint ? `El usuario describe lo que hay en la foto: "${mealHint}". Usa esa información para estimar con MÁS precisión las cantidades y macros.` : "Analiza este plato." },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }], { responseJson: true, responseSchema: RESPONSE_SCHEMA, temperature: 0.2 });
    }

    const analysis = extractJSON(raw);
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
  let { messages = [], context } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length > 50) {
    return res.status(400).json({ error: "Formato de mensajes inválido" });
  }
  messages = messages.slice(-30).filter((m) =>
    m && typeof m === "object" && typeof m.content === "string" && m.content.length <= 2000
  );

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
Eres "Coach Nutricional IA", cercano y motivador. ${langLine(req.body?.lang)} Breve y
accionable. Usa el contexto de macros del usuario para personalizar consejos,
sugerir recetas y ajustar el menu. No des consejo medico; recomienda un
profesional para condiciones de salud. ${contextText}
${LOG_INSTRUCTIONS}`.trim();

    const reply = await callAI(coachPrompt, messages.map((m) => ({
      role: m.role,
      content: m.content,
    })), { temperature: 0.7 });

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
Crea una rutina de gimnasio semanal personalizada y clara. ${langLine(req.body?.lang)}

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

    const plan = await callAI(trainerPrompt, [{ role: "user", content: userMsg }], { temperature: 0.6 });
    res.json({ plan, demo: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando la rutina" });
  }
});

// ---------------------------------------------------------------------------
// Cache simple para Open Food Facts (5 min TTL)
// ---------------------------------------------------------------------------
const offerCache = new Map();
const OFF_TTL = 5 * 60 * 1000;
function cachedFetch(url, ttl = OFF_TTL) {
  const cached = offerCache.get(url);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;
  return null;
}
function setCache(url, data) {
  offerCache.set(url, { data, ts: Date.now() });
  if (offerCache.size > 200) {
    const oldest = [...offerCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) offerCache.delete(oldest[0]);
  }
}

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
    const cacheKey = `search:${params.toString()}`;
    const cached = cachedFetch(cacheKey);
    if (cached) return res.json({ products: cached, cached: true });

    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: { "User-Agent": "Nutveo/1.0 (app de nutricion)" },
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
    setCache(cacheKey, products);
    res.json({ products });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Error buscando productos" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/estimate-food  -> estima macros de un alimento por gramos (recetas)
// ---------------------------------------------------------------------------
app.post("/api/estimate-food", async (req, res) => {
  const { food, grams } = req.body ?? {};
  if (DEMO_MODE) {
    const g = Number(grams) || 100;
    return res.json({ macros: { calories: Math.round(g * 1.5), protein: Math.round(g * 0.1), carbs: Math.round(g * 0.15), fat: Math.round(g * 0.05) }, demo: true });
  }
  try {
    const sysPrompt = "Eres un nutricionista. Estima los valores para la cantidad indicada. Devuelve SOLO JSON válido.";
    const userMsg = `Alimento: ${food}. Cantidad: ${grams} g. Da calorías totales y gramos de proteína, carbohidratos y grasa PARA ESA CANTIDAD.`;
    const raw = await callAI(sysPrompt, [{ role: "user", content: userMsg }], {
      temperature: 0.2, responseJson: true,
      responseSchema: { type: "OBJECT", properties: { calories: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" } }, required: ["calories", "protein_g", "carbs_g", "fat_g"] },
    });
    const o = extractJSON(raw);
    res.json({ macros: { calories: o.calories, protein: o.protein_g, carbs: o.carbs_g, fat: o.fat_g } });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "No se pudo estimar" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/product-barcode  -> producto de Open Food Facts por código de barras
// ---------------------------------------------------------------------------
app.post("/api/product-barcode", async (req, res) => {
  try {
    const code = String(req.body?.barcode || "").replace(/\D/g, "");
    if (!code) return res.status(400).json({ error: "Código no válido" });
    const cacheKey = `barcode:${code}`;
    const cached = cachedFetch(cacheKey, 60 * 60 * 1000);
    if (cached) return res.json({ product: cached, cached: true });
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,image_front_small_url,nutriments`, {
      headers: { "User-Agent": "Nutveo/1.0 (app de nutricion)" },
    });
    if (!r.ok) return res.status(502).json({ error: "Open Food Facts no disponible" });
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.status(404).json({ error: "Producto no encontrado" });
    const p = data.product;
    const product = {
      nombre: p.product_name, marca: p.brands, img: p.image_front_small_url,
      kcal: p.nutriments?.["energy-kcal_100g"], p: p.nutriments?.proteins_100g,
      c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g,
    };
    setCache(cacheKey, product);
    res.json({ product });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Error buscando el producto" });
  }
});

// Estado del servidor (lo usa el front para mostrar el badge demo/IA real).
app.get("/api/status", (_req, res) => {
  const activeModel = AI_PROVIDER === "openrouter" ? OPENROUTER_MODEL : GEMINI_MODEL;
  res.json({ demo: DEMO_MODE, provider: DEMO_MODE ? null : AI_PROVIDER, model: DEMO_MODE ? null : activeModel });
});

// SPA fallback: servir index.html para rutas que no sean API ni archivos.
app.get("*", (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  const provider = AI_PROVIDER === "openrouter" ? `OpenRouter (${OPENROUTER_MODEL})` : `Gemini (${GEMINI_MODEL})`;
  console.log(`\n  Nutveo corriendo en  http://localhost:${PORT}`);
  console.log(`  Modo IA: ${DEMO_MODE ? "DEMO (sin clave - macros simulados)" : `REAL · ${provider}`}\n`);
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
  return { is_food: true, ...p, confidence: 0.82, notes: "Modo demo: valores de ejemplo. Añade una API key en .env para análisis real." };
}

function demoWorkout(days) {
  return (
    `Modo demo 🏋️ (añade una API key en .env para un plan personalizado real)\n\n` +
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
    return "Modo demo 🍳 Prueba: bowl de quinoa con pollo, garbanzos y aguacate (~520 kcal, 38g proteina). Añade una API key para respuestas reales y personalizadas a tus macros.";
  }
  if (last.includes("proteina") || last.includes("proteína")) {
    return "Modo demo 💪 Para subir proteina sin pasarte de calorias: claras, atun, pechuga, yogur griego 0%, tofu. Configura tu API key para consejos a medida.";
  }
  return "Modo demo 🤖 Soy tu coach. Cuando agregues tu API key en .env te responderé con IA real usando tus macros del día. Pregúntame por recetas, ajustes de menú o cómo llegar a tu objetivo.";
}
