// Internacionalización (i18n). Motor sencillo: t(clave) devuelve el texto en el
// idioma activo. Cambiar idioma no recarga la página (se re-renderiza la vista).
import { store } from "../store.js";

export const LANGS = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const DICT = {
  es: {
    "nav.dashboard": "Inicio", "nav.scanner": "Escanear plato", "nav.products": "Productos",
    "nav.recipes": "Recetas", "nav.history": "Historial", "nav.weight": "Peso",
    "nav.workout": "Entreno", "nav.progress": "Progreso", "nav.rank": "Rango",
    "nav.league": "Liga", "nav.coach": "Coach IA", "nav.profile": "Mi perfil",
    "nav.signout": "Cerrar sesión",
    "greet.morning": "Buenos días 👋", "greet.afternoon": "Buenas tardes 👋", "greet.evening": "Buenas noches 👋",
    "common.language": "Idioma",
  },
  en: {
    "nav.dashboard": "Home", "nav.scanner": "Scan meal", "nav.products": "Products",
    "nav.recipes": "Recipes", "nav.history": "History", "nav.weight": "Weight",
    "nav.workout": "Training", "nav.progress": "Progress", "nav.rank": "Rank",
    "nav.league": "League", "nav.coach": "AI Coach", "nav.profile": "My profile",
    "nav.signout": "Sign out",
    "greet.morning": "Good morning 👋", "greet.afternoon": "Good afternoon 👋", "greet.evening": "Good evening 👋",
    "common.language": "Language",
  },
  fr: {
    "nav.dashboard": "Accueil", "nav.scanner": "Scanner un plat", "nav.products": "Produits",
    "nav.recipes": "Recettes", "nav.history": "Historique", "nav.weight": "Poids",
    "nav.workout": "Entraînement", "nav.progress": "Progrès", "nav.rank": "Rang",
    "nav.league": "Ligue", "nav.coach": "Coach IA", "nav.profile": "Mon profil",
    "nav.signout": "Déconnexion",
    "greet.morning": "Bonjour 👋", "greet.afternoon": "Bon après-midi 👋", "greet.evening": "Bonsoir 👋",
    "common.language": "Langue",
  },
};

let lang = store.lang() || (navigator.language || "es").slice(0, 2);
if (!DICT[lang]) lang = "es";

export function getLang() { return lang; }

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  store.setLang(l);
}

export function t(key) {
  return DICT[lang]?.[key] ?? DICT.es[key] ?? key;
}

// Aplica las traducciones a cualquier elemento con [data-i18n] (texto) en el DOM.
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
}
