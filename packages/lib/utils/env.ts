/// <reference types="@documenso/tsconfig/process-env.d.ts" />

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

/**
 * Duck-typed AppError. `AppError.parseError` reconstructs a proper AppError
 * from any error carrying a string `code`, so this preserves the exact
 * MISSING_ENV_VAR semantics without importing `errors/app-error` — keeping
 * this module a true leaf that Node's native TS loader (used when loading
 * vite.config.ts in the `typegen` step on Node >= 22.18) can resolve.
 */
const MISSING_ENV_VAR_CODE = 'MISSING_ENV_VAR';

class MissingEnvVarError extends Error {
  public readonly code = MISSING_ENV_VAR_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
type EnvKey = keyof NodeJS.ProcessEnv | (string & {});
type EnvValue<K extends EnvKey> = K extends keyof NodeJS.ProcessEnv ? NodeJS.ProcessEnv[K] : string | undefined;

export const env = <K extends EnvKey>(variable: K): EnvValue<K> => {
  if (typeof window !== 'undefined' && typeof window.__ENV__ === 'object') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return window.__ENV__[variable as string] as EnvValue<K>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (typeof process !== 'undefined' ? process?.env?.[variable] : undefined) as EnvValue<K>;
};

/**
 * Read an env var and assert it is set and non-empty. Throws `error` when
 * provided, otherwise an `AppError(MISSING_ENV_VAR)` naming the missing
 * variable.
 *
 * Empty-string is treated as unset — a shell-supplied `FOO=` is functionally
 * equivalent to omission.
 */
export const requireEnv = <K extends EnvKey>(variable: K, error?: Error): NonNullable<EnvValue<K>> => {
  const value = env(variable);

  if (!value) {
    throw error ?? new MissingEnvVarError(`Required environment variable "${String(variable)}" is unset.`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return value as NonNullable<EnvValue<K>>;
};

export const createPublicEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_'))),
  // Derived from the trigger.dev secret so the public flag cannot drift from
  // the real server-side configuration. Placed last so it wins over any literal
  // env var with the same name.
  // The `? 'true' : 'false'` might seem dumb but it's because we're expecting env var strings.
  NEXT_PUBLIC_DOCUMENT_CONVERSION_ENABLED: process.env.TRIGGER_SECRET_KEY ? 'true' : 'false',
  // Derived from the private transport so the client can detect CSC mode for
  // authoring UI gating without exposing the raw transport value.
  NEXT_PUBLIC_SIGNING_TRANSPORT_IS_CSC: process.env.NEXT_PRIVATE_SIGNING_TRANSPORT === 'csc' ? 'true' : 'false',
});
