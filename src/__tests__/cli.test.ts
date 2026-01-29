// Mock functions must be defined before imports
const mockRunWizard = jest.fn();

jest.mock('../run.js', () => ({ runWizard: mockRunWizard }));
jest.mock('semver', () => ({ satisfies: () => true }));

describe('CLI argument parsing', () => {
  const originalArgv = process.argv;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalExit = process.exit;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.RAINDROP_DEBUG;
    delete process.env.RAINDROP_DEFAULT;
    delete process.env.RAINDROP_INSTALL_DIR;

    // Mock process.exit to prevent test runner from exiting
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    process.env = originalEnv;
    jest.resetModules();
  });

  /**
   * Helper to run the CLI with given arguments
   */
  async function runCLI(args: string[]) {
    process.argv = ['node', 'bin.ts', ...args];

    jest.isolateModules(() => {
      require('../../bin.ts');
    });

    // Allow yargs to process
    await new Promise((resolve) => setImmediate(resolve));
  }

  /**
   * Helper to get the arguments passed to a mock function
   */
  function getLastCallArgs(mockFn: jest.Mock) {
    expect(mockFn).toHaveBeenCalled();
    return mockFn.mock.calls[mockFn.mock.calls.length - 1][0];
  }

  describe('--default flag', () => {
    test('defaults to false when not specified', async () => {
      await runCLI([]);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.default).toBe(false);
    });

    test('can be explicitly set to false with --no-default', async () => {
      await runCLI(['--no-default']);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.default).toBe(false);
    });

    test('can be explicitly set to true', async () => {
      await runCLI(['--default']);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.default).toBe(true);
    });
  });

  describe('--integration flag', () => {
    test('is undefined when not specified', async () => {
      await runCLI([]);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.integration).toBeUndefined();
    });

    test.each(['python', 'typescript'])(
      'accepts "%s" as a valid integration',
      async (integration) => {
        await runCLI(['--integration', integration]);

        const args = getLastCallArgs(mockRunWizard);
        expect(args.integration).toBe(integration);
      },
    );
  });

  describe('environment variables', () => {
    test('respects RAINDROP_DEBUG', async () => {
      process.env.RAINDROP_DEBUG = 'true';

      await runCLI([]);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.debug).toBe(true);
    });

    test('respects RAINDROP_DEFAULT', async () => {
      process.env.RAINDROP_DEFAULT = 'true';

      await runCLI([]);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.default).toBe(true);
    });

    test('CLI args override environment variables', async () => {
      process.env.RAINDROP_DEBUG = 'false';
      process.env.RAINDROP_DEFAULT = 'false';

      await runCLI(['--debug', '--default']);

      const args = getLastCallArgs(mockRunWizard);
      expect(args.debug).toBe(true);
      expect(args.default).toBe(true);
    });
  });

  describe('all flags', () => {
    test('all flags work together', async () => {
      await runCLI([
        '--debug',
        '--default',
        '--force-install',
        '--install-dir',
        '/custom/path',
        '--integration',
        'typescript',
      ]);

      const args = getLastCallArgs(mockRunWizard);

      expect(args.debug).toBe(true);
      expect(args.default).toBe(true);
      expect(args['force-install']).toBe(true);
      expect(args['install-dir']).toBe('/custom/path');
      expect(args.integration).toBe('typescript');
    });
  });
});
