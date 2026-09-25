import type { HealthResponse } from '@ecp/shared';
import { useEffect, useState } from 'react';

type HealthState = { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error' };

// Placeholder shell. The real screens (auth, dashboard, documents, admin) arrive in Phase 6.
// It calls /api/health so the proxy path is exercised from day one.
export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<HealthResponse>) : Promise.reject(r.status)))
      .then((data) => setHealth({ kind: 'ok', data }))
      .catch(() => setHealth({ kind: 'error' }));
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Document Platform</h1>
        <p className="mt-2 text-slate-600">Phase 2 scaffold. Screens arrive in Phase 6.</p>
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">API health</h2>
          {health.kind === 'loading' && <p className="mt-2">Checking…</p>}
          {health.kind === 'error' && (
            <p className="mt-2 text-red-700">API unreachable. Start it with `npm run dev:api`.</p>
          )}
          {health.kind === 'ok' && (
            <p className="mt-2 text-emerald-700">
              {health.data.status} · version {health.data.version} · up {health.data.uptimeSeconds}s
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
