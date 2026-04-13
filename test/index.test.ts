import { describe, expect, it, vi } from "vitest";

import {
  createFetchClient,
  createMemoryStorage,
  type StorageLike,
} from "../src/index";

describe("createFetchClient", () => {
  it("delegates to fetch and parses JSON responses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, label: "demo" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createFetchClient({
      baseUrl: "https://api.example.com",
      fetchFn,
      headers: { authorization: "Bearer token" },
    });

    const result = await client.post<{ id: number; label: string }, { label: string }>(
      "/items",
      { label: "demo" },
      { query: { locale: "fr" } },
    );

    expect(result).toEqual({ id: 1, label: "demo" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example.com/items?locale=fr",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ label: "demo" }),
      }),
    );

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("throws a typed error when the real API fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createFetchClient({ fetchFn });

    await expect(client.get("/broken")).rejects.toMatchObject({
      name: "HttpError",
      status: 500,
      responseBody: { message: "boom" },
    });
  });

  it("keeps single-resource routes in resource mode by default", async () => {
    const storage = createMemoryStorage();
    const client = createFetchClient({ stub: true, storage });

    const profile = await client.get<{ id: number; status: string }>("/profile", {
      stubData: () => ({ id: 42, status: "created" }),
    });

    expect(profile).toEqual({ id: 42, status: "created" });
    expect(storage.getItem("fabricate:resource:/profile")).toBe(
      JSON.stringify(profile),
    );
  });

  it("creates and retrieves items from a collection in auto mode", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
    });

    const created = await client.post<
      { id: string; name: string; role: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });
    const found = await client.get<{ id: string; name: string; role: string }>(
      `/users/${created.id}`,
    );
    const collection = await client.get<
      Array<{ id: string; name: string; role: string }>
    >("/users");

    expect(created.id).toBeTruthy();
    expect(found).toEqual(created);
    expect(collection).toEqual([created]);
  });

  it("exposes a stub manager in dev mode for storage administration", async () => {
    const storage = createMemoryStorage();
    const client = createFetchClient({
      stub: true,
      devMode: true,
      storage,
    });

    expect(client.stubManager).toBeDefined();

    client.stubManager?.setStorageValue("fabricate:resource:/profile", {
      id: "p-1",
      status: "ready",
    });

    const profile = await client.get<{ id: string; status: string }>("/profile");
    const keys = client.stubManager?.listStorageKeys();

    expect(profile).toEqual({ id: "p-1", status: "ready" });
    expect(keys).toContain("fabricate:resource:/profile");
  });

  it("lets stub manager update field mapping rules at runtime", async () => {
    const client = createFetchClient({
      stub: true,
      devMode: true,
      storage: createMemoryStorage(),
    });

    client.stubManager?.setPostGeneratedFieldsJson({
      "/users": {
        age: {
          type: "number.int",
          min: 18,
          max: 18,
          asString: true,
        },
      },
    });

    const created = await client.post<
      { id: string; name: string; role: string; age: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created.age).toBe("18");
  });

  it("adds backend-generated fields when creating a collection item in stub mode", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFields: {
        "/users": () => ({ age: "34" }),
      },
    });

    const created = await client.post<
      { id: string; name: string; role: string; age: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created).toMatchObject({
      name: "Ada",
      role: "admin",
      age: "34",
    });
  });

  it("supports stub post-generated fields provided by a config function", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFields: () => ({
        "/users": () => ({ tier: "gold" }),
      }),
    });

    const created = await client.post<
      { id: string; name: string; role: string; tier: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created).toMatchObject({
      name: "Ada",
      role: "admin",
      tier: "gold",
    });
  });

  it("supports JSON generated field rules with faker-backed range values", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFieldsJson: {
        "/users": {
          age: {
            type: "number.int",
            min: 18,
            max: 30,
            asString: true,
          },
        },
      },
    });

    const created = await client.post<
      { id: string; name: string; role: string; age: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created.name).toBe("Ada");
    expect(created.role).toBe("admin");
    expect(typeof created.age).toBe("string");

    const age = Number(created.age);
    expect(Number.isFinite(age)).toBe(true);
    expect(age).toBeGreaterThanOrEqual(18);
    expect(age).toBeLessThanOrEqual(30);
  });

  it("supports additional JSON faker rules including names, words, picks, and nested objects", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFieldsJson: {
        "/users": {
          displayName: {
            type: "person.fullName",
          },
          nickname: {
            type: "string.word",
          },
          category: {
            type: "pick",
            values: ["car", "peter", "house"],
          },
          createdAt: {
            type: "date.recent",
            days: 7,
          },
          profile: {
            firstName: {
              type: "person.firstName",
            },
            lastName: {
              type: "person.lastName",
            },
          },
        },
      },
    });

    const created = await client.post<
      {
        id: string;
        name: string;
        role: string;
        displayName: string;
        nickname: string;
        category: string;
        createdAt: string;
        profile: { firstName: string; lastName: string };
      },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created.name).toBe("Ada");
    expect(created.role).toBe("admin");
    expect(typeof created.displayName).toBe("string");
    expect(created.displayName.length).toBeGreaterThan(0);
    expect(typeof created.nickname).toBe("string");
    expect(created.nickname.length).toBeGreaterThan(0);
    expect(["car", "peter", "house"]).toContain(created.category);
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    expect(typeof created.profile.firstName).toBe("string");
    expect(created.profile.firstName.length).toBeGreaterThan(0);
    expect(typeof created.profile.lastName).toBe("string");
    expect(created.profile.lastName.length).toBeGreaterThan(0);
  });

  it("supports date.between rule for bounded timestamp generation", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFieldsJson: {
        "/users": {
          createdAt: {
            type: "date.between",
            from: "2024-01-01T00:00:00.000Z",
            to: "2024-12-31T23:59:59.999Z",
          },
        },
      },
    });

    const created = await client.post<
      { id: string; name: string; role: string; createdAt: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    const ts = new Date(created.createdAt).getTime();
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(new Date("2024-01-01T00:00:00.000Z").getTime());
    expect(ts).toBeLessThanOrEqual(new Date("2024-12-31T23:59:59.999Z").getTime());
  });

  it("lets inline generated fields override JSON rules for the same route", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubPostGeneratedFieldsJson: {
        "/users": {
          age: {
            type: "number.int",
            min: 18,
            max: 30,
            asString: true,
          },
        },
      },
      stubPostGeneratedFields: {
        "/users": { age: "99" },
      },
    });

    const created = await client.post<
      { id: string; name: string; role: string; age: string },
      { name: string; role: string }
    >("/users", {
      name: "Ada",
      role: "admin",
    });

    expect(created.age).toBe("99");
  });

  it("adds backend-generated fields when creating a resource in stub mode", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubStrategy: "resource",
      stubPostGeneratedFields: {
        "/profile": { status: "created" },
      },
    });

    const created = await client.post<
      { email: string; status: string },
      { email: string }
    >("/profile", {
      email: "ada@example.com",
    });

    expect(created).toEqual({
      email: "ada@example.com",
      status: "created",
    });
  });

  it("creates a missing item from stubData and exposes it through the collection root", async () => {
    const storage = createMemoryStorage();
    const client = createFetchClient({ stub: true, storage });

    const user = await client.get<{ id: string; name: string }>("/users/123", {
      stubData: { name: "Grace" } as { id: string; name: string },
    });
    const users = await client.get<Array<{ id: string; name: string }>>("/users");

    expect(user).toEqual({ id: "123", name: "Grace" });
    expect(users).toEqual([{ id: "123", name: "Grace" }]);
    expect(storage.getItem("fabricate:collection:/users")).toBe(
      JSON.stringify(users),
    );
  });

  it("updates and deletes collection items through item routes", async () => {
    const storage: StorageLike = createMemoryStorage({
      "fabricate:collection:/users": [
        { id: "123", name: "Ada", role: "user", active: false },
      ],
    });
    const client = createFetchClient({ stub: true, storage });

    const updated = await client.patch<
      { id: string; name: string; role: string; active: boolean },
      { active: boolean; role: string }
    >("/users/123", {
      active: true,
      role: "admin",
    });
    const removed = await client.delete<{
      id: string;
      name: string;
      role: string;
      active: boolean;
    }>("/users/123");
    const users = await client.get<
      Array<{ id: string; name: string; role: string; active: boolean }>
    >("/users", {
      stubData: [],
    });

    expect(updated).toEqual({
      id: "123",
      name: "Ada",
      role: "admin",
      active: true,
    });
    expect(removed).toEqual(updated);
    expect(users).toEqual([]);
  });

  it("supports custom id fields in collection mode", async () => {
    const client = createFetchClient({
      stub: true,
      storage: createMemoryStorage(),
      stubIdFields: ["userId"],
    });

    await client.post("/users", {
      userId: "u-1",
      label: "first",
    });

    const found = await client.get<{ userId: string; label: string }>("/users/u-1");

    expect(found).toEqual({
      userId: "u-1",
      label: "first",
    });
  });

  it("filters collection results from query params", async () => {
    const storage: StorageLike = createMemoryStorage({
      "fabricate:collection:/users": [
        { id: "1", name: "Ada", role: "admin", active: true },
        { id: "2", name: "Grace", role: "user", active: false },
        { id: "3", name: "Linus", role: "admin", active: true },
      ],
    });
    const client = createFetchClient({ stub: true, storage });

    const users = await client.get<
      Array<{ id: string; name: string; role: string; active: boolean }>
    >("/users", {
      query: {
        role: "admin",
        active: true,
      },
    });

    expect(users).toEqual([
      { id: "1", name: "Ada", role: "admin", active: true },
      { id: "3", name: "Linus", role: "admin", active: true },
    ]);
  });

  it("sorts collection results with sort and sortOrder query params", async () => {
    const storage: StorageLike = createMemoryStorage({
      "fabricate:collection:/users": [
        { id: "1", name: "Linus", age: 55 },
        { id: "2", name: "Ada", age: 31 },
        { id: "3", name: "Grace", age: 44 },
      ],
    });
    const client = createFetchClient({ stub: true, storage });

    const ascUsers = await client.get<
      Array<{ id: string; name: string; age: number }>
    >("/users", {
      query: {
        sortBy: "name",
        sortOrder: "asc",
      },
    });
    const descUsers = await client.get<
      Array<{ id: string; name: string; age: number }>
    >("/users", {
      query: {
        sort: "-age",
      },
    });

    expect(ascUsers.map((user) => user.name)).toEqual(["Ada", "Grace", "Linus"]);
    expect(descUsers.map((user) => user.age)).toEqual([55, 44, 31]);
  });

  it("supports filtering and sorting on nested fields", async () => {
    const storage: StorageLike = createMemoryStorage({
      "fabricate:collection:/users": [
        { id: "1", profile: { city: "Paris", score: 15 } },
        { id: "2", profile: { city: "Lyon", score: 25 } },
        { id: "3", profile: { city: "Paris", score: 20 } },
      ],
    });
    const client = createFetchClient({ stub: true, storage });

    const users = await client.get<
      Array<{ id: string; profile: { city: string; score: number } }>
    >("/users", {
      query: {
        "profile.city": "Paris",
        sort: "-profile.score",
      },
    });

    expect(users.map((user) => user.id)).toEqual(["3", "1"]);
  });

  it("still supports explicit resource strategy", async () => {
    const storage = createMemoryStorage();
    const client = createFetchClient({ stub: true, storage });

    await client.get("/users/123", {
      stubStrategy: "resource",
      stubData: { id: "123", label: "standalone" },
    });

    expect(storage.getItem("fabricate:resource:/users/123")).toBe(
      JSON.stringify({ id: "123", label: "standalone" }),
    );
    expect(storage.getItem("fabricate:collection:/users")).toBeNull();
  });
});
