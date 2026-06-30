// Capa de red hacia la IA.
//  - Modo LOCAL: habla con el servidor Express (/api/*).
//  - Modo NUBE: habla con la Edge Function de Supabase, con el JWT del usuario.
// En ambos casos la API key de Gemini vive en el servidor, nunca en el cliente.
import { CLOUD_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { getAccessToken } from "./auth.js";

const EDGE_URL = `${SUPABASE_URL}/functions/v1/ai`;

async function callAI(action, payload) {
  if (CLOUD_ENABLED) {
    const token = await getAccessToken();
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Modo local
  const route = { "analyze-food": "/api/analyze-food", coach: "/api/coach", workout: "/api/workout", status: "/api/status", "product-search": "/api/product-search" }[action];
  const res = await fetch(route, {
    method: action === "status" ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: action === "status" ? undefined : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function getStatus() {
  try {
    return await callAI("status", {});
  } catch {
    return { demo: true, model: null };
  }
}

// Comprime la imagen en el navegador antes de mandarla.
export function fileToCompressedBase64(file, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function analyzeFood(base64, mealHint) {
  const data = await callAI("analyze-food", { imageBase64: base64, mimeType: "image/jpeg", mealHint });
  return data.analysis;
}

export async function generateWorkout(profile, days) {
  const data = await callAI("workout", { profile, days });
  return data.plan;
}

export async function askCoach(messages, context) {
  const data = await callAI("coach", { messages, context });
  return data.reply;
}

export async function searchProducts(query, hacendado) {
  const data = await callAI("product-search", { query, hacendado });
  return data.products || [];
}
