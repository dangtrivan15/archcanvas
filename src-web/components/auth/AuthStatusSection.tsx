import { useAuthStore } from '@/store/authStore';
import { isKeycloakConfigured } from '@/core/auth/config';
import { Button } from '@/components/ui/Button';
import { createUrlLauncher } from '@/platform/urlLauncher';
import { REGISTRY_BASE_URL } from '@/core/registry/remoteRegistry';

/**
 * Renders authentication status and sign-in/out controls.
 * Returns null when Keycloak is not configured (env vars absent).
 * Exported so future surfaces (e.g., top menu) can reuse it.
 */
export function AuthStatusSection() {
  const { isAuthenticated, isSigningIn, username, error, startSignIn, signOut } = useAuthStore();

  if (!isKeycloakConfigured()) return null;

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-xs">
      {isAuthenticated && username ? (
        <>
          <span className="text-muted-foreground">
            Signed in as{' '}
            <span className="font-semibold text-foreground">@{username}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => { void createUrlLauncher().open(`${REGISTRY_BASE_URL}/publishers/${username}`); }}
            >
              View my profile
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              'Sign in to publish NodeDefs to the community registry'
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            disabled={isSigningIn}
            onClick={() => { void startSignIn(); }}
          >
            {isSigningIn ? 'Signing in…' : 'Sign in with GitHub'}
          </Button>
        </>
      )}
    </div>
  );
}
