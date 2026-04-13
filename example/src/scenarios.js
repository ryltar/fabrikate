/**
 * Example scenario presets for the demo application.
 * Each team should define their own scenarios based on their API endpoints.
 */
export function createScenarios() {
  return {
    happyPath: {
      label: "Happy path demo",
      description: "Injects realistic /users and /profile data",
      execute(manager) {
        manager.clearStorage();
        const prefix = manager.getStoragePrefix();

        manager.setStorageValue(`${prefix}:collection:/users`, [
          { id: "u-1", name: "Ada", role: "admin", active: true },
          { id: "u-2", name: "Grace", role: "user", active: false },
          { id: "u-3", name: "Linus", role: "user", active: true },
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
      description: "Clears all storage and field mappings",
      execute(manager) {
        manager.clearStorage();
        manager.setPostGeneratedFieldsJson(undefined);
      },
    },
    fakerDemo: {
      label: "Faker mapping demo",
      description: "Injects sample field mapping rules for generated fields",
      execute(manager) {
        manager.setPostGeneratedFieldsJson({
          "/users": {
            age: { type: "number.int", min: 18, max: 65, asString: true },
            displayName: { type: "person.fullName" },
            createdAt: { type: "date.recent", days: 10 },
            category: { type: "pick", values: ["car", "peter", "house"] },
          },
        });
      },
    },
  };
}
