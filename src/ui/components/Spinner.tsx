/**
 * Spinner component for long-running operations
 * Maintains API compatibility with clack.spinner()
 *
 * Uses dynamic imports to avoid loading ink at module load time
 */

import type { SpinnerInstance } from '../types';
import { log } from './Logger';

/**
 * Create a spinner instance for displaying progress during long operations
 */
async function createSpinner(): Promise<SpinnerInstance> {
  // Dynamic imports to avoid requiring ink at load time
  const React = await import('react');
  const { render, Box, Text } = await import('ink');
  const InkSpinner = (await import('ink-spinner')).default;

  let isActive = false;
  let currentMessage = '';
  let unmount: (() => void) | null = null;
  let messageUpdateCallback: ((msg: string) => void) | null = null;

  const SpinnerComponent = () => {
    const [message, setMessage] = React.useState(currentMessage);

    React.useEffect(() => {
      // Register message update callback
      messageUpdateCallback = (msg: string) => {
        setMessage(msg);
      };

      return () => {
        messageUpdateCallback = null;
      };
    }, []);

    if (!isActive) return null;

    return React.createElement(
      Box,
      null,
      React.createElement(
        Text,
        { color: 'cyan' },
        React.createElement(InkSpinner, { type: 'dots' }),
      ),
      React.createElement(Text, null, ' ' + message),
    );
  };

  return {
    start(msg = '') {
      if (!isActive) {
        currentMessage = msg;
        isActive = true;
        const { unmount: u } = render(React.createElement(SpinnerComponent));
        unmount = u;
      }
    },
    stop(msg = '') {
      if (isActive && unmount) {
        isActive = false;
        unmount();
        unmount = null;
        messageUpdateCallback = null;
        if (msg) {
          log.success(msg);
        }
      }
    },
    message(msg: string) {
      currentMessage = msg;
      if (messageUpdateCallback) {
        messageUpdateCallback(msg);
      }
    },
  };
}

/**
 * Create and return a new spinner instance
 * Maintains API compatibility with clack.spinner()
 */
export async function spinner(): Promise<SpinnerInstance> {
  return createSpinner();
}
