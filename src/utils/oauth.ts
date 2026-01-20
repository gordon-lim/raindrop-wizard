import * as http from 'node:http';
import axios from 'axios';
import chalk from 'chalk';
import opn from 'opn';
import clack from './clack';
import { ISSUES_URL } from '../lib/constants';
import { abort } from './clack-utils';

const PROPELAUTH_AUTH_URL = 'https://9260183011.propelauthtest.com'; // TEST URL
const OAUTH_PORT = 8259;

const OAUTH_CALLBACK_STYLES = `
  <style>
    * {
      font-family: monospace;
      background-color: #1b0a00;
      color: #F7A502;
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

export type OAuthTokenResponse = {
  scoped_teams?: number[];
  scoped_organizations?: string[];
};

interface OAuthConfig {
  signup?: boolean;
}

async function startCallbackServer(): Promise<{
  server: http.Server;
  waitForCallback: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {

    clack.log.info(`Starting OAuth callback server on port ${OAUTH_PORT}`);

    let callbackResolve: () => void;
    let callbackReject: (error: Error) => void;

    const waitForCallback = () =>
      new Promise<void>((res, rej) => {
        callbackResolve = res;
        callbackReject = rej;
      });

    const server = http.createServer((req, res) => {
      clack.log.info(`Incoming request - Method: ${req.method}, URL: ${req.url || '(missing)'}`);

      if (!req.url) {
        clack.log.warn('Request received but req.url is missing');
        res.writeHead(400);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);
      clack.log.info(`OAuth callback received - Full URL: ${url.toString()}`);

      if (url.pathname === '/callback') {
        clack.log.info(`OAuth callback path matched - Query params: ${url.search}`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head>
              <meta charset="UTF-8">
              <title>PostHog wizard is ready</title>
              ${OAUTH_CALLBACK_STYLES}
            </head>
            <body>
              <p>PostHog login complete!</p>
              <p>Return to your terminal: the wizard is hard at work on your project<span class="blink">█</span></p>
              <script>window.close();</script>
            </body>
          </html>
        `);
        callbackResolve();
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head>
              <meta charset="UTF-8">
              <title>PostHog wizard - Invalid request</title>
              ${OAUTH_CALLBACK_STYLES}
            </head>
            <body>
              <p>Invalid request.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
      }
    });

    clack.log.info(`OAuth callback server started on port ${OAUTH_PORT}`);

    server.listen(OAUTH_PORT, () => {
      resolve({ server, waitForCallback });
    });

    server.on('error', reject);
  });
}


export async function performOAuthFlow(
  config: OAuthConfig,
): Promise<OAuthTokenResponse> {
  const loginUrl = new URL(`${PROPELAUTH_AUTH_URL}/login`);
  loginUrl.searchParams.set(
    'redirect_uri',
    `http://localhost:${OAUTH_PORT}/callback`,
  );

  const { server, waitForCallback } = await startCallbackServer();

  clack.log.info(
    `${chalk.bold(
      "If the browser window didn't open automatically, please open the following link to login:",
    )}\n\n${chalk.cyan(loginUrl.toString())}`,
  );

  if (process.env.NODE_ENV !== 'test') {
    opn(loginUrl.toString(), { wait: false }).catch(() => {
      // opn throws in environments without a browser
    });
  }

  const loginSpinner = clack.spinner();
  loginSpinner.start('Waiting for authorization...');

  try {
    await Promise.race([
      waitForCallback(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Authorization timed out')), 60_000),
      ),
    ]);

    // Exchange browser session → CLI token
    const { data } = await axios.post(
      'https://api.yourdomain.com/api/cli/token',
      {},
      { withCredentials: true },
    );

    server.close();
    loginSpinner.stop('Authorization complete!');

    return data;
  } catch (e) {
    loginSpinner.stop('Authorization failed.');
    server.close();

    const error = e instanceof Error ? e : new Error('Unknown error');

    if (error.message.includes('timeout')) {
      clack.log.error('Authorization timed out. Please try again.');
    } else {
      clack.log.error(
        `${chalk.red('Authorization failed:')}\n\n${error.message
        }\n\n${chalk.dim(
          `If you think this is a bug in the PostHog wizard, please create an issue:\n${ISSUES_URL}`,
        )}`,
      );
    }

    await abort();
    throw error;
  }
}
