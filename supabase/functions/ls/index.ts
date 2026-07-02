// ===========================================================================
// Edge Function "ls" · Pagos Premium con Lemon Squeezy
// Despliegue:  supabase functions deploy ls --no-verify-jwt
// Secretos: supabase secrets set LEMONSQUEEZY_API_KEY=xxx
//           supabase secrets set LEMONSQUEEZY_STORE_ID=xxx
//           supabase secrets set LEMONSQUEEZY_VARIANT_ID=xxx
//           supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=xxx
//           supabase secrets set APP_URL=https://nutveo.pages.dev
//           supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
// ===========================================================================

const LS_API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY") ?? "";
const STORE_ID = Deno.env.get("LEMONSQUEEZY_STORE_ID") ?? "";
const VARIANT_ID = Deno.env.get("LEMONSQUEEZY_VARIANT_ID") ?? "";
const WEBHOOK_SECRET = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CONFIGURED = !!(LS_API_KEY && STORE_ID && VARIANT_ID);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  // -----------------------------------------------------------------------
  // WEBHOOK de Lemon Squeezy (LS nos avisa de que alguien pagó)
  // -----------------------------------------------------------------------
  if (action === "webhook") {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";

    if (WEBHOOK_SECRET && signature) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const sigBytes = hexToBytes(signature);
      const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(rawBody));
      if (!ok) {
        console.warn("LS webhook: firma inválida");
        return json({ error: "invalid signature" }, 401);
      }
    }

    let event: any;
    try { event = JSON.parse(rawBody); }
    catch { return json({ error: "invalid json" }, 400); }

    const eventName = event.meta?.event_name;
    if (eventName === "order_created") {
      const custom = event.meta?.custom_data || {};
      const checkoutId = custom.checkout_id;
      const email = event.data?.attributes?.user_email || "unknown";

      if (checkoutId && SB_URL && SB_SERVICE_KEY) {
        // Buscar el usuario por email en Supabase Auth y marcar premium
        try {
          const userRes = await fetch(
            `${SB_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
            { headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` } },
          );
          const userData = await userRes.json();
          const userId = userData?.users?.[0]?.id;
          if (userId) {
            await fetch(`${SB_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: SB_SERVICE_KEY,
                Authorization: `Bearer ${SB_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                is_premium: true,
                premium_since: new Date().toISOString(),
                checkout_id: checkoutId,
              }),
            });
            console.log("LS: premium activado para", email, userId);
          }
        } catch (e) {
          console.error("LS: error actualizando perfil:", e);
        }
      }
    }

    return json({ received: true });
  }

  // -----------------------------------------------------------------------
  // Crear checkout (lo llama el frontend cuando el usuario pulsa "Premium")
  // -----------------------------------------------------------------------
  if (action === "create-checkout") {
    if (!CONFIGURED) {
      return json({ error: "Lemon Squeezy no configurado. El administrador debe añadir las claves." }, 400);
    }

    const checkoutId = crypto.randomUUID();
    try {
      const lsRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LS_API_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              checkout_data: {
                custom: { checkout_id: checkoutId },
                success_url: `${APP_URL}/?premium=success&checkout_id=${checkoutId}`,
                cancel_url: `${APP_URL}/?premium=cancelled`,
              },
            },
            relationships: {
              store: { data: { type: "stores", id: STORE_ID } },
              variant: { data: { type: "variants", id: VARIANT_ID } },
            },
          },
        }),
      });

      if (!lsRes.ok) {
        const err = await lsRes.text();
        console.error("LS checkout error:", lsRes.status, err);
        return json({ error: "Error creando el pago en Lemon Squeezy" }, 502);
      }

      const body = await lsRes.json();
      const checkoutUrl = body?.data?.attributes?.url;
      if (!checkoutUrl) return json({ error: "Lemon Squeezy no devolvió URL" }, 502);

      return json({ url: checkoutUrl, checkout_id: checkoutId });
    } catch (e) {
      console.error("LS checkout exception:", e);
      return json({ error: "Error de conexión con Lemon Squeezy" }, 502);
    }
  }

  // -----------------------------------------------------------------------
  // Confirmar si un checkout fue pagado (lo llama el frontend al volver)
  // -----------------------------------------------------------------------
  if (action === "confirm") {
    const checkoutId = url.searchParams.get("checkout_id");
    if (!checkoutId) return json({ paid: false });

    if (SB_URL && SB_SERVICE_KEY) {
      try {
        const res = await fetch(
          `${SB_URL}/rest/v1/profiles?checkout_id=eq.${checkoutId}&select=is_premium`,
          { headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` } },
        );
        const rows = await res.json();
        return json({ paid: rows?.[0]?.is_premium === true });
      } catch {
        return json({ paid: false });
      }
    }
    return json({ paid: false });
  }

  return json({ error: "Acción desconocida. Usa ?action=create-checkout|webhook|confirm" }, 400);
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
