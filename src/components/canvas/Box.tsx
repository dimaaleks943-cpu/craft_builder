import type { ReactNode } from 'react';
import { useNode } from '@craftjs/core';

const selectedOutline = '2px solid #2563eb';

// Парсит строку CSS в объект стилей (camelCase для React)
const parseCustomCss = (css: string): Record<string, string> => {
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

// Извлекает @media блоки и возвращает inline-часть и массив медиа-блоков
const splitMediaQueries = (css: string): { inline: string; mediaBlocks: Array<{ condition: string; content: string }> } => {
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

// Добавляет !important к каждому объявлению, чтобы перебить инлайн-стили React (например display: flex у Box)
const addImportantToDeclarations = (css: string): string =>
  css
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => (decl.endsWith(' !important') ? decl : `${decl} !important`))
    .join('; ');

// Экранирует CSS перед вставкой в <style>, чтобы нельзя было выйти из тега (XSS: </style><script>...)
const escapeCssForStyleTag = (css: string): string => css.replace(/</g, '\\3C ');

// Собирает CSS для инжекта: @container (по ширине холста), селектор по data-node-id
const buildScopedMediaCss = (nodeId: string, mediaBlocks: Array<{ condition: string; content: string }>): string => {
  if (mediaBlocks.length === 0) return '';
  const selector = `[data-craft-node-id="${nodeId}"]`;
  return mediaBlocks
    .map(({ condition, content }) => {
      const contentWithImportant = addImportantToDeclarations(content);
      return `@container ${condition} { ${selector} { ${contentWithImportant} } }`;
    })
    .join('\n');
};

export type BoxStyles = {
  padding?: number;
  margin?: number;
  borderWidth?: number;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  borderColor?: string;
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  gap?: number;
  customCss?: string;
};

export const Box = ({
  children,
  padding = 16,
  margin = 0,
  borderWidth = 1,
  borderStyle = 'dashed',
  borderColor = '#ccc',
  flexDirection = 'column',
  alignItems = 'stretch',
  justifyContent = 'flex-start',
  gap = 8,
  customCss = '',
}: { children?: ReactNode } & BoxStyles) => {
  const { connectors: { connect, drag }, selected, id } = useNode((node) => ({
    selected: node.events.selected,
    id: node.id,
  }));

  const border = selected
    ? selectedOutline
    : borderStyle === 'none'
      ? 'none'
      : `${borderWidth}px ${borderStyle} ${borderColor}`;

  const baseStyle: Record<string, unknown> = {
    minHeight: 200,
    padding,
    margin,
    border,
    borderRadius: 4,
    display: 'flex',
    flexDirection,
    alignItems,
    justifyContent,
    gap,
  };

  const { inline: inlineCss, mediaBlocks } = splitMediaQueries(customCss);
  const customStyle = parseCustomCss(inlineCss);
  const mediaCss = buildScopedMediaCss(id, mediaBlocks);
  const safeMediaCss = mediaCss ? escapeCssForStyleTag(mediaCss) : '';

  return (
    <>
      {safeMediaCss && <style dangerouslySetInnerHTML={{ __html: safeMediaCss }} />}
      <div
        ref={(ref) => ref && connect(drag(ref))}
        data-craft-node-id={id}
        style={{ ...baseStyle, ...customStyle }}
      >
        {children}
      </div>
    </>
  );
};

Box.craft = {
  displayName: 'Контейнер',
  props: {
    padding: 16,
    margin: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 8,
    customCss: '',
  },
};
