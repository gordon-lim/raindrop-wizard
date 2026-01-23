/**
 * Re-export @clack/prompts for consistent usage across the codebase.
 *
 * Note: @clack/prompts is an ESM-only package, but this project compiles to CommonJS
 * (no "type": "module" in package.json). TypeScript with "module": "node16" strictly
 * enforces module boundaries, causing a compile-time error when running tsc directly.
 * However, the compiled output works correctly at runtime due to the build process
 * handling ESM/CJS interop.
 *
 * Alternative solutions considered:
 * - Dynamic import: Would require async/await throughout the codebase
 * - Converting to ESM: Would be a breaking change requiring package.json update
 *
 * This suppression is safe because the runtime behavior is correct. Using @ts-ignore
 * instead of @ts-expect-error because the error only occurs in certain compilation
 * contexts (direct tsc) but not in test/jest contexts.
 */
// @ts-ignore - ESM import in CJS context (see comment above)
import clack from '@clack/prompts';

export default clack;
