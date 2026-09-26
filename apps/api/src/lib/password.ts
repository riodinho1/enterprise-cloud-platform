import { hash, verify } from '@node-rs/argon2';

// OWASP's minimum argon2id configuration: 19 MiB memory, 2 iterations, 1 lane.
// Memory-hard hashing is what makes GPU cracking of a leaked table expensive.
// argon2id is the library default; the test suite asserts the `$argon2id$` prefix.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed hash is a failed check, never an exception a caller could forget to handle.
    return false;
  }
}

// When the email is unknown the login route still verifies against this hash, so
// "no such account" and "wrong password" take the same time and cannot be told apart.
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('not-a-real-password-only-for-constant-time');
  return dummyHash;
}
