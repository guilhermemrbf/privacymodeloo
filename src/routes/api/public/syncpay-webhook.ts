import { createFileRoute } from "@tanstack/react-router";

// Receives SyncPay PIX webhooks (onCreate / onUpdate).
// Currently just logs — extend to persist orders if needed.
export const Route = createFileRoute("/api/public/syncpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => null);
          console.log("[syncpay-webhook]", JSON.stringify(body));
        } catch (e) {
          console.error("[syncpay-webhook] parse error", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
