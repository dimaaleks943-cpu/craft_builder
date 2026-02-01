// Общие утилиты для customCss (Box, Link и др.)

export const parseCustomCss = (css: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!css?.trim()) return result;
  const declarations = css.split(';').filter(Boolean);
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) continue;
    const key = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (key && value) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = value;
    }
  }
  return result;
};

export const splitMediaQueries = (css: string): { inline: string; mediaBlocks: Array<{ condition: string; content: string }> } => {
  const mediaBlocks: Array<{ condition: string; content: string }> = [];
  let i = 0;
  const s = css;
  const inlineParts: string[] = [];

  while (i < s.length) {
    const mediaStart = s.indexOf('@media', i);
    if (mediaStart === -1) {
      inlineParts.push(s.slice(i).trim());
      break;
    }
    inlineParts.push(s.slice(i, mediaStart).trim());
    i = mediaStart;
    const openParen = s.indexOf('(', i);
    const closeParen = s.indexOf(')', openParen);
    if (openParen === -1 || closeParen === -1) {
      i++;
      continue;
    }
    const condition = s.slice(openParen, closeParen + 1).trim();
    const braceStart = s.indexOf('{', closeParen);
    if (braceStart === -1) {
      i = closeParen + 1;
      continue;
    }
    let depth = 1;
    let pos = braceStart + 1;
    while (pos < s.length && depth > 0) {
      if (s[pos] === '{') depth++;
      else if (s[pos] === '}') depth--;
      pos++;
    }
    const content = s.slice(braceStart + 1, pos - 1).trim();
    mediaBlocks.push({ condition, content });
    i = pos;
  }

  const inline = inlineParts.join(' ').replace(/\s+/g, ' ').trim();
  return { inline, mediaBlocks };
};

export const addImportantToDeclarations = (css: string): string =>
  css
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => (decl.endsWith(' !important') ? decl : `${decl} !important`))
    .join('; ');

export const escapeCssForStyleTag = (css: string): string => css.replace(/</g, '\\3C ');

export const buildScopedMediaCss = (nodeId: string, mediaBlocks: Array<{ condition: string; content: string }>): string => {
  if (mediaBlocks.length === 0) return '';
  const selector = `[data-craft-node-id="${nodeId}"]`;
  return mediaBlocks
    .map(({ condition, content }) => {
      const contentWithImportant = addImportantToDeclarations(content);
      return `@container ${condition} { ${selector} { ${contentWithImportant} } }`;
    })
    .join('\n');
};
