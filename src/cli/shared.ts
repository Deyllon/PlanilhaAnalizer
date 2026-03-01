import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runJob, type RunJobDependencies, type RunJobOptions, type RunJobResult } from "../application/run-job.ts";
import { GoogleApiSheetsClient } from "../adapters/google-sheets/client.ts";
import { SqliteStorage } from "../adapters/storage/sqlite.ts";
import { TwilioWhatsAppClient } from "../adapters/whatsapp/twilio-client.ts";
import { WhatsAppNotifier } from "../adapters/whatsapp/notifier.ts";
import { loadEnv } from "../config/env.ts";
import { loadSheetsConfig } from "../config/sheets-config.ts";
import { createLogger } from "../utils/logger.ts";
import type { AppEnv } from "../config/env.ts";

export function createWhatsAppNotifierFromEnv(env: AppEnv): WhatsAppNotifier | undefined {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioWhatsappFrom) {
    return undefined;
  }

  return new WhatsAppNotifier(
    new TwilioWhatsAppClient({
      accountSid: env.twilioAccountSid,
      authToken: env.twilioAuthToken,
      from: env.twilioWhatsappFrom,
      contentSid: env.twilioContentSid
    })
  );
}

export function createRuntimeDependencies(): RunJobDependencies {
  const env = loadEnv();
  const config = loadSheetsConfig(env.sheetsConfigPath);
  const logger = createLogger();

  const credentialsJson =
    env.googleServiceAccountJson ??
    (env.googleServiceAccountFile
      ? readFileSync(resolve(process.cwd(), env.googleServiceAccountFile), "utf8")
      : undefined);

  if (!credentialsJson) {
    throw new Error("Google service account credentials are required");
  }

  const sheetsClient = new GoogleApiSheetsClient(credentialsJson);
  const storage = new SqliteStorage(env.databaseUrl);
  const notifier = createWhatsAppNotifierFromEnv(env);

  return {
    env,
    config,
    sheetsClient,
    storage,
    logger,
    notifier
  };
}

export async function executeCli(options: RunJobOptions = {}): Promise<RunJobResult> {
  const dependencies = createRuntimeDependencies();
  try {
    return await runJob(dependencies, options);
  } finally {
    dependencies.storage.close();
  }
}
