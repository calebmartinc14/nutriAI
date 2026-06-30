import { store } from "../store.js";

// Progreso de fuerza por ejercicio: 1RM estimado (Epley) a lo largo del tiempo.
let selected = null;

export function renderProgress(root) {
  const lifts = store.lifts();
  const exercises = [...new Set(lifts.map((l) => l.exercise))].sort();

  if (!exercises.length) {
    root.innerHTML = `
      <div class="weight-head"><h2 class="page-title">Progreso de fuerza</h2></div>
      <div class="card rank-empty">
        <div class="rank-empty-emoji">📈</div>
        <h3>Aún no hay datos</h3>
        <p>Registra series en la pestaña <b>Entreno</b> y aquí verás tu evolución por ejercicio.</p>
      </div>`;
    return;
  }
  if (!selected || !exercises.includes(selected)) selected = exercises[0];

  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Progreso de fuerza</h2>
      <p class="page-sub">Tu 1RM estimado por ejercicio a lo largo del tiempo.</p>
    </div>
    <select id="pg-ex" class="pg-select">
      ${exercises.map((e) => `<option value="${attr(e)}" ${e === selected ? "selected" : ""}>${esc(e)}</option>`).join("")}
    </select>
    <div id="pg-body"></div>
  `;
  root.querySelector("#pg-ex").addEventListener("change", (e) => { selected = e.target.value; drawBody(root); });
  drawBody(root);
}

function drawBody(root) {
  const body = root.querySelector("#pg-body");
  const lifts = store.liftsFor(selected);

  // Agrupa por fecha -> mejor 1RM y mejor peso de ese día.
  const byDate = {};
  for (const l of lifts) {
    const oneRM = l.kg * (1 + (l.reps || 1) / 30);
    if (!byDate[l.date]) byDate[l.date] = { date: l.date, best1rm: 0, maxKg: 0, sets: [] };
    byDate[l.date].best1rm = Math.max(byDate[l.date].best1rm, oneRM);
    byDate[l.date].maxKg = Math.max(byDate[l.date].maxKg, l.kg);
    byDate[l.date].sets.push(l);
  }
  const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  const first = days[0]?.best1rm ?? 0;
  const last = days.at(-1)?.best1rm ?? 0;
  const change = +(last - first).toFixed(1);

  body.innerHTML = `
    <div class="weight-stats" style="margin-top:14px">
      ${stat("1RM actual", last ? last.toFixed(1) : "—", "kg", "var(--cal)")}
      ${stat("Mejor marca", days.length ? Math.max(...days.map((d) => d.best1rm)).toFixed(1) : "—", "kg", "var(--carbs)")}
      ${stat("Cambio", (change > 0 ? "+" : "") + change, "kg", change >= 0 ? "var(--cal)" : "var(--fat)")}
      ${stat("Registros", days.length, "días", "var(--text-2)")}
    </div>

    <div class="card chart-card">
      <div class="section-title">Evolución del 1RM</div>
      ${days.length >= 2 ? lineChart(days) : `<p class="empty-chart">Registra al menos 2 días para ver la gráfica 📈</p>`}
    </div>

    <div class="section-title" style="margin-top:24px">Historial</div>
    <div class="hist-days">
      ${days.slice().reverse().map(dayRow).join("")}
    </div>
  `;
  requestAnimationFrame(() => {
    body.querySelectorAll(".bar").forEach((b) => (b.style.height = b.dataset.h + "px"));
  });
}

function dayRow(d) {
  const fecha = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d.date + "T00:00:00"));
  const sets = d.sets.map((s) => `${s.kg}×${s.reps}`).join(", ");
  return `
    <div class="card day-card has-data" style="padding:12px 16px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <span class="day-date" style="width:auto">${fecha}</span>
        <span class="day-macros">${sets}</span>
        <span class="day-kcal">${d.best1rm.toFixed(1)} kg 1RM</span>
      </div>
    </div>`;
}

// Gráfica de línea SVG del 1RM.
function lineChart(days) {
  const W = 600, H = 200, pad = { l: 38, r: 14, t: 14, b: 24 };
  const ys = days.map((d) => d.best1rm);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  minY -= range * 0.15; maxY += range * 0.15;
  const px = (i) => pad.l + (i / (days.length - 1 || 1)) * (W - pad.l - pad.r);
  const py = (v) => pad.t + (1 - (v - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const pts = days.map((d, i) => [px(i), py(d.best1rm)]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L ${pts.at(-1)[0].toFixed(1)} ${H - pad.b} L ${pts[0][0].toFixed(1)} ${H - pad.b} Z`;
  const guides = [maxY, (maxY + minY) / 2, minY].map((v) => {
    const y = py(v);
    return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="var(--stroke)"/><text x="2" y="${y + 4}" fill="var(--text-3)" font-size="11">${v.toFixed(0)}</text>`;
  }).join("");
  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--cal)"/>`).join("");
  return `<svg class="weight-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%">
    ${guides}<path d="${area}" fill="var(--cal)" opacity="0.10"/>
    <path d="${path}" fill="none" stroke="var(--cal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

function stat(label, value, unit, color) {
  return `<div class="card stat-card"><div class="stat-val" style="color:${color}">${value}</div><div class="stat-unit">${unit}</div><div class="stat-label">${label}</div></div>`;
}
function attr(s) { return String(s).replace(/"/g, "&quot;"); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
