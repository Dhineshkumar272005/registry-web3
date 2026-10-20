// Deployment settings. NEXT_PUBLIC_* values are fixed at build time, so each environment builds its own image.
export const CFG = {
  env: process.env.NEXT_PUBLIC_ENV || "staging",
  org: process.env.NEXT_PUBLIC_ORG_NAME || "the operating organisation",
  contact: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "the operator's contact address",
  legalReviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true",
  legalUpdated: process.env.NEXT_PUBLIC_LEGAL_UPDATED || "",
  auditUrl: process.env.NEXT_PUBLIC_AUDIT_URL || "",
  chainShort: process.env.NEXT_PUBLIC_CHAIN_SHORT || "Amoy",
};
export const isProd = CFG.env === "production";
