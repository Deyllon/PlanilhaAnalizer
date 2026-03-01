import type { WhatsAppClient } from "./twilio-client.ts";

export interface NotifyOptions {
  recipient: string;
  templateName?: string;
  templateLanguage?: string;
}

export class WhatsAppNotifier {
  client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.client = client;
  }

  async notify(summaryText: string, options: NotifyOptions): Promise<void> {
    if (options.templateName) {
      await this.client.sendTemplateMessage(
        options.recipient,
        options.templateName,
        options.templateLanguage ?? "pt_BR"
      );
      return;
    }

    await this.client.sendTextMessage(options.recipient, summaryText);
  }
}
