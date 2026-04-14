import { faker } from "@faker-js/faker";

import type {
  StubGeneratedFields,
  StubJsonFieldRule,
  StubJsonNestedObjectRule,
  StubJsonTypedRule,
  StubPostGeneratedFieldsConfig,
  StubPostGeneratedFieldsJsonConfig,
} from "../../types";

export function compilePostGeneratedFieldsJson(
  config?: StubPostGeneratedFieldsJsonConfig,
): StubPostGeneratedFieldsConfig {
  if (!config) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(config).map(([routePath, fields]) => [
      routePath,
      () => compileRouteFields(fields),
    ]),
  );
}

function compileRouteFields(
  fields: Record<string, StubJsonFieldRule>,
): StubGeneratedFields {
  return Object.fromEntries(
    Object.entries(fields).map(([field, rule]) => [
      field,
      resolveJsonRule(rule),
    ]),
  );
}

function resolveJsonRule(rule: StubJsonFieldRule): unknown {
  if (!isPlainObject(rule)) {
    return rule;
  }

  if (!isTypedJsonRule(rule)) {
    return compileRouteFields(rule as StubJsonNestedObjectRule);
  }

  switch (rule.type) {
    case "number.int": {
      const generated = faker.number.int({
        min: rule.min,
        max: rule.max,
      });

      return rule.asString ? generated.toString() : generated;
    }
    case "string.uuid":
      return faker.string.uuid();
    case "string.word":
      return faker.word.sample();
    case "person.firstName":
      return faker.person.firstName();
    case "person.lastName":
      return faker.person.lastName();
    case "person.fullName":
      return faker.person.fullName();
    case "pick": {
      if (!Array.isArray(rule.values) || rule.values.length === 0) {
        throw new Error(
          "JSON generated field rule 'pick' requires a non-empty values array.",
        );
      }

      return faker.helpers.arrayElement(rule.values);
    }
    case "date.recent": {
      const value = faker.date.recent({ days: rule.days });
      return rule.asISOString === false ? value : value.toISOString();
    }
    case "date.between": {
      const value = faker.date.between({
        from: new Date(rule.from),
        to: new Date(rule.to),
      });

      return rule.asISOString === false ? value : value.toISOString();
    }
    default:
      return rule;
  }
}

function isPlainObject(rule: unknown): rule is Record<string, unknown> {
  return Object.prototype.toString.call(rule) === "[object Object]";
}

function isTypedJsonRule(rule: unknown): rule is StubJsonTypedRule {
  return isPlainObject(rule) && typeof rule.type === "string";
}
