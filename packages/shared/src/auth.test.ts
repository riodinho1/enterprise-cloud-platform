import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  it('accepts a valid registration and normalises the email', () => {
    const result = registerSchema.safeParse({
      email: '  Alice@Example.COM ',
      password: 'correct horse battery',
      displayName: 'Alice',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('alice@example.com');
  });

  it('rejects a short password', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'short',
      displayName: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'correct horse battery',
      displayName: 'Alice',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('does not enforce the minimum length on login, only on registration', () => {
    // Otherwise a future policy change would lock out users with older passwords.
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});
