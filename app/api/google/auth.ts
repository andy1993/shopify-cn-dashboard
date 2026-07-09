import { createSign } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

export const GOOGLE_SCOPES = {
  webmasters: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
} as const;

export type GoogleScopeKey = keyof typeof GOOGLE_SCOPES;

function resolveScope(scope: string | GoogleScopeKey): string {
  if (scope in GOOGLE_SCOPES) {
    return GOOGLE_SCOPES[scope as GoogleScopeKey];
  }
  return scope;
}

/**
 * 用服务账号私钥签发 1 小时有效的 Google OAuth2 JWT（RS256）。
 * scope 支持传入完整 URL 或 GOOGLE_SCOPES 的键名。
 */
export function generateGoogleJWT(
  credentials: GoogleServiceAccount,
  scope: string | GoogleScopeKey,
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: resolveScope(scope),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Claim = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const signInput = b64Header + "." + b64Claim;
  const sign = createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, "base64url");
  return signInput + "." + signature;
}

/**
 * 用 JWT 换取 Google 访问令牌（access_token）。
 * scope 支持传入完整 URL 或 GOOGLE_SCOPES 的键名。
 */
export async function getGoogleAccessToken(
  credentials: GoogleServiceAccount,
  scope: string | GoogleScopeKey,
): Promise<string> {
  const jwt = generateGoogleJWT(credentials, scope);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Google 认证失败: HTTP " + res.status);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
