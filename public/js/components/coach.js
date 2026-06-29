import { store, sumMacros, SLOTS } from "../store.js";
import { askCoach } from "../api.js";
import { toast } from "./ui.js";

// Chat con el Coach Nutricional IA. Mantiene el historial en memoria de sesion
// y manda el contexto de macros del dia en cada peticion.
let history = [
  {
    role: "assistant",
    content:
      "¡Hola! Soy tu Coach Nutricional 🤖 Puedo sugerirte recetas, ajustar tu menú o resolver dudas según tus macros de hoy. ¿En qué te ayudo?",
  },
];

const QUICK = [
  "¿Qué ceno hoy?",
  "Dame una receta alta en proteína",
  "¿Voy bien con mis macros?",
];

export function renderCoach(root) {
  root.innerHTML = `
    <div class="coach">
      <div class="quick-chips">
        ${QUICK.map((q) => `<button class="quick-chip">${q}</button>`).join("")}
      </div>
      <div class="chat-log" id="log"></div>
      <div class="chat-input">
        <input id="chat-text" type="text" placeholder="Escribe tu mensaje…" autocomplete="off" />
        <button class="chat-send" id="chat-send">➤</button>
      </div>
    </div>`;

  const log = root.querySelector("#log");
  const input = root.querySelector("#chat-text");

  paint(log);

  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    history.push({ role: "user", content: text });
    paint(log);

    const typing = addTyping(log);
    try {
      const meals = store.meals();
      const context = { consumed: sumMacros(meals), target: store.goals() };
      const reply = await askCoach(history, context);
      typing.remove();
      // Detecta comidas que la IA quiere registrar y las añade al diario.
      const { text, added } = logMealsFromReply(reply);
      let finalText = text || "¡Hecho!";
      if (added.length) {
        const lines = added.map((m) => `✅ Añadido: ${m.name} · ${m.calories} kcal (P${m.protein} C${m.carbs} G${m.fat})`).join("\n");
        finalText = (text ? text + "\n\n" : "") + lines;
        toast(added.length === 1 ? "Comida añadida a tu diario" : `${added.length} comidas añadidas`);
      }
      history.push({ role: "assistant", content: finalText });
    } catch (e) {
      typing.remove();
      history.push({ role: "assistant", content: "Ups, no pude responder ahora. Revisa la conexión." });
    }
    paint(log);
  };

  root.querySelector("#chat-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
  root.querySelectorAll(".quick-chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      input.value = chip.textContent;
      send();
    })
  );
}

// Extrae comidas de la respuesta de la IA, las registra y devuelve el texto
// limpio. Tolerante: acepta <<LOG>>{...}<<END>>, JSON suelto, o ```json ... ```.
function logMealsFromReply(reply) {
  const added = [];

  const tryAdd = (jsonStr) => {
    try {
      const o = JSON.parse(jsonStr.trim());
      if (o == null || o.name == null || o.calories == null) return false;
      const meal = {
        name: String(o.name).slice(0, 80),
        slot: normalizeSlot(o.slot),
        calories: Math.max(0, Math.round(Number(o.calories) || 0)),
        protein: Math.max(0, Math.round(Number(o.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(o.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(o.fat) || 0)),
        source: "ai",
      };
      store.addMeal(meal);
      added.push(meal);
      return true;
    } catch {
      return false;
    }
  };

  // 1) Formato esperado: bloques con marcadores.
  const marker = /<<LOG>>([\s\S]*?)<<END>>/g;
  let m;
  let usedMarkers = false;
  while ((m = marker.exec(reply))) { usedMarkers = true; tryAdd(m[1]); }
  if (usedMarkers) {
    return { text: cleanText(reply.replace(marker, "")), added };
  }

  // 2) Fallback: cualquier objeto JSON que tenga "name" y "calories".
  const objRe = /\{[^{}]*"calories"[^{}]*\}/g;
  let o;
  let working = reply;
  while ((o = objRe.exec(reply))) {
    if (/"name"/.test(o[0]) && tryAdd(o[0])) working = working.replace(o[0], "");
  }
  return { text: cleanText(working), added };
}

function cleanText(t) {
  return t.replace(/```json|```/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeSlot(slot) {
  const s = String(slot || "").toLowerCase();
  const map = {
    breakfast: "breakfast", desayuno: "breakfast",
    lunch: "lunch", almuerzo: "lunch", comida: "lunch",
    dinner: "dinner", cena: "dinner",
    snacks: "snacks", snack: "snacks", merienda: "snacks",
  };
  if (map[s]) return map[s];
  if (SLOTS.some((x) => x.id === s)) return s;
  // Por hora del día como fallback.
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snacks";
}

function paint(log) {
  log.innerHTML = history
    .map((m) => `<div class="msg ${m.role}">${escapeHtml(m.content)}</div>`)
    .join("");
  log.scrollTop = log.scrollHeight;
}

function addTyping(log) {
  const el = document.createElement("div");
  el.className = "msg assistant typing";
  el.textContent = "escribiendo…";
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
