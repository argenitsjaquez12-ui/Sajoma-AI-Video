const PIXAZO_BASE = "https://gateway.pixazo.ai";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        ok: true,
        app: "Sajoma AI Video",
        worker: "conectado",
        provider: env.PIXAZO_API_KEY
          ? "configurado"
          : "falta PIXAZO_API_KEY"
      });
    }

    if (url.pathname === "/generate" && request.method === "POST") {
      if (!env.PIXAZO_API_KEY) {
        return json({
          ok: false,
          error: "Falta configurar PIXAZO_API_KEY en Cloudflare."
        }, 503);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return json({
          ok: false,
          error: "Solicitud JSON inválida."
        }, 400);
      }

      if (!body.prompt || typeof body.prompt !== "string") {
        return json({
          ok: false,
          error: "Falta el texto del video."
        }, 400);
      }

      const upstream = await fetch(
        `${PIXAZO_BASE}/ltx-video/v1/text-to-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": env.PIXAZO_API_KEY
          },
          body: JSON.stringify({
            prompt: body.prompt
          })
        }
      );

      const data = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        return json({
          ok: false,
          error:
            data.error ||
            data.message ||
            `Pixazo respondió ${upstream.status}.`
        }, upstream.status);
      }

      return json({
        ok: true,
        request_id: data.request_id,
        status: data.status,
        raw: data
      });
    }

    if (url.pathname === "/status" && request.method === "GET") {
      const requestId = url.searchParams.get("id");

      if (!requestId) {
        return json({
          ok: false,
          error: "Falta el id de la solicitud."
        }, 400);
      }

      if (!env.PIXAZO_API_KEY) {
        return json({
          ok: false,
          error: "Falta PIXAZO_API_KEY."
        }, 503);
      }

      const upstream = await fetch(
        `${PIXAZO_BASE}/v2/requests/status/${encodeURIComponent(requestId)}`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": env.PIXAZO_API_KEY
          }
        }
      );

      const data = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        return json({
          ok: false,
          error:
            data.error ||
            data.message ||
            `Pixazo respondió ${upstream.status}.`
        }, upstream.status);
      }

      const mediaUrl =
        Array.isArray(data?.output?.media_url)
          ? data.output.media_url[0]
          : data?.output?.media_url;

      return json({
        ok: true,
        status: data.status,
        media_url: mediaUrl || null,
        error: data.error || null
      });
    }

    return json({
      ok: false,
      error: "Ruta no encontrada."
    }, 404);
  }
};
