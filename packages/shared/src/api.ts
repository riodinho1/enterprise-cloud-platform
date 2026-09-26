import type { Role } from './auth.js';

// One error shape for every endpoint. Clients switch on `code`, humans read `message`.
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
}

// Each dependency reports separately so an operator can see which one is down.
export interface ReadyResponse {
  status: 'ok' | 'degraded';
  checks: Record<string, 'ok' | 'failed'>;
}

// The only user fields the API ever returns. Never the password hash.
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: PublicUser;
}
