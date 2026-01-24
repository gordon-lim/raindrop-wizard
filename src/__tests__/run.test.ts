import { runWizard } from '../run.js';
import { runPythonWizard } from '../python/python-wizard.js';
import { Integration } from '../lib/constants.js';

jest.mock('../python/python-wizard.js');
jest.mock('../utils/clack');

const mockRunPythonWizard = runPythonWizard as jest.MockedFunction<
  typeof runPythonWizard
>;
describe('runWizard error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should exit on wizard error', async () => {
    const testError = new Error('Wizard failed');
    const testArgs = {
      integration: Integration.python,
      debug: true,
      forceInstall: false,
    };

    mockRunPythonWizard.mockRejectedValue(testError);

    await expect(runWizard(testArgs)).rejects.toThrow('process.exit called');
  });

  it('should complete successfully when wizard succeeds', async () => {
    const testArgs = { integration: Integration.python };

    mockRunPythonWizard.mockResolvedValue(undefined);

    await runWizard(testArgs);
  });
});
