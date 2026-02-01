import { useNode } from '@craftjs/core';
import { parseCustomCss, splitMediaQueries, buildScopedMediaCss, escapeCssForStyleTag } from './cssUtils';

const selectedOutline = '2px solid #2563eb';

export type LinkStyles = {
  href?: string;
  target?: '_self' | '_blank';
  content?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  textDecoration?: 'none' | 'underline';
  fontStyle?: 'normal' | 'italic';
  customCss?: string;
};

export const Link = ({
  href = '#',
  target = '_self',
  content = 'Ссылка',
  fontSize = 14,
  fontWeight = 'normal',
  color = '#2563eb',
  textAlign = 'left',
  textDecoration = 'underline',
  fontStyle = 'normal',
  customCss = '',
}: LinkStyles) => {
  const { connectors: { connect, drag }, selected, id } = useNode((node) => ({
    selected: node.events.selected,
    id: node.id,
  }));

  const { inline: inlineCss, mediaBlocks } = splitMediaQueries(customCss);
  const customStyle = parseCustomCss(inlineCss);
  const mediaCss = buildScopedMediaCss(id, mediaBlocks);
  const safeMediaCss = mediaCss ? escapeCssForStyleTag(mediaCss) : '';

  const baseStyle: React.CSSProperties = {
    margin: 0,
    fontSize,
    fontWeight,
    color,
    textAlign,
    textDecoration,
    fontStyle,
    outline: selected ? selectedOutline : 'none',
    outlineOffset: 2,
    borderRadius: 2,
    cursor: 'pointer',
  };

  return (
    <>
      {safeMediaCss && <style dangerouslySetInnerHTML={{ __html: safeMediaCss }} />}
      <a
        ref={(ref) => ref && connect(drag(ref))}
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        data-craft-node-id={id}
        style={{ ...baseStyle, ...customStyle }}
        onClick={(e) => (href === '#' ? e.preventDefault() : undefined)}
      >
        {content}
      </a>
    </>
  );
};

Link.craft = {
  displayName: 'Ссылка',
  props: {
    href: '#',
    target: '_self',
    content: 'Ссылка',
    fontSize: 14,
    fontWeight: 'normal',
    color: '#2563eb',
    textAlign: 'left',
    textDecoration: 'underline',
    fontStyle: 'normal',
    customCss: '',
  },
};
