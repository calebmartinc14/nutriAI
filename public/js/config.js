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

export const SUPABASE_URL = "https://vdvnevzhqavenidmulqy.supabase.co"; // ej. "https://abcd1234.supabase.co"
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdm5ldnpocWF2ZW5pZG11bHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTAwOTIsImV4cCI6MjA5ODQ4NjA5Mn0.4iIkZEvbVDZ6uVlm96FRHIfagOnQa_BfkU4ASxskyO8"; 

export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
