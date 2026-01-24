/**
 * Cancellation utilities without ink dependency
 * Can be imported synchronously in CommonJS context
 */

/**
 * Symbol returned when user cancels an operation (Ctrl+C)
 * Compatible with clack's cancellation symbol
 */
export const CANCEL_SYMBOL = Symbol('ink:cancel');

/**
 * Type guard to check if a value is the cancellation symbol
 * Maintains API compatibility with clack.isCancel()
 */
export function isCancel(value: unknown): value is symbol {
  return value === CANCEL_SYMBOL;
}
