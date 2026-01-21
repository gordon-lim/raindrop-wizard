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
export const OAUTH_CLIENT_ID = '140b68df6b9476693d817334f530ae0c';
export const OAUTH_CLIENT_SECRET = ''; // PKCE doesn't need this
export const OAUTH_AUTHORIZE_URL = `${OAUTH_URL}/propelauth/oauth/authorize`;
export const OAUTH_TOKEN_URL = `${OAUTH_URL}/propelauth/oauth/token`;
export const OAUTH_USERINFO_URL = `${OAUTH_URL}/propelauth/oauth/userinfo`;
export const OAUTH_PORT = 8259;
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;

export const API_BASE_URL = 'http://localhost:3000';
export const API_KEY_ENDPOINT = `${API_BASE_URL}/api/cli/users/key`;
