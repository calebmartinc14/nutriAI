import { store, sumMacros } from "../store.js";
import { askCoach } from "../api.js";

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
      history.push({ role: "assistant", content: reply });
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
