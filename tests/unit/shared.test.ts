import assert from "node:assert/strict";
import test from "node:test";
import { createWhatsAppNotifierFromEnv } from "../../src/cli/shared.ts";
import type { AppEnv } from "../../src/config/env.ts";

function createEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    appTimezone: "America/Sao_Paulo",
    whatsappProvider: "twilio",
    databaseUrl: ":memory:",
    sheetsConfigPath: "./config/sheets.config.json",
    ...overrides
  };
}

test("createWhatsAppNotifierFromEnv returns notifier when Twilio env is complete", () => {
  const notifier = createWhatsAppNotifierFromEnv(
    createEnv({
      twilioAccountSid: "AC123",
      twilioAuthToken: "secret",
      twilioWhatsappFrom: "whatsapp:+14155238886"
    })
  );

  assert.ok(notifier);
});

test("createWhatsAppNotifierFromEnv returns undefined when Twilio env is incomplete", () => {
  const notifier = createWhatsAppNotifierFromEnv(
    createEnv({
      twilioAccountSid: "AC123"
    })
  );

  assert.equal(notifier, undefined);
});
