import {
  createFetchClient,
  createMemoryStorage,
  mountStubStudioDrawer,
} from "fabricate";
import { createScenarios } from "./scenarios.js";

const output = document.querySelector("#output");
const seedBtn = document.querySelector("#seed");
const createBtn = document.querySelector("#create");
const listBtn = document.querySelector("#list");
const profileBtn = document.querySelector("#profile");
const clearBtn = document.querySelector("#clear");

const storage = createMemoryStorage();

const api = createFetchClient({
  stub: true,
  devMode: true,
  storage,
  stubPostGeneratedFieldsJson: {
    "/users": {
      age: { type: "number.int", min: 18, max: 65, asString: true },
      displayName: { type: "person.fullName" },
      createdAt: { type: "date.recent", days: 14 },
    },
  },
  stubScenarioPresets: createScenarios(),
});

mountStubStudioDrawer(api, {
  launcherLabel: "Stub Panel",
  position: "bottom-right",
  initiallyOpen: false,
  widthPx: 620,
  title: "Recipe Control Panel",
  documentationLinks: [
    { label: "PO/QA guide", url: "./po-qa-guide.html", target: "_blank" },
    { label: "Developer guide", url: "./developer-guide.html", target: "_blank" },
  ],
});

function print(title, value) {
  output.textContent = `${title}\n\n${JSON.stringify(value, null, 2)}`;
}

seedBtn?.addEventListener("click", async () => {
  const createdA = await api.post("/users", { name: "Ada", role: "admin" });
  const createdB = await api.post("/users", { name: "Grace", role: "user" });
  print("Seeded users", [createdA, createdB]);
});

createBtn?.addEventListener("click", async () => {
  const user = await api.post("/users", {
    name: `User-${Math.floor(Math.random() * 1000)}`,
    role: "user",
  });
  print("POST /users", user);
});

listBtn?.addEventListener("click", async () => {
  const users = await api.get("/users", {
    query: {
      sort: "-createdAt",
    },
  });
  print("GET /users", users);
});

profileBtn?.addEventListener("click", async () => {
  const profile = await api.get("/profile", {
    stubData: {
      id: "me",
      firstName: "Demo",
      lastName: "User",
      role: "admin",
    },
  });

  print("GET /profile", profile);
});

clearBtn?.addEventListener("click", () => {
  api.stubManager?.clearStorage();
  print("Storage", { status: "cleared" });
});

print("Ready", {
  hint: "Open 'Stub Panel' and try presets + mapping editor.",
});
