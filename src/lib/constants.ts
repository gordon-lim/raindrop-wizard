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

export const OAUTH_URL = 'https://9260183011.propelauthtest.com'; // TEST URL
export const OAUTH_CLIENT_ID = '5dae0659f17a0522c551548d8a87e1f6';
export const OAUTH_CLIENT_SECRET = ''; // PKCE doesn't need this
export const OAUTH_AUTHORIZE_URL = `${OAUTH_URL}/propelauth/oauth/authorize`;
export const OAUTH_TOKEN_URL = `${OAUTH_URL}/propelauth/oauth/token`;
export const OAUTH_USERINFO_URL = `${OAUTH_URL}/propelauth/oauth/userinfo`;
export const OAUTH_PORT = 8259;
