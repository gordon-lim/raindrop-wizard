import * as crypto from 'node:crypto';
import * as http from 'node:http';
import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;
import opn from 'opn';
import { z } from 'zod';
import ui from './ui.js';
import {
  WRITE_KEY_ENDPOINT,
  ISSUES_URL,
  OAUTH_AUTHORIZE_URL,
  OAUTH_CLIENT_ID,
  OAUTH_PORT,
  OAUTH_REDIRECT_URI,
  OAUTH_TOKEN_URL,
  OAUTH_USERINFO_URL,
} from '../lib/constants.js';
import { abort } from './clack-utils.js';

const OAUTH_CALLBACK_STYLES = `
  <style>
    * {
      font-family: monospace;
      background-color: #E9E9E9;
      color: #1C3140;
      font-weight: medium;
      font-size: 24px;
      margin: .25rem;
    }

    .blink {
      animation: blink-animation 1s steps(2, start) infinite;
    }

    @keyframes blink-animation {
      to {
        opacity: 0;
      }
    }
  </style>
`;

const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  scoped_teams: z.array(z.number()).optional(),
  scoped_organizations: z.array(z.string()).optional(),
});

const OAuthUserInfoSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  picture_url: z.string().optional(),
  org_id_to_org_info: z
    .record(
      z.string(),
      z.object({
        org_id: z.string(),
        org_name: z.string(),
      }),
    )
    .optional(),
});

export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;
export type OAuthUserInfo = z.infer<typeof OAuthUserInfoSchema>;

interface OAuthConfig {
  scopes: string[];
  signup?: boolean;
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateRandomState(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function startCallbackServer(
  authUrl: string,
  signupUrl: string,
  expectedState: string,
): Promise<{
  server: http.Server;
  waitForCallback: () => Promise<string>;
}> {
  return new Promise((resolve, reject) => {
    let callbackResolve: (code: string) => void;
    let callbackReject: (error: Error) => void;

    const waitForCallback = () =>
      new Promise<string>((res, rej) => {
        callbackResolve = res;
        callbackReject = rej;
      });

    const server = http.createServer((req, res) => {
      // Disable keep-alive to ensure connections close after each response
      res.setHeader('Connection', 'close');
      if (!req.url) {
        res.writeHead(400);
        res.end();
        return;
      }
      const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);

      if (url.pathname === '/authorize') {
        const isSignup = url.searchParams.get('signup') === 'true';
        const redirectUrl = isSignup ? signupUrl : authUrl;
        res.writeHead(302, { Location: redirectUrl });
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        const isAccessDenied = error === 'access_denied';
        res.writeHead(isAccessDenied ? 200 : 400, {
          'Content-Type': 'text/html; charset=utf-8',
        });
        res.end(`
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Raindrop wizard - Authorization ${
                isAccessDenied ? 'cancelled' : 'failed'
              }</title>
              ${OAUTH_CALLBACK_STYLES}
            </head>
            <body>
              <p>${
                isAccessDenied
                  ? 'Authorization cancelled.'
                  : `Authorization failed.`
              }</p>
              <p>Return to your terminal.</p>
            </body>
          </html>
        `);
        callbackReject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head>
                <meta charset="UTF-8">
                <title>Raindrop wizard - Invalid state</title>
                ${OAUTH_CALLBACK_STYLES}
              </head>
              <body>
                <p>Invalid state parameter received. This could be a CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          callbackReject(new Error('Invalid state parameter'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Raindrop wizard is ready</title>
              ${OAUTH_CALLBACK_STYLES}
            </head>
            <body>
              <p>Raindrop login complete!</p>
              <p>Return to your terminal: the wizard is hard at work on your project<span class="blink">█</span></p>
            </body>
          </html>
        `);
        callbackResolve(code);
        return;
      }

      // Handle any other requests (like favicon.ico) so connections close properly
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    server.listen(OAUTH_PORT, () => {
      resolve({ server, waitForCallback });
    });

    server.on('error', reject);
  });
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams();
  params.append('client_id', OAUTH_CLIENT_ID);
  params.append('code', code);
  params.append('redirect_uri', OAUTH_REDIRECT_URI);
  params.append('grant_type', 'authorization_code');
  params.append('code_verifier', codeVerifier);

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Token exchange failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return OAuthTokenResponseSchema.parse(data);
}

export async function getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const response = await fetch(OAUTH_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get user info: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return OAuthUserInfoSchema.parse(data);
}

export interface WriteKeyResponse {
  writeKey: string;
  orgId: string;
}

export async function getOrgWriteKey(
  accessToken: string,
): Promise<WriteKeyResponse> {
  const response = await fetch(WRITE_KEY_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get org write key: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { api_key: string; org_id: string };
  return { writeKey: data.api_key, orgId: data.org_id };
}

export async function performOAuthFlow(
  config: OAuthConfig,
): Promise<OAuthTokenResponse> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateRandomState();

  const authUrl = new URL(OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('scope', config.scopes.join(' '));

  const signupUrl = new URL(
    `${OAUTH_AUTHORIZE_URL.replace(
      '/authorize',
      '/signup',
    )}?next=${encodeURIComponent(authUrl.toString())}`,
  );

  const localSignupUrl = `http://localhost:${OAUTH_PORT}/authorize?signup=true`;
  const localLoginUrl = `http://localhost:${OAUTH_PORT}/authorize`;

  const urlToOpen = config.signup ? localSignupUrl : localLoginUrl;

  const { server, waitForCallback } = await startCallbackServer(
    authUrl.toString(),
    signupUrl.toString(),
    state,
  );

  ui.addItem({
    type: 'response',
    text: `${chalk.bold(
      "If the browser window didn't open automatically, please open the following link to be redirected to Raindrop:",
    )}\n\n${chalk.cyan(urlToOpen)}${
      config.signup
        ? `\n\nIf you already have an account, you can use this link:\n\n${chalk.cyan(
            localLoginUrl,
          )}`
        : ``
    }`,
  });

  if (process.env.NODE_ENV !== 'test') {
    opn(urlToOpen, { wait: false }).catch(() => {
      // opn throws in environments without a browser
    });
  }

  const loginSpinner = ui.spinner();
  loginSpinner.start('Waiting for authorization...');

  try {
    const code = await Promise.race([
      waitForCallback(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Authorization timed out')), 60_000),
      ),
    ]);

    const token = await exchangeCodeForToken(code, codeVerifier);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    loginSpinner.stop('Authorization complete!');

    return token;
  } catch (e) {
    loginSpinner.stop('Authorization failed.');

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    const error = e instanceof Error ? e : new Error('Unknown error');

    if (error.message.includes('timeout')) {
      ui.addItem({
        type: 'error',
        text: 'Authorization timed out. Please try again.',
      });
    } else if (error.message.includes('access_denied')) {
      ui.addItem({
        type: 'response',
        text: `${chalk.yellow(
          'Authorization was cancelled.',
        )}\n\nYou denied access to Raindrop. To use the wizard, you need to authorize access to your Raindrop account.\n\n${chalk.dim(
          'You can try again by re-running the wizard.',
        )}`,
      });
    } else {
      ui.addItem({
        type: 'error',
        text: `${chalk.red('Authorization failed:')}\n\n${
          error.message
        }\n\n${chalk.dim(
          `If you think this is a bug in the Raindrop wizard, please create an issue:\n${ISSUES_URL}`,
        )}`,
      });
    }

    abort();
    throw error;
  }
}
