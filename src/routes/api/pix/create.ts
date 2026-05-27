import { createFileRoute } from "@tanstack/react-router";

const SYNCPAY_BASE = "https://api.syncpay.pro/api/partner/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SyncPay credentials not configured");
  }
  const res = await fetch(`${SYNCPAY_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`Auth failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/pix/create")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const amount = Number(body?.amount);
          const client = body?.client ?? {};
          const description = String(body?.description ?? "Assinatura");

          if (!amount || amount <= 0) {
            return Response.json(
              { error: "Invalid amount" },
              { status: 400, headers: CORS },
            );
          }
          if (!client.name || !client.cpf || !client.email || !client.phone) {
            return Response.json(
              { error: "Missing client data (name, cpf, email, phone)" },
              { status: 400, headers: CORS },
            );
          }

          const token = await getAccessToken();

          const url = new URL(request.url);
          const webhookUrl = `${url.origin}/api/public/syncpay-webhook`;

          const payload = {
            amount,
            description,
            webhook_url: webhookUrl,
            client: {
              name: String(client.name),
              cpf: String(client.cpf).replace(/\D/g, ""),
              email: String(client.email),
              phone: String(client.phone).replace(/\D/g, ""),
            },
          };

          const res = await fetch(`${SYNCPAY_BASE}/cash-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            return Response.json(
              { error: data?.message ?? "SyncPay error", details: data },
              { status: res.status, headers: CORS },
            );
          }
          return Response.json(
            {
              pix_code: data.pix_code,
              identifier: data.identifier,
            },
            { headers: CORS },
          );
        } catch (err: any) {
          console.error("PIX create error:", err);
          return Response.json(
            { error: err?.message ?? "Internal error" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
