import { useNode } from '@craftjs/core';
import { useContext } from 'react';
import { ProductContext, getProductFieldValue } from '../../contexts/ProductContext';

const selectedOutline = '2px solid #2563eb';

export type ImageStyles = {
  /** Статический URL картинки (если не задан productField) */
  src?: string;
  /** Путь к полю товара с URL: image.urls.small.url, image.urls.original.url и т.д. */
  productField?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f0f0f0',
  color: '#888',
  fontSize: 12,
  minWidth: 120,
  minHeight: 120,
  borderRadius: 4,
};

export const Image = ({
  src = '',
  productField = '',
  alt = '',
  width,
  height,
  objectFit = 'cover',
}: ImageStyles) => {
  const { connectors: { connect, drag }, selected } = useNode((node) => ({ selected: node.events.selected }));
  const product = useContext(ProductContext);
  const urlFromProduct = productField && product ? getProductFieldValue(product, productField) : null;
  const imgSrc = urlFromProduct != null ? String(urlFromProduct) : src;
  const hasSrc = Boolean(imgSrc?.trim());
  const wrapperStyle: React.CSSProperties = {
    outline: selected ? selectedOutline : 'none',
    outlineOffset: 2,
    borderRadius: 4,
    minWidth: 120,
    minHeight: 120,
    maxWidth: '100%',
    overflow: 'hidden',
  };
  if (width != null) wrapperStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height != null) wrapperStyle.height = typeof height === 'number' ? `${height}px` : height;
  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    display: hasSrc ? 'block' : 'none',
  };
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={wrapperStyle}
    >
      {hasSrc ? (
        <img src={imgSrc} alt={alt} style={imgStyle} draggable={false} />
      ) : (
        <div style={placeholderStyle}>
          Картинка — выберите поле в настройках
        </div>
      )}
    </div>
  );
};

Image.craft = {
  displayName: 'Картинка',
  props: {
    src: '',
    productField: '',
    alt: '',
    width: undefined,
    height: undefined,
    objectFit: 'cover',
  },
};
