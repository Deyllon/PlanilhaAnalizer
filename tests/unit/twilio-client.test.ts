import assert from "node:assert/strict";
import test from "node:test";
import { TwilioWhatsAppClient } from "../../src/adapters/whatsapp/twilio-client.ts";

test("TwilioWhatsAppClient builds Basic auth and text payload", () => {
  const client = new TwilioWhatsAppClient({
    accountSid: "AC123",
    authToken: "secret",
    from: "whatsapp:+14155238886"
  });

  const headers = client.buildHeaders();
  const payload = client.buildTextPayload("whatsapp:+5511999999999", "hello");

  assert.equal(
    headers.authorization,
    `Basic ${Buffer.from("AC123:secret").toString("base64")}`
  );
  assert.equal(headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(payload.get("From"), "whatsapp:+14155238886");
  assert.equal(payload.get("To"), "whatsapp:+5511999999999");
  assert.equal(payload.get("Body"), "hello");
});

test("TwilioWhatsAppClient rejects template sending without content sid", async () => {
  const client = new TwilioWhatsAppClient({
    accountSid: "AC123",
    authToken: "secret",
    from: "whatsapp:+14155238886"
  });

  await assert.rejects(
    client.sendTemplateMessage("whatsapp:+5511999999999", "template", "pt_BR"),
    /TWILIO_CONTENT_SID/u
  );
});
