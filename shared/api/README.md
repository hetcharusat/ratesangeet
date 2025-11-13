# Shared API SDK

Minimal TypeScript types and a fetch-based client for the Ratesangeet API (generated from the current OpenAPI spec).

## Files
- `types.ts` — Interfaces for Envelope, CacheMetadata, User, Review, Scrobble, ListeningStats and common responses.
- `client.ts` — Lightweight `ApiClient` wrapping `fetch` with typed helpers for common endpoints.

## Usage
```ts
import { ApiClient } from './client';

const api = new ApiClient({ baseUrl: 'http://localhost:5000' });

const health = await api.health();
if (health.success) {
  console.log('Server health:', health.data);
}

const login = await api.authLogin('mobile');
console.log('Auth URL:', login.data?.url);
```

## Notes
- The API currently uses a transitional response envelope. The client sets `X-API-Envelope: transitional-v1` by default.
- Some endpoints still return raw arrays (e.g., `/api/music/scrobbles`). Types reflect the spec as-is.
- If you need custom headers or auth, pass them via the constructor.

## Updating
When you change `server/openapi.yaml`, please update these types accordingly.
