/**
 * Type definitions for ink-based UI components
 * Maintains API compatibility with clack
 */

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface SelectOptions<T> {
  message: string;
  options: Array<SelectOption<T>>;
  initialValue?: T;
}

export interface ConfirmOptions {
  message: string;
  active?: string;
  inactive?: string;
  initialValue?: boolean;
}

export interface TextOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => string | void;
}

export interface SpinnerInstance {
  start: (msg?: string) => void;
  stop: (msg?: string) => void;
  message: (msg: string) => void;
}

export interface LogFunctions {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  success: (msg: string) => void;
  step: (msg: string) => void;
}
