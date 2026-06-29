import { CLOUD_ENABLED } from "../lib/supabase.js";
import { TIERS } from "../lib/ranking.js";
import { store } from "../store.js";
import * as cloud from "../cloud.js";
import { toast } from "./ui.js";

export function renderLeague(root) {
  if (!CLOUD_ENABLED) {
    root.innerHTML = `
      <div class="weight-head"><h2 class="page-title">Liga de amigos</h2></div>
      <div class="card rank-empty">
        <div class="rank-empty-emoji">🌐</div>
        <h3>Necesitas la versión en la nube</h3>
        <p>Para competir con tus amigos hay que activar el login (Supabase). Mientras uses la versión local, esta sección no está disponible.</p>
      </div>`;
    return;
  }
  draw(root);
}

async function draw(root) {
  root.innerHTML = `
    <div class="weight-head">
      <h2 class="page-title">Liga de amigos 🏆</h2>
      <p class="page-sub">Compite con tus colegas por el mejor rango de fuerza.</p>
    </div>

    <div class="card league-actions">
      <div class="la-row">
        <input id="lg-join" type="text" placeholder="Código de liga (ej. AB12CD)" maxlength="6" />
        <button class="btn btn-primary" id="lg-join-btn">Unirme</button>
      </div>
      <div class="la-row">
        <input id="lg-name" type="text" placeholder="Nombre de una nueva liga" />
        <button class="btn btn-ghost" id="lg-create-btn">Crear liga</button>
      </div>
    </div>

    <div id="lg-content"><div class="spinner" style="margin:24px auto"></div></div>
  `;

  root.querySelector("#lg-join-btn").addEventListener("click", async () => {
    const code = root.querySelector("#lg-join").value.trim();
    if (!code) return toast("Pon el código de la liga");
    try { await cloud.joinLeague(code); toast("¡Te uniste a la liga! 🎉"); draw(root); }
    catch (e) { toast(e.message || "No se pudo unir"); }
  });

  root.querySelector("#lg-create-btn").addEventListener("click", async () => {
    const name = root.querySelector("#lg-name").value.trim();
    if (!name) return toast("Pon un nombre para la liga");
    try { const lg = await cloud.createLeague(name); toast(`Liga creada · código ${lg.code}`); draw(root); }
    catch (e) { toast(e.message || "No se pudo crear"); }
  });

  // Cargar mis ligas y su clasificación
  const content = root.querySelector("#lg-content");
  try {
    const leagues = await cloud.myLeagues();
    if (!leagues.length) {
      content.innerHTML = `<p class="hist-note">Aún no estás en ninguna liga. Crea una y comparte el código con tus amigos, o únete con un código.</p>`;
      return;
    }
    const blocks = await Promise.all(leagues.map(async (lg) => {
      const board = await cloud.leagueLeaderboard(lg.id);
      return leagueBlock(lg, board);
    }));
    content.innerHTML = blocks.join("");
  } catch (e) {
    content.innerHTML = `<p class="hist-note">No se pudo cargar la liga: ${e.message}</p>`;
  }
}

function leagueBlock(lg, board) {
  const myName = store.username();
  return `
    <div class="section-title" style="margin-top:24px">${escapeHtml(lg.name)}
      <span class="league-code">código: <b>${lg.code}</b></span>
    </div>
    <div class="board">
      ${board.map((row, i) => boardRow(row, i + 1, row.username === myName)).join("")}
    </div>`;
}

function boardRow(row, pos, isMe) {
  const tier = TIERS[row.rank_index] ?? TIERS[0];
  const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}.`;
  return `
    <div class="card board-row ${isMe ? "me" : ""}" style="--tc:${tier.color}">
      <span class="br-pos">${medal}</span>
      <span class="br-name">${escapeHtml(row.username ?? "—")}${isMe ? " (tú)" : ""}</span>
      <span class="br-tier">${tier.emoji} ${tier.label}</span>
      <span class="br-score">${row.sessions_total ?? 0} 🏋️</span>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
