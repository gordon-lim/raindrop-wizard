import { glob } from 'glob';
import fs from 'fs';
import { logToFile, debug } from './debug';

interface InjectorConfig {
  /** File glob pattern (e.g., '**\/*.py' or '**\/*.ts') */
  filePattern: string;
  /** Patterns to ignore during glob */
  ignorePatterns: string[];
  /** Pattern to search for (e.g., 'raindrop.init(' or 'new Raindrop') */
  searchPattern: string;
  /** Regex to match the search pattern */
  searchRegex: RegExp;
  /** Parameter name to add (e.g., 'api_url' or 'endpoint') */
  parameterName: string;
  /** Test URL to inject */
  testUrl: string;
  /** Style: 'object' for {...} or 'function' for (...) */
  style: 'object' | 'function';
}

/**
 * Add a test URL parameter to initialization calls
 */
export async function addTestUrl(config: InjectorConfig): Promise<void> {
  const files = await glob(config.filePattern, {
    ignore: config.ignorePatterns,
    absolute: true,
  });

  for (const file of files) {
    try {
      let content = await fs.promises.readFile(file, 'utf-8');

      // Check if file contains the pattern without the parameter already
      if (
        content.includes(config.searchPattern) &&
        !content.includes(config.parameterName)
      ) {
        const replacements = findReplacements(content, config);

        // Apply replacements in reverse order to maintain positions
        if (replacements.length > 0) {
          replacements.reverse();
          for (const { start, end, replacement } of replacements) {
            content =
              content.slice(0, start) + replacement + content.slice(end);
          }
          await fs.promises.writeFile(file, content, 'utf-8');
        }
      }
    } catch (error) {
      logToFile(`Failed to process file ${file} during setup:`, error);
      debug(
        `Skipping file ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }
  }
}

/**
 * Remove test URL parameter from initialization calls
 */
export async function removeTestUrl(config: InjectorConfig): Promise<void> {
  const files = await glob(config.filePattern, {
    ignore: config.ignorePatterns,
    absolute: true,
  });

  for (const file of files) {
    try {
      let content = await fs.promises.readFile(file, 'utf-8');

      // Check if file contains the pattern with the parameter
      if (
        content.includes(config.searchPattern) &&
        content.includes(config.parameterName)
      ) {
        // Remove parameter - safer pattern to prevent ReDoS
        const paramPattern =
          config.style === 'function'
            ? new RegExp(
                `,?\\s*${config.parameterName}\\s*=\\s*["'][^"']{0,500}["']\\s*,?`,
                'g',
              )
            : new RegExp(
                `,?\\s*${config.parameterName}:\\s*["'][^"']{0,500}["']\\s*,?`,
                'g',
              );

        content = content.replace(paramPattern, '');

        // Clean up any double commas or trailing commas
        content = content.replace(/,\s*,/g, ',');

        if (config.style === 'object') {
          content = content.replace(/,(\s*)\}/g, '$1}');
          content = content.replace(/\{\s*,/g, '{');
        } else {
          content = content.replace(/,(\s*)\)/g, '$1)');
          content = content.replace(/\(\s*,/g, '(');
        }

        await fs.promises.writeFile(file, content, 'utf-8');
      }
    } catch (error) {
      logToFile(`Failed to process file ${file} during cleanup:`, error);
      debug(
        `Skipping file ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }
  }
}

/**
 * Find all replacements needed in a file
 */
function findReplacements(
  content: string,
  config: InjectorConfig,
): Array<{ start: number; end: number; replacement: string }> {
  const replacements: Array<{
    start: number;
    end: number;
    replacement: string;
  }> = [];
  let match;

  while ((match = config.searchRegex.exec(content)) !== null) {
    const startPos = match.index;

    if (config.style === 'object') {
      const replacement = findObjectStyleReplacement(content, startPos, config);
      if (replacement) replacements.push(replacement);
    } else {
      const replacement = findFunctionStyleReplacement(
        content,
        startPos,
        config,
      );
      if (replacement) replacements.push(replacement);
    }
  }

  return replacements;
}

/**
 * Find replacement for object-style initialization: new Raindrop({...})
 */
function findObjectStyleReplacement(
  content: string,
  startPos: number,
  config: InjectorConfig,
): { start: number; end: number; replacement: string } | null {
  const openBracePos = content.indexOf('{', startPos);

  // Find matching closing brace by counting depth
  let braceDepth = 0;
  let endBracePos = -1;
  let inString = false;
  let stringChar = '';

  for (let i = openBracePos; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Track string state (single, double, or template literal)
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Count braces when not in string
    if (!inString) {
      if (char === '{') braceDepth++;
      if (char === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          endBracePos = i;
          break;
        }
      }
    }
  }

  // After finding closing brace, verify next non-whitespace char is ')'
  let endParenPos = -1;
  if (endBracePos !== -1) {
    for (let i = endBracePos + 1; i < content.length; i++) {
      const char = content[i];
      if (char === ')') {
        endParenPos = i;
        break;
      }
      if (!/\s/.test(char)) break;
    }
  }

  if (endBracePos !== -1 && endParenPos !== -1) {
    const innerContent = content.slice(openBracePos + 1, endBracePos);
    const trimmed = innerContent.trim();
    const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
    const comma = needsComma ? ',' : '';

    const patternMatch = content.slice(startPos).match(/^new\s+\w+\s*\(/);
    const constructorCall = patternMatch
      ? patternMatch[0].slice(0, -1)
      : 'new Raindrop';

    const replacement = `${constructorCall}({${innerContent}${comma}\n  ${config.parameterName}: "${config.testUrl}"\n})`;

    return {
      start: startPos,
      end: endParenPos + 1,
      replacement,
    };
  }

  return null;
}

/**
 * Find replacement for function-style initialization: raindrop.init(...)
 */
function findFunctionStyleReplacement(
  content: string,
  startPos: number,
  config: InjectorConfig,
): { start: number; end: number; replacement: string } | null {
  const openParenPos = content.indexOf('(', startPos);

  // Find matching closing parenthesis by counting depth
  let depth = 0;
  let endPos = openParenPos;
  let inString = false;
  let stringChar = '';

  for (let i = openParenPos; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Track string state to ignore parentheses in strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Count parentheses when not in string
    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') {
        depth--;
        if (depth === 0) {
          endPos = i;
          break;
        }
      }
    }
  }

  if (depth === 0 && endPos > openParenPos) {
    const innerContent = content.slice(openParenPos + 1, endPos);
    const trimmed = innerContent.trim();
    const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
    const comma = needsComma ? ', ' : '';

    const functionName = content
      .slice(startPos, openParenPos)
      .replace(/\s+$/, '');
    const replacement = `${functionName}(${innerContent}${comma}\n            ${config.parameterName}="${config.testUrl}")`;

    return {
      start: startPos,
      end: endPos + 1,
      replacement,
    };
  }

  return null;
}
