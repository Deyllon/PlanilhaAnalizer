import { createPrivateKey, createSign } from "node:crypto";
import { readFileSync } from "node:fs";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function signJwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const content = `${header}.${body}`;
  const signer = createSign("RSA-SHA256");
  signer.update(content);
  signer.end();
  const signature = signer.sign(createPrivateKey(privateKeyPem));
  return `${content}.${toBase64Url(signature)}`;
}

export interface GoogleSheetsClient {
  getSheetValues(sheetId: string, range: string): Promise<string[][]>;
}

export class GoogleApiSheetsClient implements GoogleSheetsClient {
  credentials: ServiceAccountCredentials;
  accessToken: string | null;
  accessTokenExpiresAt: number;

  constructor(credentialsJson: string) {
    this.credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  static fromFile(path: string): GoogleApiSheetsClient {
    return new GoogleApiSheetsClient(readFileSync(path, "utf8"));
  }

  async fetchAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 30_000) {
      return this.accessToken;
    }

    const tokenUri = this.credentials.token_uri ?? "https://oauth2.googleapis.com/token";
    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      {
        iss: this.credentials.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: tokenUri,
        iat: now,
        exp: now + 3600
      },
      this.credentials.private_key
    );

    const response = await fetch(tokenUri, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });

    if (!response.ok) {
      throw new Error(`Google OAuth token request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = Date.now() + payload.expires_in * 1000;
    return payload.access_token;
  }

  async getSheetValues(sheetId: string, range: string): Promise<string[][]> {
    const token = await this.fetchAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Google Sheets read failed: ${response.status}`);
    }

    const payload = (await response.json()) as { values?: string[][] };
    return payload.values ?? [];
  }
}
