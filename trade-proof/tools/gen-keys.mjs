// tools/gen-keys.mjs
import nacl from "tweetnacl";

const kp = nacl.sign.keyPair(); // Ed25519

const b64 = (u8) => Buffer.from(u8).toString("base64");

console.log("SIGNING_KEY_BASE64=", b64(kp.secretKey)); // 64 bytes
console.log("PUBLIC_KEY_BASE64=", b64(kp.publicKey));  // 32 bytes
