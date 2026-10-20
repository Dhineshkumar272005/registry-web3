// Contact details are encrypted in the browser (ECDH P-256 + AES-GCM) to the trial's public key.
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const P = { name: "ECDH", namedCurve: "P-256" };
const derive = (priv, pub) =>
  crypto.subtle.deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

export async function makeKeys() {
  const k = await crypto.subtle.generateKey(P, true, ["deriveKey"]);
  return { pub: "0x" + hex(await crypto.subtle.exportKey("raw", k.publicKey)), priv: await crypto.subtle.exportKey("jwk", k.privateKey) };
}
export async function encrypt(pubHex, text) {
  const eph = await crypto.subtle.generateKey(P, true, ["deriveKey"]);
  const pub = await crypto.subtle.importKey("raw", unhex(pubHex.slice(2)), P, false, []);
  const key = await derive(eph.privateKey, pub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return "0x" + hex(await crypto.subtle.exportKey("raw", eph.publicKey)) + hex(iv) + hex(ct);
}
export async function decrypt(privJwk, data) {
  const b = unhex(data.slice(2));
  const pub = await crypto.subtle.importKey("raw", b.slice(0, 65), P, false, []);
  const priv = await crypto.subtle.importKey("jwk", privJwk, P, false, ["deriveKey"]);
  const key = await derive(priv, pub);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(65, 77) }, key, b.slice(77)));
}
