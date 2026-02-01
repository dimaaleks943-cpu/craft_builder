import { useNode } from '@craftjs/core';

const selectedOutline = '2px solid #2563eb';

export type TextStyles = {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
};

export const Text = ({
  content = 'Текст',
  fontSize = 14,
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'left',
}: { content?: string } & TextStyles) => {
  const { connectors: { connect, drag }, selected } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <p
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        margin: '0 0 8px 0',
        fontSize,
        fontWeight,
        color,
        textAlign,
        outline: selected ? selectedOutline : 'none',
        outlineOffset: 2,
        borderRadius: 2,
      }}
    >
      {content}
    </p>
  );
};

Text.craft = {
  displayName: 'Текст',
  props: {
    content: 'Текст',
    fontSize: 14,
    fontWeight: 'normal',
    color: '#000000',
    textAlign: 'left',
  },
};
