import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext.js';

const profile = {
  id: 'u1',
  username: 'admin',
  email: 'admin@scienpay.test',
  fullName: 'Admin',
  title: 'ADMIN',
  role: 'ADMIN',
};

const post = vi.fn();
const get = vi.fn();

vi.mock('../lib/apiClient.js', () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
  getAccessToken: () => null,
  setAccessToken: vi.fn(),
  setRefreshHandler: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const Probe = () => {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">{isLoading ? 'loading' : user ? user.email : 'anonimo'}</span>
      <button onClick={() => void login({ identifier: 'admin', password: 'secret123' })}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    post.mockImplementation((path: string) => {
      if (path === '/auth/refresh') return Promise.resolve({ accessToken: 'refresh-token' });
      if (path === '/auth/login')
        return Promise.resolve({ accessToken: 'login-token', user: profile });
      return Promise.resolve({});
    });
    get.mockResolvedValue(profile);
  });

  it('restaura la sesión con refresh y perfil al montar', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('admin@scienpay.test'),
    );
    expect(post).toHaveBeenCalledWith('/auth/refresh');
    expect(get).toHaveBeenCalledWith('/auth/me');
  });

  it('login actualiza el usuario y logout limpia la sesión', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('state')).not.toHaveTextContent('loading'));

    await user.click(screen.getByText('login'));
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('admin@scienpay.test'),
    );
    expect(post).toHaveBeenCalledWith('/auth/login', {
      identifier: 'admin',
      password: 'secret123',
    });

    await user.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonimo'));
    expect(post).toHaveBeenCalledWith('/auth/logout');
  });
});
