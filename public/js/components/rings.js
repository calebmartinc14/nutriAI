// Render de anillos de progreso con SVG puro (sin librerias).

const styles = getComputedStyle(document.documentElement);
const COLORS = {
  cal: styles.getPropertyValue("--cal").trim() || "#00e5a8",
  protein: styles.getPropertyValue("--protein").trim() || "#5b8def",
  carbs: styles.getPropertyValue("--carbs").trim() || "#ffb020",
  fat: styles.getPropertyValue("--fat").trim() || "#ff6b6b",
};

function ring({ size, stroke, color, progress, content }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  // Arrancamos en 0 (lleno) y animamos al valor via stroke-dashoffset.
  const offset = c * (1 - clamped);
  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg class="ring" width="${size}" height="${size}">
        <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"></circle>
        <circle class="ring-progress" cx="${size / 2}" cy="${size / 2}" r="${r}"
          stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${c}" stroke-dashoffset="${c}"
          data-target-offset="${offset}"></circle>
      </svg>
      <div class="ring-label-inner">${content}</div>
    </div>`;
}

export function calorieRing(consumed, target) {
  const progress = target > 0 ? consumed / target : 0;
  const remaining = Math.max(0, Math.round(target - consumed));
  return ring({
    size: 220,
    stroke: 16,
    color: COLORS.cal,
    progress,
    content: `
      <div class="calorie-center">
        <div class="calorie-number">${remaining}</div>
        <div class="calorie-sub">kcal restantes</div>
        <div class="calorie-frac">${Math.round(consumed)} / ${Math.round(target)}</div>
      </div>`,
  });
}

export function macroRing(label, consumed, target, colorKey) {
  const progress = target > 0 ? consumed / target : 0;
  return `
    <div class="macro-ring">
      ${ring({
        size: 78,
        stroke: 9,
        color: COLORS[colorKey],
        progress,
        content: `<span class="mr-val">${Math.round(consumed)}g</span>`,
      })}
      <div>
        <div class="mr-label">${label}</div>
        <div class="mr-target">de ${Math.round(target)}g</div>
      </div>
    </div>`;
}

// Dispara la animacion: pone el offset objetivo tras pintar (next frame).
export function animateRings(container) {
  requestAnimationFrame(() => {
    container.querySelectorAll(".ring-progress").forEach((el) => {
      el.style.strokeDashoffset = el.dataset.targetOffset;
    });
  });
}
