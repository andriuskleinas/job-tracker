/**
 * Minimal shape of the `bun:test` exports this project actually uses.
 *
 * Deliberately not the real `@types/bun` (or `bun-types`) package: installing
 * it pollutes the global `fetch` type for the whole program, breaking
 * @tanstack/react-start's own fetch typing — a known conflict with
 * `bun-types` (a dependency of `unplugin`, pulled in transitively). See
 * node_modules/@tanstack/start-client-core/src/createServerFn.ts and
 * https://github.com/oven-sh/bun/issues/23500.
 */
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toBeNull(): void;
  };
}
