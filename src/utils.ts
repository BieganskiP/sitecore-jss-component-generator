// src/utils.ts
export function pascalCase(input: string) {
    return input
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .split(' ')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s[0].toUpperCase() + s.slice(1))
      .join('');
  }
  