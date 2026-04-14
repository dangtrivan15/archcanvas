import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { IUserRepository, IApiTokenRepository, UserRecord } from '../repositories/types';
import type { Config } from '../config';

interface TokenPayload {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: number;
  username: string;
}

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private apiTokenRepo: IApiTokenRepository,
    private config: Config,
    private fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async exchangeGitHubCode(
    code: string,
  ): Promise<{ token: string; user: UserRecord }> {
    // Exchange code for access token
    const tokenRes = await this.fetchFn(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.githubClientId,
          client_secret: this.config.githubClientSecret,
          code,
        }),
      },
    );

    if (!tokenRes.ok) {
      throw new Error(
        `GitHub OAuth token exchange failed with status ${tokenRes.status}`,
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      throw new Error(
        `GitHub OAuth error: ${tokenData.error || 'no access token'}`,
      );
    }

    // Fetch user profile
    const userRes = await this.fetchFn('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    if (!userRes.ok) {
      throw new Error(
        `GitHub user API failed with status ${userRes.status}`,
      );
    }

    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string | null;
    };

    // Upsert user
    const user = this.userRepo.upsertFromGitHub(
      ghUser.id,
      ghUser.login,
      ghUser.name,
      ghUser.avatar_url,
    );

    // Create JWT
    const token = this.createJWT(user.id, user.username);

    return { token, user };
  }

  createJWT(userId: number, username: string): string {
    return jwt.sign(
      { sub: userId, username } as TokenPayload,
      this.config.jwtSecret,
      { expiresIn: '24h' },
    );
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    // Try JWT first (fast path)
    try {
      const payload = jwt.verify(
        token,
        this.config.jwtSecret,
      ) as unknown as TokenPayload;
      return { userId: payload.sub, username: payload.username };
    } catch {
      // JWT invalid — try API token
    }

    // Check if it matches an API token by prefix lookup
    const prefix = token.slice(0, 8);
    return this.verifyApiToken(token, prefix);
  }

  private async verifyApiToken(
    token: string,
    prefix: string,
  ): Promise<AuthUser | null> {
    // Use prefix for efficient lookup instead of O(n) bcrypt comparison
    const tokenRows = this.apiTokenRepo.findByPrefix(prefix);

    for (const row of tokenRows) {
      if (await bcrypt.compare(token, row.tokenHash)) {
        // Update last_used
        this.apiTokenRepo.updateLastUsed(row.id);

        const user = this.userRepo.findById(row.userId);
        if (user) {
          return { userId: user.id, username: user.username };
        }
      }
    }

    return null;
  }

  async createAPIToken(
    userId: number,
    name: string,
  ): Promise<{ token: string; name: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const prefix = rawToken.slice(0, 8);
    const hash = await bcrypt.hash(rawToken, 10);

    this.apiTokenRepo.create(userId, name, hash, prefix);

    return { token: rawToken, name };
  }

  async revokeAPIToken(tokenId: number, userId: number): Promise<boolean> {
    return this.apiTokenRepo.deleteByIdAndUser(tokenId, userId);
  }
}
