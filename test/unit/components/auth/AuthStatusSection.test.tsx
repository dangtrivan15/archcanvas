import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthStatusSection } from '@/components/auth/AuthStatusSection';

// Mock isKeycloakConfigured to always return true
vi.mock('@/core/auth/config', () => ({
  isKeycloakConfigured: vi.fn(() => true),
}));

// Mock authStore
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock urlLauncher
const mockOpen = vi.fn().mockResolvedValue(undefined);
vi.mock('@/platform/urlLauncher', () => ({
  createUrlLauncher: vi.fn(() => ({ open: mockOpen })),
}));

// Mock remoteRegistry
vi.mock('@/core/registry/remoteRegistry', () => ({
  REGISTRY_BASE_URL: 'https://registry.archcanvas.dev',
}));

import { useAuthStore } from '@/store/authStore';
const mockUseAuthStore = vi.mocked(useAuthStore);

describe('AuthStatusSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText('View my profile')).toBeTruthy();
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
});
