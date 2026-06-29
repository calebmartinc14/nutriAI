// ===========================================================================
// Configuración de la nube (Supabase).
//
// Si dejas estos valores VACÍOS, la app funciona en MODO LOCAL (como hasta
// ahora: sin login, datos solo en este navegador).
//
// Para activar login + datos en la nube + liga de amigos, pega aquí la URL y
// la "anon key" de tu proyecto Supabase (Project Settings → API).
// Estos dos valores son PÚBLICOS y es seguro tenerlos en el cliente.
// ===========================================================================

export const SUPABASE_URL = "https://ndhdlstgfvmcruljbxbl.supabase.co"; // ej. "https://abcd1234.supabase.co"
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGRsc3RnZnZtY3J1bGpieGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjA3MTYsImV4cCI6MjA5ODI5NjcxNn0.N1bjCfyukDrjflrCmgd1K2qLfU46qSOW0sw8ug6Z13s"; 

export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
