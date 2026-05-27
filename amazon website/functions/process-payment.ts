export default async function(req: Request): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId, amount, currency = "usd", successUrl, cancelUrl } = await req.json();
    
    // Demo mode: return mock checkout URL
    const mockSessionId = `demo_${Date.now()}`;
    
    return new Response(
      JSON.stringify({
        sessionId: mockSessionId,
        url: successUrl + "?session_id=" + mockSessionId,
        demo: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
