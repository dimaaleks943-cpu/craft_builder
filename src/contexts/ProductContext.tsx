import { createContext } from 'react';

// Один товар из API (совпадает с ProductShowcase)
export type ProductItem = {
  product_variation_id?: number;
  name?: string;
  description?: string;
  price?: number;
  image?: {
    urls?: {
      small?: { url?: string };
      original?: { url?: string };
    };
  };
  brand?: { name?: string };
  slug?: string;
  [key: string]: unknown;
};

export const ProductContext = createContext<ProductItem | null>(null);

/** Достаёт значение из объекта по пути вида "name", "image.urls.small.url" */
export function getProductFieldValue(product: ProductItem | null, path: string): string | number | undefined {
  if (!product || !path) return undefined;
  const parts = path.split('.');
  let value: unknown = product;
  for (const key of parts) {
    if (value == null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value === 'string' || typeof value === 'number') return value;
  return value != null ? String(value) : undefined;
}

/** Мок товара для отображения в конструкторе, когда API ещё не вернул данные */
export const MOCK_PRODUCT: ProductItem = {
  name: 'Название товара',
  description: 'Описание товара для примера.',
  price: 999,
  image: {
    urls: {
      small: { url: 'https://placehold.co/300x300?text=Photo' },
      original: { url: 'https://placehold.co/600x600?text=Photo' },
    },
  },
  brand: { name: 'Бренд' },
  slug: 'product-slug',
};
