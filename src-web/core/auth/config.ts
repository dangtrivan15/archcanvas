/**
 * Keycloak configuration helpers.
 * Vite replaces import.meta.env.* at build time, making this effectively a
 * compile-time constant. Centralised here to avoid duplication across components.
 */

/** Returns true when all three VITE_KEYCLOAK_* env vars are present. */
export function isKeycloakConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_KEYCLOAK_URL &&
    import.meta.env.VITE_KEYCLOAK_REALM &&
    import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  );
}
