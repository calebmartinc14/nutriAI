# Nutveo — Web (local) 🥗

Versión web del tracker de macros con IA. Pensada para correr **en tu máquina**
sin montar nada en la nube. Frontend en HTML/CSS/JS puro (Vite build) +
un backend Express mínimo que guarda la API key y hace de proxy a la IA.

## Arrancar en local

```bash
cd web
npm install
cp .env.example .env     # opcional: mete tu GEMINI_API_KEY
npm start
```

Abre **http://localhost:3000**.

> 💡 **Funciona aunque NO tengas API key.** Sin clave arranca en **modo demo**:
> el escáner y el coach devuelven datos simulados, así puedes probar toda la app.
> Cuando pongas tu `GEMINI_API_KEY` en `.env`, pasa a IA real automáticamente.

Consigue una clave gratis en https://aistudio.google.com/apikey

## Qué incluye

| Función | Estado |
|---------|--------|
| Dashboard con anillos de calorías + macros (SVG animado) | ✅ |
| Histórico semanal en barras | ✅ |
| Comidas por tramo (Desayuno/Almuerzo/Cena/Snacks) con foto | ✅ |
| Registro manual (gratis, offline, en `localStorage`) | ✅ |
| Escáner de comida por foto → macros (IA / demo) | ✅ |
| Coach Nutricional IA (chat con contexto de tus macros) | ✅ |
| Créditos diarios freemium (3/día) + "Premium" simulado | ✅ |

## Cómo funciona (arquitectura local)

```
Navegador (public/)                 server.js (Express)            Gemini API
  rings, dashboard, chat              /api/analyze-food   --key-->  (solo si hay
  localStorage (persistencia)         /api/coach                     GEMINI_API_KEY)
  comprime la foto a base64           /api/status         <-- demo si no hay key
```

- **La API key nunca llega al navegador**: vive en `.env`, solo la usa el server.
- **Persistencia local**: `localStorage` (equivalente web de SQLite). Funciona offline.
- **Créditos**: aquí se cuentan en el cliente por simplicidad (es local). En una
  app real de producción esto debe ser server-side con auth (ver `../ARCHITECTURE.md`).

## Estructura

```
web/
├── server.js              # Express: estáticos + proxy IA + modo demo
├── vite.config.js         # Configuración de Vite
├── wrangler.toml          # Despliegue a Cloudflare Pages
├── .env.example
├── package.json
├── index.html             # Entry point (Vite)
├── dist/                  # Build de producción
├── public/
│   ├── css/styles.css
│   ├── sw.js              # Service Worker (PWA)
│   └── manifest.json
└── src/
    ├── app.js             # router + header
    ├── store.js           # estado + localStorage
    ├── api.js             # llamadas al backend + compresión imagen
    ├── auth.js            # autenticación Supabase
    ├── cloud.js           # sincronización con Supabase
    ├── config.js          # credenciales Supabase
    ├── lib/
    │   ├── icons.js       # SVG icons
    │   ├── i18n.js        # internacionalización
    │   ├── ranking.js     # sistema de rangos
    │   ├── recipes.js     # escalado de recetas
    │   ├── exercise_db.js # base de datos de ejercicios
    │   └── supabase.js    # cliente Supabase lazy
    └── components/
        ├── rings.js       # anillos SVG
        ├── dashboard.js
        ├── scanner.js
        ├── coach.js
        ├── manual.js      # modal registro manual
        ├── ui.js          # toast + escapeHtml
        ├── ...            # resto de componentes
```
