import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AppEnv {
  appTimezone: string;
  googleServiceAccountJson?: string;
  googleServiceAccountFile?: string;
  whatsappProvider: "twilio";
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsappFrom?: string;
  twilioContentSid?: string;
  whatsappRecipient?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLang?: string;
  databaseUrl: string;
  sheetsConfigPath: string;
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values[key] = value;
  }
  return values;
}

export function loadEnv(cwd = process.cwd()): AppEnv {
  const envPath = resolve(cwd, ".env");
  const fileValues = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, "utf8")) : {};
  const read = (name: string) => process.env[name] ?? fileValues[name];

  return {
    appTimezone: read("APP_TIMEZONE") ?? "America/Sao_Paulo",
    googleServiceAccountJson: read("GOOGLE_SERVICE_ACCOUNT_JSON"),
    googleServiceAccountFile: read("GOOGLE_SERVICE_ACCOUNT_FILE"),
    whatsappProvider: "twilio",
    twilioAccountSid: read("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: read("TWILIO_AUTH_TOKEN"),
    twilioWhatsappFrom: read("TWILIO_WHATSAPP_FROM"),
    twilioContentSid: read("TWILIO_CONTENT_SID"),
    whatsappRecipient: read("WHATSAPP_RECIPIENT"),
    whatsappTemplateName: read("WHATSAPP_TEMPLATE_NAME"),
    whatsappTemplateLang: read("WHATSAPP_TEMPLATE_LANG") ?? "pt_BR",
    databaseUrl: read("DATABASE_URL") ?? "./data/app.db",
    sheetsConfigPath: read("SHEETS_CONFIG_PATH") ?? "./config/sheets.config.json"
  };
}
