"use client";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function getSalt(): Uint8Array {
  var raw = localStorage.getItem("shopify_salt");
  if (raw) {
    var bytes = new Uint8Array(JSON.parse(raw));
    return bytes;
  }
  var salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  localStorage.setItem("shopify_salt", JSON.stringify(Array.from(salt)));
  return salt;
}

export async function deriveKey(password: string): Promise<CryptoKey> {
  var salt = getSalt();
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  var algo: any = { name: ALGORITHM, length: KEY_LENGTH };
  return (crypto.subtle as any).deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    algo,
    false,
    ["encrypt", "decrypt"]
  ) as Promise<CryptoKey>;
}

export async function encryptData(data: string, password: string): Promise<string> {
  var key = await deriveKey(password);
  var iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  var enc = new TextEncoder();
  var encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    enc.encode(data)
  );
  var combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  var binary = "";
  for (var i = 0; i < combined.length; i++) {
    binary = binary + String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export async function decryptData(encryptedStr: string, password: string): Promise<string> {
  var key = await deriveKey(password);
  var combined = Uint8Array.from(atob(encryptedStr), function (c: string) { return c.charCodeAt(0); });
  var iv = combined.slice(0, IV_LENGTH);
  var data = combined.slice(IV_LENGTH);
  var decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}
