<p align="center">
  <img alt="raindrop.ai logo" src="https://user-images.githubusercontent.com/65415371/205059737-c8a4f836-4889-4654-902e-f302b187b6a0.png">
</p>

> **ℹ️ Acknowledgement:** This project is a fork of [PostHog's wizard](https://github.com/PostHog/wizard).


<h1>raindrop.ai wizard ✨</h1>
<h4>The raindrop.ai wizard helps you quickly add raindrop.ai to your project using AI.</h4>

# Usage

To use the wizard, you can run it directly using:

```bash
npx @raindrop/wizard
```

Currently the wizard can be used for **Python and TypeScript** projects. If you have other integrations you would like the wizard to
support, please open a [GitHub issue](https://github.com/raindrop/wizard/issues)!

# Options

The following CLI arguments are available:

| Option            | Description                                                      | Type    | Default | Choices                                              | Environment Variable           |
| ----------------- | ---------------------------------------------------------------- | ------- | ------- | ---------------------------------------------------- | ------------------------------ |
| `--help`          | Show help                                                        | boolean |         |                                                      |                                |
| `--version`       | Show version number                                              | boolean |         |                                                      |                                |
| `--debug`         | Enable verbose logging                                           | boolean | `false` |                                                      | `RAINDROP_DEBUG`                |
| `--default`       | Use default options for all prompts                              | boolean | `false` |                                                      | `RAINDROP_DEFAULT`              |
| `--integration`   | Integration to set up                                            | string  |         | "python", "typescript"                                |                                |
| `--force-install` | Force install packages even if peer dependency checks fail       | boolean | `false` |                                                      | `RAINDROP_FORCE_INSTALL`        |
| `--install-dir`   | Directory to install raindrop.ai in                                  | string  |         |                                                      | `RAINDROP_INSTALL_DIR`          |
| `--api-key`       | Raindrop write key (phx_xxx) for authentication                  | string  |         |                                                      | `RAINDROP_WRITE_KEY`            |

# Requirements

The wizard requires the `ANTHROPIC_API_KEY` environment variable to be set. This is used to authenticate with the Claude API for the AI agent that performs the integration.

```bash
export ANTHROPIC_API_KEY=your_api_key_here
npx @raindrop/wizard
```

> Note: A large amount of the scaffolding for this came from the amazing Sentry
> wizard, which you can find [here](https://github.com/getsentry/sentry-wizard)
> 💖

# Steal this code

While the wizard works great on its own, we also find the approach used by this
project is a powerful way to improve AI agent coding sessions.
Agents can run CLI tools, which means that conventional code like this can
participate in the AI revolution as well – with all the benefits and control
that conventional code implies.

If you want to use this code as a starting place for your own project, here's a
quick explainer on its structure.

## Entrypoint: `bin.ts`

The entrypoint for this tool is `bin.ts`. This file handles CLI argument parsing
and delegates to `src/run.ts` for the main wizard flow.

## Leave rules behind

Supporting agent sessions after we leave is important. There are plenty of ways
to break or misconfigure raindrop.ai, so guarding against this is key.

`src/steps/add-editor-rules.ts` demonstrates how to dynamically construct
rules files and store them in the project's `.cursor/rules` directory.

## Agent Integration

The wizard uses the Claude Agent SDK to intelligently modify your project. The agent
prompt is built in `src/lib/agent-runner.ts` and includes framework-specific documentation
to guide the integration process.

The agent uses the `ANTHROPIC_API_KEY` environment variable to authenticate with Claude's API.

## Running locally

### Quick test without linking

```bash
pnpm try --install-dir=[a path]
```

### Development with auto-rebuild

```bash
pnpm run dev
```

This builds, links globally, and watches for changes. Leave it running - any `.ts` file changes will auto-rebuild. Then from any project:

```bash
wizard --integration=typescript
```

## Testing

To run unit tests, run:

```bash
bin/test
```

To run E2E tests run:

```bash
bin/test-e2e
```

E2E tests are a bit more complicated to create and adjust due to to their mocked
LLM calls. See the `e2e-tests/README.md` for more information.

## Publishing your tool

To make your version of a tool usable with a one-line `npx` command:

1. Edit `package.json`, especially details like `name`, `version`
2. Run [`npm publish`](https://docs.npmjs.com/cli/v7/commands/npm-publish) from
   your project directory
3. Now you can run it with `npx yourpackagename`
