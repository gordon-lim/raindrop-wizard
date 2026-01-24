/**
 * Custom indicator component for ink-select-input
 * Matches Claude Code's style with arrow indicator
 */

import chalk from 'chalk';

export interface IndicatorProps {
  isSelected?: boolean;
}

export function Indicator({ isSelected }: IndicatorProps): string {
  return isSelected ? chalk.cyan('›') : ' ';
}

export interface ItemProps {
  isSelected?: boolean;
  label: string;
}

export function Item({ isSelected, label }: ItemProps): string {
  if (isSelected) {
    return chalk.cyan(label);
  }
  return chalk.dim(label);
}
