import { NextResponse } from "next/server";
import nacl from "tweetnacl";

export const runtime = "nodejs";

function base64urlEncode(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

export async function POST(req: Request) {
  const body = await req.json();

  const payload = {
    handle: String(body.handle ?? ""),
    challenge: String(body.challenge ?? ""),
    issuedAt: String(body.issuedAt ?? ""),
    expiresAt: String(body.expiresAt ?? ""),
    nonce: String(body.nonce ?? ""),
    v: 1,
  };

  if (!payload.handle || !payload.challenge || !payload.issuedAt || !payload.expiresAt || !payload.nonce) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const skB64 = process.env.SIGNING_KEY_BASE64;
  if (!skB64) return NextResponse.json({ error: "server key missing" }, { status: 500 });

  const sk = new Uint8Array(Buffer.from(skB64, "base64"));
  if (sk.length !== 64) return NextResponse.json({ error: "bad key length (need 64 bytes)" }, { status: 500 });

  const msg = new TextEncoder().encode(stableStringify(payload));
  const sig = nacl.sign.detached(msg, sk); // 64 bytes signature

  const token = `${base64urlEncode(msg)}.${base64urlEncode(sig)}`;
  return NextResponse.json({ token });
}
