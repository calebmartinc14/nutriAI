// ===========================================================================
// Edge Function "ai" · proxy seguro a Gemini para la versión en la nube.
// Despliegue:  supabase functions deploy ai --no-verify-jwt
// Secretos:    supabase secrets set GEMINI_API_KEY=tu_clave
// ===========================================================================
// Acciones (campo "action" del body):
//   - "status"        -> { demo, model }
//   - "analyze-food"  -> { analysis }
//   - "coach"         -> { reply }
//   - "workout"       -> { plan }

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim() ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
const DEMO = !GEMINI_API_KEY;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FOOD_PROMPT = `Eres un nutricionista experto en análisis visual de alimentos.
Analiza la imagen y estima los valores de la porción visible. Si no hay comida, "is_food": false.
Devuelve SOLO JSON válido sin markdown.`;

// Idioma en el que debe responder la IA (según la interfaz del usuario).
const LANG_NAMES: Record<string, string> = { es: "español", en: "inglés (English)", fr: "francés (français)" };
const langLine = (lang?: string) => `Responde SIEMPRE en ${LANG_NAMES[lang ?? "es"] ?? "español"}.`;

// El coach puede registrar comidas que el usuario reporta por chat.
const LOG_INSTRUCTIONS = `MUY IMPORTANTE: si el usuario dice que ha comido o bebido algo, además de tu respuesta breve
añade al FINAL uno o varios bloques EXACTOS (uno por alimento) con macros estimados de la porción.
Escribe cada bloque en UNA SOLA LÍNEA, sin markdown y sin comillas de código:
<<LOG>>{"name":"Nombre corto","slot":"breakfast|lunch|dinner|snacks","calories":N,"protein":N,"carbs":N,"fat":N}<<END>>
Usa números (kcal y gramos). Elige slot por la hora si no se indica. NO uses bloques de código (nada de triple comilla). Si el usuario no reporta comida, no incluyas ningún bloque.`;

const FOOD_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_food: { type: "BOOLEAN" }, dish_name: { type: "STRING" },
    calories: { type: "NUMBER" }, protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" },
    confidence: { type: "NUMBER" }, notes: { type: "STRING" },
  },
  required: ["is_food", "dish_name", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
};

async function gemini(systemText: string, parts: unknown[], generationConfig: Record<string, unknown>) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Verifica que quien llama es un USUARIO autenticado real (no solo la anon key).
// Evita que alguien con la URL gaste tu cuota de Gemini.
async function verifyUser(req: Request): Promise<boolean> {
  const SB_URL = Deno.env.get("SUPABASE_URL");
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !SB_URL || !SB_ANON || token === SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON } });
    return r.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: any = {};
  try { body = await req.json(); } catch { /* status sin body */ }
  const action = body.action ?? "status";

  if (action === "status") return json({ demo: DEMO, model: DEMO ? null : GEMINI_MODEL });

  // Todas las demás acciones requieren un usuario autenticado.
  if (!(await verifyUser(req))) return json({ error: "No autorizado. Inicia sesión." }, 401);

  // Búsqueda de productos en Open Food Facts (proxy: evita CORS, añade User-Agent).
  // No depende de Gemini, funciona siempre.
  if (action === "product-search") {
    try {
      const params = new URLSearchParams({
        search_terms: String(body.query || ""), search_simple: "1", action: "process",
        json: "1", page_size: "30",
        fields: "code,product_name,brands,image_front_small_url,nutriments",
      });
      if (body.hacendado) params.set("brands_tags", "hacendado");
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
        headers: { "User-Agent": "Nutveo/1.0 (app de nutrición)" },
      });
      if (!r.ok) return json({ error: "Open Food Facts no disponible" }, 502);
      const data = await r.json();
      const products = (data.products || [])
        .map((p: any) => ({
          nombre: p.product_name, marca: p.brands, img: p.image_front_small_url,
          kcal: p.nutriments?.["energy-kcal_100g"], p: p.nutriments?.proteins_100g,
          c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g,
        }))
        .filter((x: any) => x.nombre && x.kcal != null);
      return json({ products });
    } catch (e) {
      console.error(e);
      return json({ error: "Error buscando productos" }, 502);
    }
  }

  // Buscar un producto por código de barras en Open Food Facts (proxy).
  if (action === "product-barcode") {
    try {
      const code = String(body.barcode || "").replace(/\D/g, "");
      if (!code) return json({ error: "Código no válido" }, 400);
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,image_front_small_url,nutriments`, {
        headers: { "User-Agent": "Nutveo/1.0 (app de nutrición)" },
      });
      if (!r.ok) return json({ error: "Open Food Facts no disponible" }, 502);
      const data = await r.json();
      if (data.status !== 1 || !data.product) return json({ error: "Producto no encontrado" }, 404);
      const p = data.product;
      return json({ product: {
        nombre: p.product_name, marca: p.brands, img: p.image_front_small_url,
        kcal: p.nutriments?.["energy-kcal_100g"], p: p.nutriments?.proteins_100g,
        c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g,
      } });
    } catch (e) {
      console.error(e);
      return json({ error: "Error buscando el producto" }, 502);
    }
  }

  // Estimar macros de un alimento por gramos (para recetas propias).
  if (action === "estimate-food") {
    if (DEMO) return json({ macros: demoEstimate(body.grams), demo: true });
    try {
      const raw = await gemini(
        "Eres un nutricionista. Estima los valores nutricionales para la cantidad indicada. Devuelve SOLO JSON válido.",
        [{ text: `Alimento: ${body.food}. Cantidad: ${body.grams} g. Da calorías totales y gramos de proteína, carbohidratos y grasa PARA ESA CANTIDAD.` }],
        { temperature: 0.2, responseMimeType: "application/json", responseSchema: MACRO_SCHEMA },
      );
      const o = JSON.parse(raw);
      return json({ macros: { calories: o.calories, protein: o.protein_g, carbs: o.carbs_g, fat: o.fat_g } });
    } catch (e) {
      console.error(e);
      return json({ error: "No se pudo estimar" }, 502);
    }
  }

  try {
    if (action === "analyze-food") {
      if (DEMO) return json({ analysis: demoFood(), demo: true });
      const raw = await gemini(
        `${FOOD_PROMPT}\nEscribe "dish_name" y "notes" en el idioma del usuario. ${langLine(body.lang)}`,
        [
          { text: body.mealHint ? `El usuario describe lo que hay en la foto: "${body.mealHint}". Usa esa información para estimar con MÁS precisión las cantidades y macros.` : "Analiza este plato." },
          { inlineData: { mimeType: body.mimeType ?? "image/jpeg", data: body.imageBase64 } },
        ],
        { temperature: 0.2, responseMimeType: "application/json", responseSchema: FOOD_SCHEMA },
      );
      const analysis = JSON.parse(raw);
      if (analysis.is_food === false) return json({ error: "La imagen no contiene comida" }, 422);
      return json({ analysis });
    }

    if (action === "coach") {
      if (DEMO) {
        const last = (body.messages?.at(-1)?.content ?? "").toLowerCase();
        if (/(comid|comí|cen[eé]|desayun|merend|bebid|he comido|tom[eé])/i.test(last)) {
          return json({ reply: '¡Anotado! 💪 (demo)\n<<LOG>>{"name":"Comida del chat","slot":"lunch","calories":420,"protein":28,"carbs":40,"fat":15}<<END>>', demo: true });
        }
        return json({ reply: "Modo demo 🤖 Añade GEMINI_API_KEY al proyecto para respuestas reales.", demo: true });
      }
      const ctx = body.context
        ? `Contexto: ${body.context.consumed?.calories}/${body.context.target?.calories} kcal hoy.` : "";
      const reply = await gemini(
        `Eres "Coach Nutricional IA", cercano y conciso. ${langLine(body.lang)} ${ctx}\n${LOG_INSTRUCTIONS}`,
        [{ text: (body.messages ?? []).map((m: any) => `${m.role}: ${m.content}`).join("\n") }],
        { temperature: 0.7 },
      );
      return json({ reply });
    }

    if (action === "workout") {
      if (DEMO) return json({ plan: "Modo demo 🏋️ Añade GEMINI_API_KEY para un plan real.", demo: true });
      const p = body.profile ?? {};
      const reply = await gemini(
        `Eres un entrenador personal. Crea una rutina semanal. ${langLine(body.lang)}
PROHIBIDO sentadillas (squat) y peso muerto (deadlift) y sus variantes.
Para pierna usa prensa, extensiones, curl femoral, hip thrust, zancadas, gemelos.`,
        [{ text: `Perfil: ${JSON.stringify(p)}. ${body.days ?? 3} días/semana.` }],
        { temperature: 0.6 },
      );
      return json({ plan: reply });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Error en el servicio de IA" }, 502);
  }
});

const MACRO_SCHEMA = {
  type: "OBJECT",
  properties: { calories: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" } },
  required: ["calories", "protein_g", "carbs_g", "fat_g"],
};

function demoEstimate(grams: number) {
  const g = Number(grams) || 100;
  return { calories: Math.round(g * 1.5), protein: Math.round(g * 0.1), carbs: Math.round(g * 0.15), fat: Math.round(g * 0.05) };
}

function demoFood() {
  return { is_food: true, dish_name: "Plato de ejemplo (demo)", calories: 600, protein_g: 40, carbs_g: 55, fat_g: 22, confidence: 0.8, notes: "Modo demo." };
}
