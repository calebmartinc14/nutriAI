// Landing page explicativa. Se muestra al entrar (antes del login) en modo nube.
// onStart() lleva al formulario de acceso.

const FEATURES = [
  { ico: "📷", t: "Escáner de platos", d: "Haz una foto y la IA estima calorías y macros al instante con visión artificial." },
  { ico: "✦", t: "Coach IA", d: "Un entrenador-nutricionista que conoce tus macros y te guía. Dile lo que comes y lo registra solo." },
  { ico: "◎", t: "Macros dinámicos", d: "Anillos de progreso de calorías, proteínas, carbos y grasas calculados a tu objetivo." },
  { ico: "🏋", t: "Entrenamientos", d: "Rutinas a tu medida, base de ejercicios con técnica en vídeo y progreso de fuerza por ejercicio." },
];

export function renderLanding(onStart) {
  document.body.innerHTML = `
    <div class="landing">
      <header class="lp-nav">
        <div class="lp-brand"><span class="brand-logo">◎</span> Nutveo</div>
        <button class="btn btn-ghost lp-login-btn" id="lp-login">Iniciar sesión</button>
      </header>

      <section class="lp-hero">
        <div class="lp-badge">Tu salud, entrenamiento y nutrición · con IA</div>
        <h1 class="lp-title">Controla tus <span class="lp-accent">calorías y macros</span><br>sin esfuerzo.</h1>
        <p class="lp-sub">Escanea tus platos con una foto, deja que el Coach IA te guíe y sigue tu progreso de nutrición y fuerza. Todo en una app, en modo oscuro y gratis.</p>
        <div class="lp-cta">
          <button class="btn btn-primary lp-start" id="lp-start">Comenzar gratis</button>
          <a class="lp-scroll" href="#features">Ver cómo funciona ↓</a>
        </div>
        <div class="lp-rings">
          <div class="lp-ring" style="--c:var(--cal)">2680<small>kcal</small></div>
          <div class="lp-ring" style="--c:var(--protein)">150<small>prot</small></div>
          <div class="lp-ring" style="--c:var(--carbs)">230<small>carb</small></div>
          <div class="lp-ring" style="--c:var(--fat)">70<small>gras</small></div>
        </div>
      </section>

      <section class="lp-features" id="features">
        ${FEATURES.map((f) => `
          <div class="card lp-feature">
            <div class="lp-feat-ico">${f.ico}</div>
            <h3>${f.t}</h3>
            <p>${f.d}</p>
          </div>`).join("")}
      </section>

      <section class="lp-final">
        <h2>Empieza hoy a comer y entrenar mejor</h2>
        <p>Crea tu cuenta en segundos y compite con tus amigos en el ranking de fuerza.</p>
        <button class="btn btn-primary lp-start" id="lp-start2">Comenzar gratis</button>
      </section>

      <footer class="lp-foot">Nutveo · hecho con ❤ para mejorar tu día a día</footer>
    </div>`;

  const go = () => {
    document.querySelector(".landing")?.classList.add("lp-out");
    setTimeout(onStart, 220); // transición suave antes de mostrar el login
  };
  document.getElementById("lp-login").addEventListener("click", go);
  document.getElementById("lp-start").addEventListener("click", go);
  document.getElementById("lp-start2").addEventListener("click", go);
}
