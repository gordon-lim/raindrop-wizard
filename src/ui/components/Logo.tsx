/**
 * Logo component for the Raindrop wizard
 * Displays the ASCII art logo using Ink
 */

import React from 'react';
import { Text } from 'ink';

const LOGO = `
            ████
          ████████
        ████████████
      ████████████████
    ████████████████████
  ████████████████████████
  ████████████████████████
████████████████████████████
█████████████████      █████
███████████████       ██████
  █████████████       ████
  ███████████        █████
    █████████      ██████
       ████████████████
`;

/**
 * Display the Raindrop logo
 */
export function Logo(): React.ReactElement {
  return <Text color="cyan">{LOGO}</Text>;
}

export default Logo;
