import { Integration } from './constants';

type IntegrationConfig = {
  docsUrl: string;
};

export const INTEGRATION_CONFIG = {
  [Integration.python]: {
    docsUrl: 'https://www.raindrop.ai/docs/sdk/python',
  },
  [Integration.typescript]: {
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
  },
} as const satisfies Record<Integration, IntegrationConfig>;
