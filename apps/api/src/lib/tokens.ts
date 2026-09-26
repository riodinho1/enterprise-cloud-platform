import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ROLES, type Role } from '@ecp/shared';

const ISSUER = 'ecp-api';
const AUDIENCE = 'ecp-web';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// Short-lived, stateless bearer token. HS256 with one server secret is enough for a
// single API; asymmetric keys only pay off when other services must verify tokens.
export class AccessTokens {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);
  }

  // Returns null for every failure (bad signature, expired, wrong issuer, malformed)
  // so callers cannot accidentally leak why a token was rejected.
  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !isRole(payload.role)) return null;
      return { sub: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }
}

// Refresh tokens are opaque random strings. The database stores only their hash,
// exactly like passwords, so a leaked table cannot be replayed.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newTokenFamilyId(): string {
  return randomUUID();
}
