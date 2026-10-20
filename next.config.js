const dev = process.env.NODE_ENV !== "production";
const rpc = (() => { try { return new URL(process.env.NEXT_PUBLIC_RPC).origin; } catch { return ""; } })();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src 'self' ${rpc || "https://rpc-amoy.polygon.technology"}${dev ? " ws: http://127.0.0.1:8545" : ""}`,
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
].join("; ");
module.exports = {
  reactStrictMode: true, poweredByHeader: false, output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
