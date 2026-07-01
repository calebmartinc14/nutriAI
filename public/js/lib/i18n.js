// Internacionalización (i18n). Motor sencillo: t(clave, params) devuelve el texto
// en el idioma activo. Cambiar idioma no recarga la página (se re-renderiza la vista).
import { store } from "../store.js";

export const LANGS = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const DICT = {
  es: {
    // Navegación / shell
    "nav.dashboard": "Inicio", "nav.scanner": "Escanear plato", "nav.products": "Productos",
    "nav.recipes": "Recetas", "nav.history": "Historial", "nav.weight": "Peso",
    "nav.workout": "Entreno", "nav.progress": "Progreso", "nav.rank": "Rango",
    "nav.league": "Liga", "nav.coach": "Coach IA", "nav.profile": "Mi perfil",
    "nav.signout": "Cerrar sesión",
    "greet.morning": "Buenos días 👋", "greet.afternoon": "Buenas tardes 👋", "greet.evening": "Buenas noches 👋",
    "common.language": "Idioma",

    // Comunes
    "common.save": "Guardar", "common.cancel": "Cancelar", "common.delete": "Borrar",
    "common.add": "Añadir", "common.retry": "Reintentar", "common.saved": "Guardado ✅",
    "common.days": "días", "common.day": "día", "unit.kcal": "kcal", "unit.g": "g", "unit.kg": "kg",

    // Tramos de comida
    "slot.breakfast": "Desayuno", "slot.lunch": "Almuerzo", "slot.dinner": "Cena", "slot.snacks": "Snacks",

    // Macros
    "macro.calories": "Calorías", "macro.protein": "Proteínas", "macro.carbs": "Carbohidratos", "macro.fat": "Grasas",
    "macro.carbs.short": "Carbos",
    "macro.perday": "g/día",

    // Objetivos
    "goal.lose": "Perder grasa", "goal.maintain": "Mantener", "goal.gain": "Ganar músculo",

    // Dashboard
    "dash.plan": "Tu plan", "dash.maintenance": "Mantenimiento (kcal)", "dash.goalKcal": "Objetivo (kcal)",
    "dash.maintword": "Mantenimiento", "dash.goalLabel": "Meta", "dash.macros": "Macros",
    "dash.week": "Esta semana", "dash.water": "💧 Agua", "dash.mealsToday": "Comidas de hoy",
    "dash.repeatYesterday": "↻ Repetir ayer", "dash.progress": "Tu progreso",
    "dash.streak": "{n} {days} registrando comida", "dash.weeklyReview": "✨ Repaso semanal",
    "dash.achievements": "Logros ({earned}/{total})", "dash.slotEmpty": "Sin registros — toca ＋ o escanea un plato",
    "dash.addManual": "Añadir manual",
    "dash.noYesterday": "No había comidas registradas ayer", "dash.copiedYesterday": "Copiadas {n} comidas de ayer ✅",
    "ring.remaining": "kcal restantes", "ring.of": "de {n}g",

    // Repaso semanal
    "wr.title": "✨ Repaso semanal", "wr.kcalday": "kcal/día", "wr.trainings": "entrenos",
    "wr.streak": "racha", "wr.error": "No se pudo generar el repaso. Revisa la conexión.",
    "wr.prompt": "Hazme un repaso breve y motivador de mi semana. Datos: media de {avg} kcal/día (objetivo {goal}), {sessions} entrenos esta semana, racha de {streak} días registrando comida, cambio de peso {wchange} kg. Dame 2-3 frases de resumen y un consejo concreto para la semana que viene.",

    // Logros (medallas)
    "ach.first": "Primer registro", "ach.streak7": "Racha 7 días", "ach.streak30": "Racha 30 días",
    "ach.goal": "Objetivo diario cumplido", "ach.ai": "Escáner con IA", "ach.recipe": "Receta propia creada",
    "ach.train1": "Primer entreno", "ach.train10": "10 entrenos", "ach.lift": "Primera serie registrada",
    "ach.weigh": "Peso registrado",

    // Escáner
    "scan.title": "Escanea tu plato", "scan.subtitle": "Toma o sube una foto y la IA estimará calorías y macros automáticamente.",
    "scan.descPlaceholder": "Describe los alimentos para más precisión (opcional). Ej: pechuga de pollo, 150g de arroz y aceite de oliva",
    "scan.camera": "📷 Cámara", "scan.gallery": "🖼️ Subir foto", "scan.analyzing": "Analizando con IA…",
    "scan.confidence": "Confianza {n}%", "scan.saveDiary": "Guardar en mi diario", "scan.adjust": "Ajustar valores",
    "scan.retryPhoto": "Repetir foto", "scan.oops": "Ups", "scan.readError": "No se pudo leer la imagen",
    "scan.isMeal": "Es el {slot}",

    // Modal manual
    "manual.editTitle": "Editar comida", "manual.confirmTitle": "Confirmar comida", "manual.addTitle": "Añadir comida",
    "manual.favorites": "★ Favoritos", "manual.recents": "Recientes",
    "manual.qaHint": "Toca un alimento para añadirlo al tramo seleccionado.",
    "manual.name": "Nombre", "manual.namePlaceholder": "Ej. Pechuga con arroz", "manual.slot": "Tramo",
    "manual.protein": "Proteína (g)", "manual.carbs": "Carbos (g)", "manual.fat": "Grasas (g)",
    "manual.needName": "Ponle un nombre a la comida", "manual.updated": "Comida actualizada ✅",
    "manual.added": "Añadido: {name}", "manual.favSaved": "Guardado en favoritos ★",
    "manual.rmFav": "Quitar de favoritos", "manual.addFav": "Guardar en favoritos",

    // Productos
    "prod.title": "Buscar productos", "prod.subtitle": "Añade alimentos por peso. Datos de Open Food Facts.",
    "prod.placeholder": "Ej. yogur, atún, pan…", "prod.search": "Buscar",
    "prod.scan": "📷 Escanear código de barras", "prod.onlyHacendado": "Solo Hacendado",
    "prod.noResults": "Sin resultados. Prueba otro término.",
    "prod.connError": "No se pudo conectar con Open Food Facts. Revisa tu conexión e inténtalo de nuevo.",
    "prod.notFound": "Producto no encontrado para ese código.", "prod.lookupError": "No se pudo buscar el producto.",
    "prod.added": "Añadido a tu diario ✅",
    "bc.hint": "Apunta al código de barras…", "bc.manual": "Introducir a mano",
    "bc.prompt": "Introduce el código de barras del producto (los números bajo las barras):",

    // Historial
    "hist.prevWeek": "Semana anterior", "hist.nextWeek": "Semana siguiente", "hist.currentWeek": "Semana actual",
    "hist.dailyAvg": "Media diaria",
    "hist.avgNote": "Promedio sobre {n} día(s) con registros · Total semana: {total} kcal · Objetivo: {goal} kcal/día",
    "hist.dayByDay": "Día a día", "hist.backup": "Copia de seguridad",
    "hist.backupText": "Tus datos se guardan en este navegador. Exporta una copia para no perderlos o moverlos a otro equipo.",
    "hist.export": "⬇ Exportar datos", "hist.import": "⬆ Importar datos", "hist.noRecords": "Sin registros",
    "hist.downloaded": "Copia descargada ✅", "hist.imported": "Datos importados ✅",
    "hist.fileError": "No se pudo leer el archivo",

    // Peso
    "weight.title": "Seguimiento de peso",
    "weight.hint.lose": "Tu objetivo es perder grasa: busca una bajada lenta y constante.",
    "weight.hint.maintain": "Tu objetivo es mantener: vigila que el peso se quede estable.",
    "weight.hint.gain": "Tu objetivo es ganar músculo: busca una subida progresiva.",
    "weight.logToday": "Registrar peso de hoy (kg)", "weight.lastTime": "{kg} kg la última vez",
    "weight.placeholder": "Ej. 80.5", "weight.current": "Peso actual", "weight.totalChange": "Cambio total",
    "weight.last30": "Últimos 30 días", "weight.records": "Registros", "weight.evolution": "Evolución",
    "weight.chartHint": "Registra tu peso al menos 2 días para ver la gráfica 📈",
    "weight.noneYet": "Aún no has registrado tu peso.",
    "weight.invalid": "Pon un peso válido (30-400 kg)", "weight.saved": "Peso guardado ✅",

    // Progreso de fuerza
    "prog.title": "Progreso de fuerza", "prog.subtitle": "Tu 1RM estimado por ejercicio a lo largo del tiempo.",
    "prog.noData": "Aún no hay datos", "prog.noDataText": "Registra series en la pestaña <b>Entreno</b> y aquí verás tu evolución por ejercicio.",
    "prog.current1rm": "1RM actual", "prog.bestMark": "Mejor marca", "prog.change": "Cambio", "prog.records": "Registros",
    "prog.evolution1rm": "Evolución del 1RM", "prog.chartHint": "Registra al menos 2 días para ver la gráfica 📈",
    "prog.history": "Historial",

    // Recetas
    "rec.title": "Recetas", "rec.subtitle": "Las cantidades se ajustan a tus macros objetivo para cada comida.",
    "rec.mine": "Mis recetas", "rec.create": "＋ Crear receta",
    "rec.mineHint": "Crea tus propias recetas con ingredientes, gramos y macros (a mano o con IA).",
    "rec.suggested": "Recetas sugeridas", "rec.ingredients": "Ingredientes", "rec.ingr": "ingr.",
    "rec.addDiary": "Añadir al diario", "rec.newRecipe": "Nueva receta", "rec.name": "Nombre de la receta",
    "rec.namePlaceholder": "Ej. Mi bowl proteico", "rec.ingHint": "gramos + macros (✨ = calcular con IA)",
    "rec.addIngredient": "＋ Añadir ingrediente", "rec.save": "Guardar receta",
    "rec.needName": "Ponle un nombre a la receta", "rec.needIngredient": "Añade al menos un ingrediente",
    "rec.saved": "Receta guardada 📗", "rec.deleted": "Receta borrada", "rec.addedDiary": "Receta añadida a tu diario ✅",
    "rec.needFoodGrams": "Pon el alimento y los gramos primero", "rec.aiError": "No se pudo calcular con IA",
    "rec.ingFood": "Alimento", "rec.aiTitle": "Calcular con IA", "rec.remove": "Quitar",
    "rec.pct": "Esta comida = {pct} de tus macros diarios", "rec.target": "Objetivo",
    "rec.ingAdjusted": "Ingredientes (ajustados)", "rec.steps": "Pasos",
  },

  en: {
    "nav.dashboard": "Home", "nav.scanner": "Scan meal", "nav.products": "Products",
    "nav.recipes": "Recipes", "nav.history": "History", "nav.weight": "Weight",
    "nav.workout": "Training", "nav.progress": "Progress", "nav.rank": "Rank",
    "nav.league": "League", "nav.coach": "AI Coach", "nav.profile": "My profile",
    "nav.signout": "Sign out",
    "greet.morning": "Good morning 👋", "greet.afternoon": "Good afternoon 👋", "greet.evening": "Good evening 👋",
    "common.language": "Language",

    "common.save": "Save", "common.cancel": "Cancel", "common.delete": "Delete",
    "common.add": "Add", "common.retry": "Retry", "common.saved": "Saved ✅",
    "common.days": "days", "common.day": "day", "unit.kcal": "kcal", "unit.g": "g", "unit.kg": "kg",

    "slot.breakfast": "Breakfast", "slot.lunch": "Lunch", "slot.dinner": "Dinner", "slot.snacks": "Snacks",

    "macro.calories": "Calories", "macro.protein": "Protein", "macro.carbs": "Carbs", "macro.fat": "Fat",
    "macro.carbs.short": "Carbs", "macro.perday": "g/day",

    "goal.lose": "Lose fat", "goal.maintain": "Maintain", "goal.gain": "Build muscle",

    "dash.plan": "Your plan", "dash.maintenance": "Maintenance (kcal)", "dash.goalKcal": "Goal (kcal)",
    "dash.maintword": "Maintenance", "dash.goalLabel": "Goal", "dash.macros": "Macros",
    "dash.week": "This week", "dash.water": "💧 Water", "dash.mealsToday": "Today's meals",
    "dash.repeatYesterday": "↻ Repeat yesterday", "dash.progress": "Your progress",
    "dash.streak": "{n} {days} logging food", "dash.weeklyReview": "✨ Weekly review",
    "dash.achievements": "Achievements ({earned}/{total})", "dash.slotEmpty": "No entries — tap ＋ or scan a meal",
    "dash.addManual": "Add manually",
    "dash.noYesterday": "No meals logged yesterday", "dash.copiedYesterday": "Copied {n} meals from yesterday ✅",
    "ring.remaining": "kcal left", "ring.of": "of {n}g",

    "wr.title": "✨ Weekly review", "wr.kcalday": "kcal/day", "wr.trainings": "workouts",
    "wr.streak": "streak", "wr.error": "Couldn't generate the review. Check your connection.",
    "wr.prompt": "Give me a short, motivating review of my week. Data: average of {avg} kcal/day (goal {goal}), {sessions} workouts this week, a {streak}-day food-logging streak, weight change {wchange} kg. Give me 2-3 summary sentences and one concrete tip for next week.",

    "ach.first": "First entry", "ach.streak7": "7-day streak", "ach.streak30": "30-day streak",
    "ach.goal": "Daily goal met", "ach.ai": "AI scanner", "ach.recipe": "Own recipe created",
    "ach.train1": "First workout", "ach.train10": "10 workouts", "ach.lift": "First set logged",
    "ach.weigh": "Weight logged",

    "scan.title": "Scan your meal", "scan.subtitle": "Take or upload a photo and the AI will estimate calories and macros automatically.",
    "scan.descPlaceholder": "Describe the food for more accuracy (optional). E.g.: chicken breast, 150g of rice and olive oil",
    "scan.camera": "📷 Camera", "scan.gallery": "🖼️ Upload photo", "scan.analyzing": "Analyzing with AI…",
    "scan.confidence": "Confidence {n}%", "scan.saveDiary": "Save to my diary", "scan.adjust": "Adjust values",
    "scan.retryPhoto": "Retake photo", "scan.oops": "Oops", "scan.readError": "Couldn't read the image",
    "scan.isMeal": "It's {slot}",

    "manual.editTitle": "Edit meal", "manual.confirmTitle": "Confirm meal", "manual.addTitle": "Add meal",
    "manual.favorites": "★ Favorites", "manual.recents": "Recent",
    "manual.qaHint": "Tap a food to add it to the selected slot.",
    "manual.name": "Name", "manual.namePlaceholder": "E.g. Chicken with rice", "manual.slot": "Slot",
    "manual.protein": "Protein (g)", "manual.carbs": "Carbs (g)", "manual.fat": "Fat (g)",
    "manual.needName": "Give the meal a name", "manual.updated": "Meal updated ✅",
    "manual.added": "Added: {name}", "manual.favSaved": "Saved to favorites ★",
    "manual.rmFav": "Remove from favorites", "manual.addFav": "Save to favorites",

    "prod.title": "Search products", "prod.subtitle": "Add foods by weight. Data from Open Food Facts.",
    "prod.placeholder": "E.g. yogurt, tuna, bread…", "prod.search": "Search",
    "prod.scan": "📷 Scan barcode", "prod.onlyHacendado": "Hacendado only",
    "prod.noResults": "No results. Try another term.",
    "prod.connError": "Couldn't connect to Open Food Facts. Check your connection and try again.",
    "prod.notFound": "No product found for that code.", "prod.lookupError": "Couldn't look up the product.",
    "prod.added": "Added to your diary ✅",
    "bc.hint": "Point at the barcode…", "bc.manual": "Enter manually",
    "bc.prompt": "Enter the product barcode (the numbers under the bars):",

    "hist.prevWeek": "Previous week", "hist.nextWeek": "Next week", "hist.currentWeek": "Current week",
    "hist.dailyAvg": "Daily average",
    "hist.avgNote": "Average over {n} day(s) with entries · Week total: {total} kcal · Goal: {goal} kcal/day",
    "hist.dayByDay": "Day by day", "hist.backup": "Backup",
    "hist.backupText": "Your data is stored in this browser. Export a copy so you don't lose it or to move it to another device.",
    "hist.export": "⬇ Export data", "hist.import": "⬆ Import data", "hist.noRecords": "No entries",
    "hist.downloaded": "Backup downloaded ✅", "hist.imported": "Data imported ✅",
    "hist.fileError": "Couldn't read the file",

    "weight.title": "Weight tracking",
    "weight.hint.lose": "Your goal is to lose fat: aim for a slow, steady drop.",
    "weight.hint.maintain": "Your goal is to maintain: keep your weight stable.",
    "weight.hint.gain": "Your goal is to build muscle: aim for a gradual rise.",
    "weight.logToday": "Log today's weight (kg)", "weight.lastTime": "{kg} kg last time",
    "weight.placeholder": "E.g. 80.5", "weight.current": "Current weight", "weight.totalChange": "Total change",
    "weight.last30": "Last 30 days", "weight.records": "Entries", "weight.evolution": "Evolution",
    "weight.chartHint": "Log your weight on at least 2 days to see the chart 📈",
    "weight.noneYet": "You haven't logged your weight yet.",
    "weight.invalid": "Enter a valid weight (30-400 kg)", "weight.saved": "Weight saved ✅",

    "prog.title": "Strength progress", "prog.subtitle": "Your estimated 1RM per exercise over time.",
    "prog.noData": "No data yet", "prog.noDataText": "Log sets in the <b>Training</b> tab and you'll see your progress per exercise here.",
    "prog.current1rm": "Current 1RM", "prog.bestMark": "Best mark", "prog.change": "Change", "prog.records": "Entries",
    "prog.evolution1rm": "1RM evolution", "prog.chartHint": "Log at least 2 days to see the chart 📈",
    "prog.history": "History",

    "rec.title": "Recipes", "rec.subtitle": "Amounts are adjusted to your target macros for each meal.",
    "rec.mine": "My recipes", "rec.create": "＋ Create recipe",
    "rec.mineHint": "Create your own recipes with ingredients, grams and macros (manually or with AI).",
    "rec.suggested": "Suggested recipes", "rec.ingredients": "Ingredients", "rec.ingr": "ingr.",
    "rec.addDiary": "Add to diary", "rec.newRecipe": "New recipe", "rec.name": "Recipe name",
    "rec.namePlaceholder": "E.g. My protein bowl", "rec.ingHint": "grams + macros (✨ = calculate with AI)",
    "rec.addIngredient": "＋ Add ingredient", "rec.save": "Save recipe",
    "rec.needName": "Give the recipe a name", "rec.needIngredient": "Add at least one ingredient",
    "rec.saved": "Recipe saved 📗", "rec.deleted": "Recipe deleted", "rec.addedDiary": "Recipe added to your diary ✅",
    "rec.needFoodGrams": "Enter the food and grams first", "rec.aiError": "Couldn't calculate with AI",
    "rec.ingFood": "Food", "rec.aiTitle": "Calculate with AI", "rec.remove": "Remove",
    "rec.pct": "This meal = {pct} of your daily macros", "rec.target": "Target",
    "rec.ingAdjusted": "Ingredients (adjusted)", "rec.steps": "Steps",
  },

  fr: {
    "nav.dashboard": "Accueil", "nav.scanner": "Scanner un plat", "nav.products": "Produits",
    "nav.recipes": "Recettes", "nav.history": "Historique", "nav.weight": "Poids",
    "nav.workout": "Entraînement", "nav.progress": "Progrès", "nav.rank": "Rang",
    "nav.league": "Ligue", "nav.coach": "Coach IA", "nav.profile": "Mon profil",
    "nav.signout": "Déconnexion",
    "greet.morning": "Bonjour 👋", "greet.afternoon": "Bon après-midi 👋", "greet.evening": "Bonsoir 👋",
    "common.language": "Langue",

    "common.save": "Enregistrer", "common.cancel": "Annuler", "common.delete": "Supprimer",
    "common.add": "Ajouter", "common.retry": "Réessayer", "common.saved": "Enregistré ✅",
    "common.days": "jours", "common.day": "jour", "unit.kcal": "kcal", "unit.g": "g", "unit.kg": "kg",

    "slot.breakfast": "Petit-déj", "slot.lunch": "Déjeuner", "slot.dinner": "Dîner", "slot.snacks": "En-cas",

    "macro.calories": "Calories", "macro.protein": "Protéines", "macro.carbs": "Glucides", "macro.fat": "Lipides",
    "macro.carbs.short": "Glucides", "macro.perday": "g/jour",

    "goal.lose": "Perdre du gras", "goal.maintain": "Maintenir", "goal.gain": "Prendre du muscle",

    "dash.plan": "Ton plan", "dash.maintenance": "Maintien (kcal)", "dash.goalKcal": "Objectif (kcal)",
    "dash.maintword": "Maintien", "dash.goalLabel": "But", "dash.macros": "Macros",
    "dash.week": "Cette semaine", "dash.water": "💧 Eau", "dash.mealsToday": "Repas du jour",
    "dash.repeatYesterday": "↻ Répéter hier", "dash.progress": "Tes progrès",
    "dash.streak": "{n} {days} de suivi des repas", "dash.weeklyReview": "✨ Bilan hebdo",
    "dash.achievements": "Succès ({earned}/{total})", "dash.slotEmpty": "Aucune entrée — appuie sur ＋ ou scanne un plat",
    "dash.addManual": "Ajouter manuellement",
    "dash.noYesterday": "Aucun repas enregistré hier", "dash.copiedYesterday": "{n} repas d'hier copiés ✅",
    "ring.remaining": "kcal restantes", "ring.of": "sur {n}g",

    "wr.title": "✨ Bilan hebdo", "wr.kcalday": "kcal/jour", "wr.trainings": "séances",
    "wr.streak": "série", "wr.error": "Impossible de générer le bilan. Vérifie ta connexion.",
    "wr.prompt": "Fais-moi un bilan bref et motivant de ma semaine. Données : moyenne de {avg} kcal/jour (objectif {goal}), {sessions} séances cette semaine, série de {streak} jours de suivi des repas, variation de poids {wchange} kg. Donne-moi 2-3 phrases de résumé et un conseil concret pour la semaine prochaine.",

    "ach.first": "Première entrée", "ach.streak7": "Série 7 jours", "ach.streak30": "Série 30 jours",
    "ach.goal": "Objectif quotidien atteint", "ach.ai": "Scanner IA", "ach.recipe": "Recette perso créée",
    "ach.train1": "Première séance", "ach.train10": "10 séances", "ach.lift": "Première série enregistrée",
    "ach.weigh": "Poids enregistré",

    "scan.title": "Scanne ton plat", "scan.subtitle": "Prends ou importe une photo et l'IA estimera les calories et macros automatiquement.",
    "scan.descPlaceholder": "Décris les aliments pour plus de précision (facultatif). Ex : blanc de poulet, 150g de riz et huile d'olive",
    "scan.camera": "📷 Caméra", "scan.gallery": "🖼️ Importer une photo", "scan.analyzing": "Analyse par l'IA…",
    "scan.confidence": "Confiance {n}%", "scan.saveDiary": "Enregistrer dans mon journal", "scan.adjust": "Ajuster les valeurs",
    "scan.retryPhoto": "Reprendre la photo", "scan.oops": "Oups", "scan.readError": "Impossible de lire l'image",
    "scan.isMeal": "C'est le {slot}",

    "manual.editTitle": "Modifier le repas", "manual.confirmTitle": "Confirmer le repas", "manual.addTitle": "Ajouter un repas",
    "manual.favorites": "★ Favoris", "manual.recents": "Récents",
    "manual.qaHint": "Appuie sur un aliment pour l'ajouter au créneau sélectionné.",
    "manual.name": "Nom", "manual.namePlaceholder": "Ex. Poulet avec riz", "manual.slot": "Créneau",
    "manual.protein": "Protéines (g)", "manual.carbs": "Glucides (g)", "manual.fat": "Lipides (g)",
    "manual.needName": "Donne un nom au repas", "manual.updated": "Repas mis à jour ✅",
    "manual.added": "Ajouté : {name}", "manual.favSaved": "Enregistré dans les favoris ★",
    "manual.rmFav": "Retirer des favoris", "manual.addFav": "Enregistrer dans les favoris",

    "prod.title": "Rechercher des produits", "prod.subtitle": "Ajoute des aliments au poids. Données d'Open Food Facts.",
    "prod.placeholder": "Ex. yaourt, thon, pain…", "prod.search": "Rechercher",
    "prod.scan": "📷 Scanner le code-barres", "prod.onlyHacendado": "Hacendado uniquement",
    "prod.noResults": "Aucun résultat. Essaie un autre terme.",
    "prod.connError": "Impossible de se connecter à Open Food Facts. Vérifie ta connexion et réessaie.",
    "prod.notFound": "Aucun produit trouvé pour ce code.", "prod.lookupError": "Impossible de rechercher le produit.",
    "prod.added": "Ajouté à ton journal ✅",
    "bc.hint": "Vise le code-barres…", "bc.manual": "Saisir à la main",
    "bc.prompt": "Saisis le code-barres du produit (les chiffres sous les barres) :",

    "hist.prevWeek": "Semaine précédente", "hist.nextWeek": "Semaine suivante", "hist.currentWeek": "Semaine en cours",
    "hist.dailyAvg": "Moyenne quotidienne",
    "hist.avgNote": "Moyenne sur {n} jour(s) avec entrées · Total semaine : {total} kcal · Objectif : {goal} kcal/jour",
    "hist.dayByDay": "Jour par jour", "hist.backup": "Sauvegarde",
    "hist.backupText": "Tes données sont stockées dans ce navigateur. Exporte une copie pour ne pas les perdre ou les transférer sur un autre appareil.",
    "hist.export": "⬇ Exporter les données", "hist.import": "⬆ Importer les données", "hist.noRecords": "Aucune entrée",
    "hist.downloaded": "Sauvegarde téléchargée ✅", "hist.imported": "Données importées ✅",
    "hist.fileError": "Impossible de lire le fichier",

    "weight.title": "Suivi du poids",
    "weight.hint.lose": "Ton objectif est de perdre du gras : vise une baisse lente et régulière.",
    "weight.hint.maintain": "Ton objectif est de maintenir : garde ton poids stable.",
    "weight.hint.gain": "Ton objectif est de prendre du muscle : vise une hausse progressive.",
    "weight.logToday": "Enregistrer le poids du jour (kg)", "weight.lastTime": "{kg} kg la dernière fois",
    "weight.placeholder": "Ex. 80.5", "weight.current": "Poids actuel", "weight.totalChange": "Variation totale",
    "weight.last30": "30 derniers jours", "weight.records": "Entrées", "weight.evolution": "Évolution",
    "weight.chartHint": "Enregistre ton poids au moins 2 jours pour voir le graphique 📈",
    "weight.noneYet": "Tu n'as pas encore enregistré ton poids.",
    "weight.invalid": "Saisis un poids valide (30-400 kg)", "weight.saved": "Poids enregistré ✅",

    "prog.title": "Progrès de force", "prog.subtitle": "Ton 1RM estimé par exercice au fil du temps.",
    "prog.noData": "Pas encore de données", "prog.noDataText": "Enregistre des séries dans l'onglet <b>Entraînement</b> et tu verras ici ta progression par exercice.",
    "prog.current1rm": "1RM actuel", "prog.bestMark": "Meilleure marque", "prog.change": "Variation", "prog.records": "Entrées",
    "prog.evolution1rm": "Évolution du 1RM", "prog.chartHint": "Enregistre au moins 2 jours pour voir le graphique 📈",
    "prog.history": "Historique",

    "rec.title": "Recettes", "rec.subtitle": "Les quantités s'ajustent à tes macros cibles pour chaque repas.",
    "rec.mine": "Mes recettes", "rec.create": "＋ Créer une recette",
    "rec.mineHint": "Crée tes propres recettes avec ingrédients, grammes et macros (à la main ou avec l'IA).",
    "rec.suggested": "Recettes suggérées", "rec.ingredients": "Ingrédients", "rec.ingr": "ingr.",
    "rec.addDiary": "Ajouter au journal", "rec.newRecipe": "Nouvelle recette", "rec.name": "Nom de la recette",
    "rec.namePlaceholder": "Ex. Mon bowl protéiné", "rec.ingHint": "grammes + macros (✨ = calculer avec l'IA)",
    "rec.addIngredient": "＋ Ajouter un ingrédient", "rec.save": "Enregistrer la recette",
    "rec.needName": "Donne un nom à la recette", "rec.needIngredient": "Ajoute au moins un ingrédient",
    "rec.saved": "Recette enregistrée 📗", "rec.deleted": "Recette supprimée", "rec.addedDiary": "Recette ajoutée à ton journal ✅",
    "rec.needFoodGrams": "Indique l'aliment et les grammes d'abord", "rec.aiError": "Impossible de calculer avec l'IA",
    "rec.ingFood": "Aliment", "rec.aiTitle": "Calculer avec l'IA", "rec.remove": "Retirer",
    "rec.pct": "Ce repas = {pct} de tes macros du jour", "rec.target": "Objectif",
    "rec.ingAdjusted": "Ingrédients (ajustés)", "rec.steps": "Étapes",
  },
};

// Letras de los días (semana empezando en lunes).
const DAY_LETTERS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  fr: ["L", "M", "M", "J", "V", "S", "D"],
};

let lang = store.lang() || (navigator.language || "es").slice(0, 2);
if (!DICT[lang]) lang = "es";

export function getLang() { return lang; }

// Locale para Intl (fechas, números). Devuelve el idioma activo.
export function getLocale() { return lang; }

export function dayLetters() { return DAY_LETTERS[lang] ?? DAY_LETTERS.es; }

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  store.setLang(l);
}

// t(clave) o t(clave, { name: "x" }) para interpolar {name}.
export function t(key, params) {
  let s = DICT[lang]?.[key] ?? DICT.es[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
  return s;
}

// Etiqueta traducida de un tramo de comida por su id.
export function slotLabel(id) { return t("slot." + id); }

// Aplica las traducciones a cualquier elemento con [data-i18n] (texto) en el DOM.
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
}
