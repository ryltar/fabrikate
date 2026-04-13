# fabricate usage guide

This document shows how to call the library in a real project and provides a compact API reference.

## 1. Install

```bash
npm install fabricate
```

## 2. Create a typed client

```ts
import { createFetchClient } from "fabricate";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "user";
};

const api = createFetchClient({
  baseUrl: "https://api.example.com",
  headers: {
    Authorization: "Bearer <token>",
  },
});
```

## 3. Call the API

### Read a resource

```ts
const user = await api.get<User>("/users/12");
```

### Create a resource

```ts
type CreateUserBody = {
  firstName: string;
  lastName: string;
  email: string;
};

const createdUser = await api.post<User, CreateUserBody>("/users", {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
});
```

### Update a resource

```ts
type UpdateUserBody = Partial<Pick<User, "firstName" | "lastName" | "role">>;

const updatedUser = await api.patch<User, UpdateUserBody>("/users/12", {
  role: "admin",
});
```

### Delete a resource

```ts
await api.delete<void>("/users/12");
```

### Use query parameters

```ts
const users = await api.get<User[]>("/users", {
  query: {
    page: 1,
    limit: 20,
    role: "admin",
  },
});
```

### Use a custom verb

```ts
const traceResult = await api.request<string>({
  path: "/users/12",
  method: "TRACE",
  parseResponse: (response) => response.text(),
});
```

## 4. Use stub mode

When `stub: true` is enabled, the client no longer calls the real API. It reads from `localStorage` or from an injected storage implementation.

The stub engine works in two modes:

- **collection mode**: REST routes like `/users` and `/users/123` share one collection in storage,
- **resource mode**: document routes like `/profile` keep one key per resource.

```ts
import { createFetchClient } from "fabricate";

type Product = {
  id: string;
  label: string;
  price: number;
  stock: number;
};

const stubApi = createFetchClient({
  stub: true,
});

const product = await stubApi.get<Product>("/products/sku-43");

const savedProduct = await stubApi.patch<Product, Partial<Product>>(
  "/products/sku-43",
  {
    stock: 6,
  },
);

await stubApi.delete("/products/sku-43");
```

### Collection-aware behavior

This is the default behavior for REST resources.

```ts
import { createFetchClient } from "fabricate";

type User = {
  id: string;
  name: string;
  role: "admin" | "user";
  age: string;
};

import { faker } from "@faker-js/faker";

const api = createFetchClient({
  stub: true,
  stubPostGeneratedFields: {
    "/users": () => ({
      age: faker.number.int({ min: 18, max: 70 }).toString(),
    }),
  },
});

const createdUser = await api.post<User, Omit<User, "id" | "age">>("/users", {
  name: "Ada",
  role: "admin",
});

const sameUser = await api.get<User>(`/users/${createdUser.id}`);
const allUsers = await api.get<User[]>("/users");

await api.patch<User, Partial<User>>(`/users/${createdUser.id}`, {
  role: "user",
});

await api.delete(`/users/${createdUser.id}`);
```

With this config, each `POST /users` call can add backend-managed fields (for example `age`) even if they are not present in the request body.

You can also provide the same rules from a separate config module:

```ts
// stub-generated-fields.ts
import { faker } from "@faker-js/faker";
import type { StubPostGeneratedFieldsConfig } from "fabricate";

export const stubGeneratedFields: StubPostGeneratedFieldsConfig = {
  "/users": () => ({
    age: faker.number.int({ min: 18, max: 70 }).toString(),
  }),
};
```

```ts
import { createFetchClient } from "fabricate";
import { stubGeneratedFields } from "./stub-generated-fields";

const api = createFetchClient({
  stub: true,
  stubPostGeneratedFields: stubGeneratedFields,
});
```

Or use a JSON file with declarative faker-backed rules:

```json
{
  "/users": {
    "age": {
      "type": "number.int",
      "min": 18,
      "max": 30,
      "asString": true
    }
  }
}
```

```ts
import { createFetchClient } from "fabricate";
import generatedRules from "./stub-generated-fields.json";

const api = createFetchClient({
  stub: true,
  stubPostGeneratedFieldsJson: generatedRules,
});
```

Supported JSON rule types and examples:

| Rule type | Description | Example |
| --- | --- | --- |
| `number.int` | Generates an integer with optional `min`/`max`, and optional `asString`. | `{ "type": "number.int", "min": 18, "max": 30, "asString": true }` |
| `string.uuid` | Generates a random UUID string. | `{ "type": "string.uuid" }` |
| `string.word` | Generates a random word string. | `{ "type": "string.word" }` |
| `person.firstName` | Generates a realistic first name. | `{ "type": "person.firstName" }` |
| `person.lastName` | Generates a realistic last name. | `{ "type": "person.lastName" }` |
| `person.fullName` | Generates a realistic full name. | `{ "type": "person.fullName" }` |
| `pick` | Picks one value from a static list. | `{ "type": "pick", "values": ["car", "peter", "house"] }` |
| `date.recent` | Generates a recent date, optionally bounded by `days`. Returns ISO string by default. | `{ "type": "date.recent", "days": 7 }` |
| `date.between` | Generates a date between two ISO boundaries. Returns ISO string by default. | `{ "type": "date.between", "from": "2024-01-01T00:00:00.000Z", "to": "2024-12-31T23:59:59.999Z" }` |

Nested objects are supported by simply nesting fields in JSON:

```json
{
  "/users": {
    "profile": {
      "firstName": { "type": "person.firstName" },
      "lastName": { "type": "person.lastName" }
    },
    "label": { "type": "string.word" },
    "category": { "type": "pick", "values": ["car", "peter", "house"] },
    "createdAt": { "type": "date.recent", "days": 7 }
  }
}
```

Stored key:

```txt
fabricate:collection:/users
```

### Filtering and sorting a collection

In collection mode, `GET /users` can filter and sort the stored array using `query`.

```ts
const admins = await api.get<User[]>("/users", {
  query: {
    role: "admin",
    active: true,
    sort: "-name",
  },
});
```

Supported rules:

| Query form | Meaning |
| --- | --- |
| `role=admin` | exact match filtering |
| `active=true` | boolean filtering |
| `age=42` | numeric filtering |
| `profile.city=Paris` | nested field filtering with dot notation |
| `sort=name` | ascending sort |
| `sort=-name` | descending sort |
| `sortBy=name&sortOrder=desc` | alternate sort syntax |

Notes:
- every non-reserved query key is treated as a filter
- filtering and sorting apply to the returned data only
- the stored collection in `localStorage` is left unchanged
- item routes like `/users/123` are not filtered; they still target one entity directly

### Force resource mode

Useful when a route looks REST-like but you want to persist it as one standalone entry.

```ts
await api.get("/users/123", {
  stub: true,
  stubStrategy: "resource",
  stubData: {
    id: "123",
    label: "standalone snapshot",
  },
});
```

Stored key:

```txt
fabricate:resource:/users/123
```

## 5. Use a custom storage

Useful in Node.js, SSR, tests, or if you do not want to depend directly on browser `localStorage`.

```ts
import { createFetchClient, createMemoryStorage } from "fabricate";

const storage = createMemoryStorage();

const api = createFetchClient({
  stub: true,
  storage,
  storagePrefix: "demo-app",
});
```

## 6. Mount the Stub Studio UI (dev mode)

You can mount an animated admin panel to let developers, QA, or PO users manage stub data without writing code.

```ts
import { createFetchClient, mountStubStudio } from "fabricate";

const api = createFetchClient({
  stub: true,
  devMode: true,
});

const container = document.getElementById("stub-studio");

if (container) {
  const studio = mountStubStudio(container, api, {
    title: "Recipe Control Panel",
  });

  // Optional manual refresh
  studio.refresh();
}
```

What users can do from this panel:

- browse and edit prefixed `localStorage` entries
- clear or import/export stub snapshots
- edit JSON faker mappings at runtime for generated POST fields

You can also mount it as a floating drawer (no dedicated container required):

```ts
import { createFetchClient, mountStubStudioDrawer } from "fabricate";

const api = createFetchClient({
  stub: true,
  devMode: true,
});

mountStubStudioDrawer(api, {
  position: "bottom-right",
  launcherLabel: "Stub Panel",
  initiallyOpen: false,
  widthPx: 500,
});
```

The drawer includes scenario presets for non-technical testing. By default, no scenarios are preconfigured, but teams can define custom scenarios for their API:

### Defining Scenario Presets

Create a file with your team's test scenarios (e.g., `scenarios.js`):

```ts
export function createScenarios() {
  return {
    happyPath: {
      label: "Happy path demo",
      description: "Loads realistic test data",
      execute(manager) {
        manager.clearStorage();
        const prefix = manager.getStoragePrefix();
        manager.setStorageValue(`${prefix}:collection:/users`, [
          { id: "u-1", name: "Ada", role: "admin", active: true },
          { id: "u-2", name: "Grace", role: "user", active: false },
        ]);
        manager.setStorageValue(`${prefix}:resource:/profile`, {
          id: "me",
          firstName: "Demo",
          lastName: "User",
          role: "admin",
        });
      },
    },
    emptyState: {
      label: "Empty state",
      description: "Clears all data",
      execute(manager) {
        manager.clearStorage();
        manager.setPostGeneratedFieldsJson(undefined);
      },
    },
  };
}
```

Then pass your scenarios to the client:

```ts
import { createFetchClient, mountStubStudioDrawer } from "fabricate";
import { createScenarios } from "./scenarios.js";

const api = createFetchClient({
  stub: true,
  devMode: true,
  stubScenarioPresets: createScenarios(),
});

mountStubStudioDrawer(api, {
  launcherLabel: "Stub Panel",
});
```

Each preset is a `StubScenario` with:
- `label`: button text shown in the UI
- `description`: optional tooltip text
- `execute(manager)`: function that configures the stub data when clicked

See [example/src/scenarios.js](../../example/src/scenarios.js) for a complete example.

### Quick way to test the UI locally

1. Build the package:

```bash
npm run build
```

2. In your app (browser or Angular), create a client in dev mode and mount the drawer:

```ts
import { createFetchClient, mountStubStudioDrawer } from "fabricate";

const api = createFetchClient({
  stub: true,
  devMode: true,
});

mountStubStudioDrawer(api, {
  launcherLabel: "Stub Panel",
});
```

3. Run your app and click `Stub Panel` in the bottom corner.

## Operations

### `createFetchClient(config)`

Creates one reusable client instance.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | No | Base URL used to resolve relative paths. |
| `headers` | `HeadersInit` | No | Default headers applied to every request. |
| `stub` | `boolean` | No | Enables stub mode globally. |
| `storage` | `StorageLike` | No | Storage backend for stub mode. |
| `storagePrefix` | `string` | No | Prefix used to build storage keys. |
| `fetchFn` | `typeof fetch` | No | Custom fetch implementation. |
| `stubStrategy` | `"auto" \| "resource" \| "collection"` | No | Default stub routing strategy. |
| `stubIdFields` | `string[]` | No | Custom identifier fields for collection items. |
| `stubPostGeneratedFields` | `Record<string, object \| (context) => object> \| () => Record<string, object \| (context) => object>` | No | Backend-generated fields for stub `POST` results, provided inline or via config function. |
| `stubPostGeneratedFieldsJson` | `Record<string, Record<string, rule>> \| () => Record<string, Record<string, rule>>` | No | JSON-friendly generated-field rules compiled to faker-backed values for stub `POST`. |

### `client.request<TResponse, TBody>(options)`

Low-level operation for any HTTP method.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | Yes | Relative path or absolute URL. |
| `method` | `string` | No | HTTP verb. Defaults to `GET`. |
| `headers` | `HeadersInit` | No | Request-specific headers. |
| `query` | `QueryParams` | No | Query params appended to the URL. |
| `body` | `TBody` | No | Request payload. Plain objects are JSON-stringified. |
| `stub` | `boolean` | No | Overrides client-level stub mode. |
| `stubKey` | `string` | No | Custom persistence key for stub mode. |
| `stubStrategy` | `"auto" \| "resource" \| "collection"` | No | Overrides stub routing for one request. |
| `stubData` | `TResponse \| (context) => TResponse` | No | Initial or replacement data in stub mode. |
| `parseResponse` | `(response) => Promise<TResponse>` | No | Custom response parser. |

## Stub behavior reference

### Storage strategies

| Strategy | Typical route | Storage key | Behavior |
| --- | --- | --- | --- |
| `collection` | `/users`, `/users/123` | `fabricate:collection:/users` | Collection root and item routes operate on the same array |
| `resource` | `/profile` | `fabricate:resource:/profile` | One route maps to one stored document |
| `auto` | default | resolved automatically | Uses collection for REST-like routes, resource otherwise |

### HTTP behavior

| Method | Stub behavior | Stored result |
| --- | --- | --- |
| `GET` | Reads a collection, one item, or one resource. Creates from `stubData` if missing. | JSON array or document |
| `HEAD` | Same lookup behavior as `GET` in stub mode. | JSON array or document |
| `OPTIONS` | Same lookup behavior as `GET` in stub mode. | JSON array or document |
| `POST` | Creates an item in a collection. In resource mode, stores one document. | New item or document |
| `PUT` | Replaces a collection, an item, or a resource. | Replaced value |
| `PATCH` | Updates one collection item or shallow-merges a resource document. | Updated value |
| `DELETE` | Removes one item, one collection, or one resource. | Deleted value |

### Collection query behavior

| Query key | Effect |
| --- | --- |
| any non-reserved key | filtering |
| `sort` | sorting, ascending with `field`, descending with `-field` |
| `sortBy` + `sortOrder` | alternate sorting syntax |
| dot notation | nested filtering/sorting, e.g. `profile.score` |

### Identifier resolution

In collection mode, items are matched using these fields by default:

```ts
["id", "_id", "uuid"];
```

You can override that at client level:

```ts
const api = createFetchClient({
  stub: true,
  stubIdFields: ["userId"],
});
```

## Response behavior

| Case | Behavior |
| --- | --- |
| JSON response | Parsed automatically with `response.json()` |
| `204` / `205` | Returns `undefined` |
| `HEAD` | Returns `undefined` for real HTTP responses |
| Non-JSON response | Returned as text by default |
| Failed HTTP response | Throws `HttpError` |

## Error shape

```ts
type HttpError = {
  name: "HttpError";
  status: number;
  statusText: string;
  method: string;
  url: string;
  responseBody: unknown;
  message: string;
};
```

## Full example

```ts
import { createFetchClient } from "fabricate";

type Todo = {
  id: string;
  label: string;
  done: boolean;
};

type CreateTodoBody = {
  label: string;
};

const api = createFetchClient({
  baseUrl: "https://api.example.com",
  stub: import.meta.env.DEV,
});

const todo = await api.post<Todo, CreateTodoBody>("/todos", {
  label: "Write documentation",
});

const refreshedTodo = await api.get<Todo>(`/todos/${todo.id}`, {
  stubData: {
    ...todo,
    done: false,
  },
});

await api.patch<Todo, Partial<Todo>>(`/todos/${todo.id}`, {
  done: true,
});
```
