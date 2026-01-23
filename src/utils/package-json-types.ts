/**
 * Type definitions for package.json structure.
 * Eliminates the need for `any` types when working with package.json files.
 */

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  module?: string;
  types?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    npm?: string;
    [key: string]: string | undefined;
  };
  keywords?: string[];
  author?:
    | string
    | {
        name: string;
        email?: string;
        url?: string;
      };
  license?: string;
  repository?:
    | string
    | {
        type: string;
        url: string;
      };
  bugs?:
    | string
    | {
        url?: string;
        email?: string;
      };
  homepage?: string;
  private?: boolean;
  workspaces?:
    | string[]
    | {
        packages?: string[];
        nohoist?: string[];
      };
  // Allow additional properties
  [key: string]: unknown;
}
