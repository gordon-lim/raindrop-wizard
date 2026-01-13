import { IS_DEV } from '../lib/constants';
import type { CloudRegion } from './types';

export const getAssetHostFromHost = (host: string) => {
  if (host.includes('us.i.raindrop.ai')) {
    return 'https://us-assets.i.raindrop.ai';
  }

  if (host.includes('eu.i.raindrop.ai')) {
    return 'https://eu-assets.i.raindrop.ai';
  }

  return host;
};

export const getUiHostFromHost = (host: string) => {
  if (host.includes('us.i.raindrop.ai')) {
    return 'https://us.raindrop.ai';
  }

  if (host.includes('eu.i.raindrop.ai')) {
    return 'https://eu.raindrop.ai';
  }

  return host;
};

export const getHostFromRegion = (region: CloudRegion) => {
  if (IS_DEV) {
    return 'http://localhost:8010';
  }

  if (region === 'eu') {
    return 'https://eu.i.raindrop.ai';
  }

  return 'https://us.i.raindrop.ai';
};

export const getCloudUrlFromRegion = (region: CloudRegion) => {
  if (IS_DEV) {
    return 'http://localhost:8010';
  }

  if (region === 'eu') {
    return 'https://eu.raindrop.ai';
  }

  return 'https://us.raindrop.ai';
};

export const getLlmGatewayUrlFromHost = (host: string) => {
  if (host.includes('localhost')) {
    return 'http://localhost:3308/wizard';
  }

  if (host.includes('eu.raindrop.ai') || host.includes('eu.i.raindrop.ai')) {
    return 'https://gateway.eu.raindrop.ai/wizard';
  }

  return 'https://gateway.us.raindrop.ai/wizard';
};
