import type { StubGeneratedFieldsJsonCompilerPort } from "../ports";
import type {
  StubPostGeneratedFieldsConfig,
  StubPostGeneratedFieldsJsonConfig,
} from "../types";

export function resolvePostGeneratedFields({
  inlineConfig,
  jsonConfig,
  jsonCompiler,
}: {
  inlineConfig?: StubPostGeneratedFieldsConfig;
  jsonConfig?: StubPostGeneratedFieldsJsonConfig;
  jsonCompiler: StubGeneratedFieldsJsonCompilerPort;
}): StubPostGeneratedFieldsConfig | undefined {
  const compiledJsonConfig = jsonCompiler.compile(jsonConfig);

  if (!inlineConfig && Object.keys(compiledJsonConfig).length === 0) {
    return undefined;
  }

  return {
    ...compiledJsonConfig,
    ...(inlineConfig ?? {}),
  };
}
