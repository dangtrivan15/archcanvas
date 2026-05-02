import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthStatusSection } from '@/components/auth/AuthStatusSection';
import { useAuthStore } from '@/store/authStore';
import { isKeycloakConfigured } from '@/core/auth/config';

// vi.mock calls (hoisted by vitest)
vi.mock('@/core/auth/config', () => ({
  isKeycloakConfigured: vi.fn(() => true),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));
const mockOpen = vi.fn().mockResolvedValue(undefined);
vi.mock('@/platform/urlLauncher', () => ({
  createUrlLauncher: vi.fn(() => ({ open: mockOpen })),
}));
vi.mock('@/core/registry/remoteRegistry', () => ({
  REGISTRY_BASE_URL: 'https://registry.archcanvas.dev',
}));

const mockUseAuthStore = vi.mocked(useAuthStore);

describe('AuthStatusSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isKeycloakConfigured).mockReturnValue(true);
  });

  it('renders nothing when Keycloak is not configured', () => {
    vi.mocked(isKeycloakConfigured).mockReturnValueOnce(false);
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isSigningIn: false,
      username: null,
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: null,
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);
    const { container } = render(<AuthStatusSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render "View my profile" when signed out', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isSigningIn: false,
      username: null,
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: null,
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);

    render(<AuthStatusSection />);
    expect(screen.queryByText('View my profile')).toBeNull();
  });

  it('renders "View my profile" link when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isSigningIn: false,
      username: 'alice',
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: 'token-123',
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);

    render(<AuthStatusSection />);
    expect(screen.getByText('View my profile')).toBeInTheDocument();
  });

  it('calls urlLauncher.open with correct URL when "View my profile" is clicked', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isSigningIn: false,
      username: 'alice',
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: 'token-123',
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);

    render(<AuthStatusSection />);
    fireEvent.click(screen.getByText('View my profile'));
    expect(mockOpen).toHaveBeenCalledWith('https://registry.archcanvas.dev/publishers/alice');
  });

  it('URL-encodes username in profile URL', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isSigningIn: false,
      username: 'alice+special',
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: 'token-123',
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);

    render(<AuthStatusSection />);
    fireEvent.click(screen.getByText('View my profile'));
    expect(mockOpen).toHaveBeenCalledWith(
      'https://registry.archcanvas.dev/publishers/alice%2Bspecial',
    );
  });

  it('does not render "View my profile" when username is "unknown"', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isSigningIn: false,
      username: 'unknown',
      error: null,
      startSignIn: vi.fn(),
      signOut: vi.fn(),
      token: 'token-123',
      clearToken: vi.fn(),
      _hydrate: vi.fn(),
    } as any);

    render(<AuthStatusSection />);
    expect(screen.queryByText('View my profile')).not.toBeInTheDocument();
  });
});
