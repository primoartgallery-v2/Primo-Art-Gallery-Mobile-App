// Known insecure / default fallback secrets that MUST NEVER be used in production
const KNOWN_INSECURE_SECRETS = new Set([
  "primo_jwt_secret_key_2026",
  "primo_curatorial_bridge_secret_2026",
  "primo_curatorial_bridge_secret_2026_change_in_production",
  "primo_curatorial_authority_signing_secret_2026",
  "primo_gallery_curatorial_coa_hmac_secret_2026",
  "default",
  "secret",
  "password",
  "change_me",
  "changeme",
  "123456",
]);

/**
 * Enforces production security invariants for cryptographic secrets.
 * In production (NODE_ENV=production), fails startup if any required secret
 * is missing, empty, matches a known insecure default, or is too short (< 16 chars).
 * Secret values are NEVER printed in logs.
 */
function validateProductionSecrets(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  if (!isProduction) return { valid: true, errors: [] };

  const requiredSecrets = [
    {
      name: "JWT_SECRET",
      value: env.JWT_SECRET,
    },
    {
      name: "PRIMO_BRIDGE_SECRET",
      value: env.PRIMO_BRIDGE_SECRET || env.BRIDGE_SECRET,
    },
    {
      name: "COA_SIGNING_SECRET",
      value: env.COA_SIGNING_SECRET,
    },
  ];

  const errors = [];
  for (const item of requiredSecrets) {
    if (!item.value || typeof item.value !== "string" || item.value.trim().length === 0) {
      errors.push(`Required production secret ${item.name} is missing or empty.`);
    } else {
      const trimmed = item.value.trim();
      if (
        KNOWN_INSECURE_SECRETS.has(trimmed.toLowerCase()) ||
        KNOWN_INSECURE_SECRETS.has(trimmed) ||
        trimmed.length < 16
      ) {
        errors.push(
          `Production secret ${item.name} is set to an insecure/default fallback value or is too short (< 16 characters).`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("[FATAL] Production security invariant validation failed:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.error("[FATAL] Server startup aborted to prevent insecure deployment. (Secret values are never logged).");
    throw new Error(`Production secret validation failed: ${errors.join("; ")}`);
  }

  return { valid: true, errors: [] };
}

module.exports = {
  KNOWN_INSECURE_SECRETS,
  validateProductionSecrets,
};
