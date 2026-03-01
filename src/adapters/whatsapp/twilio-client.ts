export interface TwilioWhatsAppClientOptions {
  accountSid: string;
  authToken: string;
  from: string;
  contentSid?: string;
}

export interface WhatsAppClient {
  sendTextMessage(recipient: string, body: string): Promise<void>;
  sendTemplateMessage(recipient: string, templateName: string, languageCode: string): Promise<void>;
}

function toBasicAuth(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export class TwilioWhatsAppClient implements WhatsAppClient {
  options: TwilioWhatsAppClientOptions;

  constructor(options: TwilioWhatsAppClientOptions) {
    this.options = options;
  }

  buildHeaders(): Record<string, string> {
    return {
      authorization: toBasicAuth(this.options.accountSid, this.options.authToken),
      "content-type": "application/x-www-form-urlencoded"
    };
  }

  buildTextPayload(recipient: string, body: string): URLSearchParams {
    return new URLSearchParams({
      From: this.options.from,
      To: recipient,
      Body: body
    });
  }

  async sendTextMessage(recipient: string, body: string): Promise<void> {
    await this.send(this.buildTextPayload(recipient, body));
  }

  async sendTemplateMessage(
    recipient: string,
    templateName: string,
    languageCode: string
  ): Promise<void> {
    if (!this.options.contentSid) {
      throw new Error(
        "Twilio template sending requires TWILIO_CONTENT_SID. Configure it or send plain text only."
      );
    }

    const payload = new URLSearchParams({
      From: this.options.from,
      To: recipient,
      ContentSid: this.options.contentSid
    });

    if (templateName || languageCode) {
      payload.set(
        "ContentVariables",
        JSON.stringify({
          templateName,
          languageCode
        })
      );
    }

    await this.send(payload);
  }

  async send(payload: URLSearchParams): Promise<void> {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.options.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: payload
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio WhatsApp send failed: ${response.status}`);
    }
  }
}
