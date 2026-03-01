import assert from "node:assert/strict";
import test from "node:test";
import { TwilioWhatsAppClient } from "../../src/adapters/whatsapp/twilio-client.ts";

test("TwilioWhatsAppClient sends text message using Twilio API", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 201
    } as Response;
  }) as typeof fetch;

  try {
    const client = new TwilioWhatsAppClient({
      accountSid: "AC123",
      authToken: "secret",
      from: "whatsapp:+14155238886"
    });

    await client.sendTextMessage("whatsapp:+5511999999999", "hello from twilio");

    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /api\.twilio\.com/u);
    assert.equal(calls[0]?.init?.method, "POST");
    const body = calls[0]?.init?.body as URLSearchParams;
    assert.equal(body.get("From"), "whatsapp:+14155238886");
    assert.equal(body.get("To"), "whatsapp:+5511999999999");
    assert.equal(body.get("Body"), "hello from twilio");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
