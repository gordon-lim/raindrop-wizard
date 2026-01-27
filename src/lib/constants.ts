export enum Integration {
  python = 'python',
  typescript = 'typescript',
  vercelAiSdk = 'vercel-ai-sdk',
}

export function getIntegrationDescription(type: string): string {
  switch (type) {
    case Integration.python:
      return 'Python';
    case Integration.typescript:
      return 'TypeScript';
    case Integration.vercelAiSdk:
      return 'Vercel AI SDK';
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
export const EVENTS_LIST_ENDPOINT = `${API_BASE_URL}/api/cli/events/list`;
export const ANTHROPIC_BASE_URL = `${API_BASE_URL}/api/cli`;
export const SLACK_ENDPOINT = `${API_BASE_URL}/api/cli/slack`;

/**
 * Safe bash command patterns that can be auto-approved without user confirmation.
 * Uses simple prefix matching with optional * wildcard at the end.
 */
export const SAFE_BASH_PATTERNS: string[] = [
  // === Package Managers - Install/Lock ===
  'npm install*',
  'npm ci*',
  'npm run *',
  'npm test*',
  'npm run build*',
  'npm run lint*',
  'npm run format*',
  'npm ls*',
  'npm outdated*',
  'npm audit*',
  'npx *',

  'yarn',
  'yarn install*',
  'yarn add *',
  'yarn run *',
  'yarn test*',
  'yarn build*',
  'yarn lint*',
  'yarn dlx *',

  'pnpm install*',
  'pnpm add *',
  'pnpm run *',
  'pnpm test*',
  'pnpm dlx *',

  'bun install*',
  'bun add *',
  'bun run *',
  'bun test*',
  'bunx *',

  'pip install*',
  'pip3 install*',
  'pip list*',
  'pip show*',
  'pip freeze*',

  'poetry install*',
  'poetry add *',
  'poetry lock*',
  'poetry show*',

  'uv pip install*',
  'uv pip list*',
  'uv sync*',

  'cargo build*',
  'cargo test*',
  'cargo run*',
  'cargo check*',
  'cargo clippy*',
  'cargo fmt*',

  'go build*',
  'go test*',
  'go run*',
  'go mod tidy*',
  'go mod download*',
  'go get*',
  'go fmt*',

  'bundle install*',
  'bundle exec *',
  'gem install*',

  'composer install*',
  'composer require *',

  'dotnet build*',
  'dotnet test*',
  'dotnet restore*',
  'dotnet run*',

  'mix deps.get*',
  'mix compile*',
  'mix test*',

  // === Type Checking / Linting / Formatting ===
  'tsc*',
  'eslint *',
  'prettier *',
  'biome *',
  'mypy *',
  'python -m mypy*',
  'ruff *',
  'black *',
  'flake8 *',
  'pylint *',
  'pyright*',
  'rubocop*',
  'rustfmt*',
  'gofmt*',
  'swiftlint*',
  'ktlint*',

  // === Build Tools ===
  'make',
  'make build*',
  'make test*',
  'make lint*',
  'make check*',
  'cmake *',
  'gradle build*',
  'gradle test*',
  './gradlew build*',
  './gradlew test*',
  'mvn compile*',
  'mvn test*',
  'mvn package*',

  // === Testing ===
  'jest*',
  'vitest*',
  'mocha*',
  'pytest*',
  'python -m pytest*',
  'npx playwright test*',
  'npx cypress run*',
  'npx jest*',
  'npx vitest*',

  // === Git (read-only operations) ===
  'git status*',
  'git diff*',
  'git log*',
  'git show*',
  'git branch*',
  'git fetch*',
  'git remote -v*',
  'git ls-files*',
  'git rev-parse*',

  // === File/Directory Info (read-only) ===
  'ls *',
  'ls',
  'cat *',
  'head *',
  'tail *',
  'less *',
  'find *',
  'grep *',
  'rg *',
  'ag *',
  'tree*',
  'pwd',
  'wc *',
  'file *',
  'stat *',
  'du *',
  'df *',

  // === Environment/System Info ===
  'which *',
  'whereis *',
  'type *',
  'command -v *',
  'node --version*',
  'node -v*',
  'npm --version*',
  'npm -v*',
  'python --version*',
  'python -V*',
  'python3 --version*',
  '*--version',
  '*-v',
  '*-V',
  'env',
  'printenv*',
  'echo *',
  'uname*',
  'hostname',
  'whoami',
  'date',
  'uptime',

  // === Docker (read-only / safe) ===
  'docker ps*',
  'docker images*',
  'docker logs*',
  'docker inspect*',
  'docker-compose ps*',
  'docker-compose logs*',
  'docker build*',
  'docker compose build*',
  'docker compose up*',

  // === Directory Navigation ===
  'cd *',
  'pushd *',
  'popd',
];
