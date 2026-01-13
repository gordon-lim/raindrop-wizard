export enum Integration {
  python = 'python',
  typescript = 'typescript',
}

export function getIntegrationDescription(type: string): string {
  switch (type) {
    case Integration.python:
      return 'Python';
    case Integration.typescript:
      return 'TypeScript';
    default:
      throw new Error(`Unknown integration ${type}`);
  }
}

export const IS_DEV = ['test', 'development'].includes(
  process.env.NODE_ENV ?? '',
);

export const ISSUES_URL = 'https://github.com/raindrop/wizard/issues';
