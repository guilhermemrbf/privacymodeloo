import { createFileRoute } from "@tanstack/react-router";

const SYNCPAY_BASE = "https://api.syncpay.pro/api/partner/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SyncPay credentials not configured");
  const res = await fetch(`${SYNCPAY_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error(`Auth failed [${res.status}]`);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/pix/status/$identifier")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        try {
          const token = await getAccessToken();
          const res = await fetch(`${SYNCPAY_BASE}/transaction/${params.identifier}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            return Response.json(
              { error: data?.message ?? "SyncPay error" },
              { status: res.status, headers: CORS },
            );
          }
          return Response.json(
            { status: data?.data?.status ?? "pending", data: data?.data },
            { headers: CORS },
          );
        } catch (err: any) {
          console.error("PIX status error:", err);
          return Response.json({ error: err?.message ?? "Internal error" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
