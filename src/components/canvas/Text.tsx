import { useNode } from '@craftjs/core';
import { useContext } from 'react';
import { ProductContext, getProductFieldValue } from '../../contexts/ProductContext';

const selectedOutline = '2px solid #2563eb';

export type TextStyles = {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  /** Путь к полю товара: name, price, description, image.urls.small.url и т.д. */
  productField?: string;
};

export const Text = ({
  content = 'Текст',
  fontSize = 14,
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'left',
  productField = '',
}: { content?: string } & TextStyles) => {
  const { connectors: { connect, drag }, selected } = useNode((node) => ({ selected: node.events.selected }));
  const product = useContext(ProductContext);
  const displayValue = productField && product
    ? getProductFieldValue(product, productField)
    : null;
  const text = displayValue != null ? String(displayValue) : content;
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
      {text}
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
    productField: '',
  },
};
