![Fabricate logo](./example/fabricate-logo.svg)

Typed `fetch` client for TypeScript projects with an optional stub mode backed by `localStorage`.

**📖 Documentation:**
- **Users**: See [`docs/usage.md`](./docs/usage.md) for examples and API reference
- **Contributors**: See [`docs/developer-guide.md`](./docs/developer-guide.md) for setup and contribution guidelines

## Why

This package is designed for projects that want one small API for:

- typed HTTP calls based on `fetch`,
- all common HTTP verbs,
- an easy `stub: true` switch for local development or front-only integration,
- automatic persistence in `localStorage` instead of calling the real API,
- a stub engine that understands REST collections like `/users` and `/users/123`.

## Installation

```bash
npm install fabricate
```

## Quick start

```ts
import { createFetchClient } from "fabricate";

type User = {
  id: number;
  name: string;
  role: "admin" | "user";
};

const client = createFetchClient({
  baseUrl: "https://api.example.com",
  stub: false,
});

const user = await client.get<User>("/users/12");
```
 
## Stub mode with localStorage

When `stub` is enabled, the client reads and writes JSON data in `localStorage` instead of calling the API.

By default, the stub engine uses:
- **collection mode** for REST-like routes such as `/users` and `/users/123`,
- **resource mode** for single-document routes such as `/profile`.

```ts
import { createFetchClient } from "fabricate";

type Product = {
  id: string;
  label: string;
  stock: number;
};

const client = createFetchClient({
  stub: true,
});

const product = await client.get<Product>("/products/sku-1");

await client.patch<Product, Partial<Product>>("/products/sku-1", {
  stock: 12,
});
```

Default stub keys use these formats:

```txt
fabricate:collection:/users
fabricate:resource:/profile
```

You can override the legacy resource key per request with `stubKey`, or force a behavior with `stubStrategy: "resource" | "collection"`.

## API

### `createFetchClient(config)`

Configuration:

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Optional base URL used to resolve request paths. |
| `headers` | `HeadersInit` | Default headers added to every request. |
| `stub` | `boolean` | Enables stub mode globally for the client. |
| `storage` | `StorageLike` | Optional storage override. Defaults to `localStorage` when available. |
| `storagePrefix` | `string` | Prefix used to build stub keys. Default: `fabricate`. |
| `fetchFn` | `typeof fetch` | Custom fetch implementation, useful in tests or SSR. |
| `stubStrategy` | `"auto" \| "resource" \| "collection"` | Default stub routing strategy. `auto` is the V2 default. |
| `stubIdFields` | `string[]` | Identifier fields used in collection mode. Default: `["id", "_id", "uuid"]`. |

### `client.request<TResponse, TBody>(options)`

Main low-level method. The shorthand helpers call this method internally.

Important request options:

| Option | Type | Description |
| --- | --- | --- |
| `path` | `string` | Relative path or full URL to call. |
| `method` | `string` | HTTP verb to use. |
| `body` | `TBody` | Body to send. Objects are serialized as JSON automatically. |
| `query` | `Record<string, ...>` | Query params appended to the URL. |
| `stub` | `boolean` | Overrides the client-level stub setting for a single request. |
| `stubKey` | `string` | Custom key used in storage for stub mode. |
| `stubStrategy` | `"auto" \| "resource" \| "collection"` | Overrides the stub routing strategy for one request. |
| `parseResponse` | `(response) => Promise<TResponse>` | Custom parser for non-JSON responses. |

### Helper methods

- `get`
- `post`
- `put`
- `patch`
- `delete`
- `head`
- `options`

For custom verbs, use `request({ method: "TRACE", ... })`.

## Stub behavior by verb

In `auto` mode, `/users` and `/users/:id` now share the same stored collection.

| Verb | Behavior in stub mode |
| --- | --- |
| `GET`, `HEAD`, `OPTIONS` | Reads a collection or an item from storage. |
| `POST` | Creates an item in a collection or stores a standalone resource. |
| `PUT` | Replaces a collection, an item, or a standalone resource. |
| `PATCH` | Updates an item in a collection or shallow-merges a standalone resource. |
| `DELETE` | Removes an item, a collection, or a standalone resource. |

## Collection filtering and sorting

Collection mode now supports **filtering** and **sorting** on `GET /collection` through `query`.

Supported query behavior:
- any non-reserved query key is treated as a **filter**
- `sort=-field` sorts descending
- `sort=field` sorts ascending
- `sortBy=field&sortOrder=desc` is also supported
- nested fields work with dot notation, for example `profile.city=Paris`

Example:

```ts
const users = await client.get<User[]>("/users", {
  query: {
    role: "admin",
    active: true,
    sort: "-profile.score",
  },
});
```

This filters the stored `/users` collection on `role` and `active`, then sorts by `profile.score` descending. The persisted collection is not rewritten: filtering and sorting are applied only to the returned result.

## Project structure

```txt
src/
  client/
  errors/
  http/
  storage/
  stub/
  utils/
```

The V2 architecture separates the fetch client, transport helpers, storage adapters, and the stub engine so the package is easier to evolve.

## Using a custom storage

This is useful in Node.js, tests, or if you want to replace `localStorage`.

```ts
import { createFetchClient, createMemoryStorage } from "fabricate";

const storage = createMemoryStorage();

const client = createFetchClient({
  stub: true,
  storage,
});
```

## Notes

- Successful JSON responses are parsed automatically.
- `204`, `205`, and `HEAD` responses return `undefined`.
- Failed responses throw an `HttpError` with `status`, `statusText`, `method`, `url`, and `responseBody`.
