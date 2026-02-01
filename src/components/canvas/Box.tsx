import type { ReactNode } from 'react';
import { useNode } from '@craftjs/core';
import { parseCustomCss, splitMediaQueries, buildScopedMediaCss, escapeCssForStyleTag } from './cssUtils';

const selectedOutline = '2px solid #2563eb';

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
