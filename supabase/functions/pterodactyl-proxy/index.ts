const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const PANEL_URL = Deno.env.get("PTERODACTYL_PANEL_URL");
  if (!PANEL_URL) {
    return new Response(JSON.stringify({ error: "Panel URL not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const API_KEY = Deno.env.get("PTERODACTYL_API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "servers";

    let apiPath: string;
    switch (endpoint) {
      case "servers":
        apiPath = "/api/application/servers?per_page=50";
        break;
      case "nodes":
        apiPath = "/api/application/nodes?per_page=50";
        break;
      case "node-config": {
        const nodeId = url.searchParams.get("node_id");
        if (!nodeId) throw new Error("node_id required");
        apiPath = `/api/application/nodes/${nodeId}/configuration`;
        break;
      }
      case "allocations": {
        const nodeId = url.searchParams.get("node_id");
        if (!nodeId) throw new Error("node_id required");
        apiPath = `/api/application/nodes/${nodeId}/allocations?per_page=100`;
        break;
      }
      default:
        apiPath = "/api/application/servers?per_page=50";
    }

    const baseUrl = PANEL_URL.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}${apiPath}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Pterodactyl API error [${response.status}]: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Panel returned ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Pterodactyl proxy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
