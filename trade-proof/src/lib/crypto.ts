import nacl from "tweetnacl";

function base64ToU8(b64: string): Uint8Array {
  // Node
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  // Browser
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64urlDecodeToU8(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replaceAll("-", "+").replaceAll("_", "/");
  return base64ToU8(b64);
}

export function parseToken(token: string): { msg: Uint8Array; sig: Uint8Array } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    return { msg: base64urlDecodeToU8(parts[0]), sig: base64urlDecodeToU8(parts[1]) };
  } catch {
    return null;
  }
}

export async function verifyToken(token: string, publicKeyBase64: string) {
  const parsed = parseToken(token);
  if (!parsed) return { ok: false as const, error: "bad token format" };

  const pk = base64ToU8(publicKeyBase64);
  if (pk.length !== 32) return { ok: false as const, error: "bad public key length" };

  const ok = nacl.sign.detached.verify(parsed.msg, parsed.sig, pk);
  if (!ok) return { ok: false as const, error: "signature invalid" };

  const json = new TextDecoder().decode(parsed.msg);
  return { ok: true as const, payloadJson: json };
}
