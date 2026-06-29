import { store } from "../store.js";
import { toast } from "./ui.js";

const GOAL_HINT = {
  lose: "Tu objetivo es perder grasa: busca una bajada lenta y constante.",
  maintain: "Tu objetivo es mantener: vigila que el peso se quede estable.",
  gain: "Tu objetivo es ganar músculo: busca una subida progresiva.",
};

export function renderWeight(root) {
  draw(root);
}

function draw(root) {
  const weights = store.weights();
  const profile = store.profile();
  const last = weights.at(-1);
  const first = weights[0];

  const current = last?.kg;
  const totalChange = last && first ? +(last.kg - first.kg).toFixed(1) : 0;
  const change30 = changeInLastDays(weights, 30);

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Seguimiento de peso</h2>
      <p class="page-sub">${profile ? GOAL_HINT[profile.goal] ?? "" : ""}</p>
    </div>

    <div class="card weight-input-card">
      <div class="field" style="margin:0; flex:1">
        <label>Registrar peso de hoy (kg)</label>
        <input id="w-input" type="number" inputmode="decimal" step="0.1"
          placeholder="${current ? current + " kg la última vez" : "Ej. 80.5"}" />
      </div>
      <button class="btn btn-primary" id="w-save">Guardar</button>
    </div>

    <div class="weight-stats">
      ${stat("Peso actual", current != null ? `${current}` : "—", "kg", "var(--cal)")}
      ${stat("Cambio total", fmtChange(totalChange), "kg", changeColor(totalChange, profile))}
      ${stat("Últimos 30 días", fmtChange(change30), "kg", changeColor(change30, profile))}
      ${stat("Registros", `${weights.length}`, "días", "var(--text-2)")}
    </div>

    <div class="card chart-card">
      <div class="section-title">Evolución</div>
      ${weights.length >= 2 ? lineChart(weights) : `<p class="empty-chart">Registra tu peso al menos 2 días para ver la gráfica 📈</p>`}
    </div>

    <div class="section-title" style="margin-top:24px">Registros</div>
    <div class="weight-list">
      ${
        weights.length === 0
          ? `<p class="hist-note">Aún no has registrado tu peso.</p>`
          : [...weights]
              .reverse()
              .map((w, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? +(w.kg - prev.kg).toFixed(1) : null;
                return `<div class="card weight-row">
                  <span class="wr-date">${fmtDate(w.date)}</span>
                  <span class="wr-kg">${w.kg} kg</span>
                  <span class="wr-delta" style="color:${delta == null ? "var(--text-3)" : changeColor(delta, profile)}">
                    ${delta == null ? "" : fmtChange(delta)}</span>
                  <button class="meal-del" data-del-w="${w.date}" title="Borrar">✕</button>
                </div>`;
              })
              .join("")
      }
    </div>
  `;

  // Guardar peso
  const input = root.querySelector("#w-input");
  const saveWeight = () => {
    const kg = Number(input.value);
    if (!(kg >= 30 && kg <= 400)) return toast("Pon un peso válido (30-400 kg)");
    store.addWeight(+kg.toFixed(1));
    toast("Peso guardado ✅");
    draw(root);
  };
  root.querySelector("#w-save").addEventListener("click", saveWeight);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") saveWeight(); });

  // Borrar registros
  root.querySelectorAll("[data-del-w]").forEach((btn) =>
    btn.addEventListener("click", () => {
      store.deleteWeight(btn.dataset.delW);
      draw(root);
    })
  );
}

// ---- Grafica de linea SVG ----
function lineChart(weights) {
  const W = 600, H = 220, pad = { l: 40, r: 16, t: 16, b: 28 };
  const xs = weights.map((w) => new Date(w.date).getTime());
  const ys = weights.map((w) => w.kg);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  // Margen vertical para que la linea no toque los bordes.
  const range = maxY - minY || 1;
  minY -= range * 0.15;
  maxY += range * 0.15;

  const px = (x) => pad.l + ((x - minX) / (maxX - minX || 1)) * (W - pad.l - pad.r);
  const py = (y) => pad.t + (1 - (y - minY) / (maxY - minY)) * (H - pad.t - pad.b);

  const pts = weights.map((w) => [px(new Date(w.date).getTime()), py(w.kg)]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L ${pts.at(-1)[0].toFixed(1)} ${H - pad.b} L ${pts[0][0].toFixed(1)} ${H - pad.b} Z`;

  // Lineas guia horizontales (min, medio, max)
  const guides = [maxY, (maxY + minY) / 2, minY]
    .map((v) => {
      const y = py(v);
      return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="var(--stroke)" stroke-width="1"/>
              <text x="4" y="${y + 4}" fill="var(--text-3)" font-size="11">${v.toFixed(1)}</text>`;
    })
    .join("");

  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--cal)"/>`).join("");

  return `
    <svg class="weight-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%">
      ${guides}
      <path d="${area}" fill="var(--cal)" opacity="0.10"/>
      <path d="${path}" fill="none" stroke="var(--cal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>`;
}

// ---- Helpers ----
function stat(label, value, unit, color) {
  return `<div class="card stat-card">
    <div class="stat-val" style="color:${color}">${value}</div>
    <div class="stat-unit">${unit}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function changeInLastDays(weights, days) {
  if (weights.length < 2) return 0;
  const cutoff = Date.now() - days * 86400000;
  const recent = weights.filter((w) => new Date(w.date).getTime() >= cutoff);
  const base = recent[0] ?? weights[0];
  const last = weights.at(-1);
  return +(last.kg - base.kg).toFixed(1);
}

// Verde si va en la direccion del objetivo, coral si en contra.
function changeColor(delta, profile) {
  if (!delta) return "var(--text-2)";
  const goal = profile?.goal;
  if (goal === "lose") return delta < 0 ? "var(--cal)" : "var(--fat)";
  if (goal === "gain") return delta > 0 ? "var(--cal)" : "var(--fat)";
  return "var(--text)";
}

function fmtChange(n) {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtDate(key) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(key));
}
