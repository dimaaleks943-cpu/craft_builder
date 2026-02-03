import { useEffect, useState, useMemo, useContext, useCallback, useRef } from 'react';
import { useNode, useEditor, Element } from '@craftjs/core';
import { ProductContext, getProductFieldValue, MOCK_PRODUCT, type ProductItem } from '../../contexts/ProductContext';
import { EditorModeContext } from '../../contexts/EditorModeContext';
import { Box } from './Box';
import { Text } from './Text';
import { Link } from './Link';
import { Image } from './Image';

const selectedOutline = '2px solid #2563eb';

// Один товар из API (минимальный набор полей под твой ответ)
type ApiProductItem = {
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

type ApiResponse = { data?: ApiProductItem[]; links?: unknown };

/** Нормализует объект товара из API к плоскому виду (name, description, image.urls.small.url и т.д.) */
function normalizeApiProduct(raw: Record<string, unknown>): ApiProductItem {
  const get = (obj: unknown, path: string): unknown => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((v: unknown, key) => (v != null && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined), obj);
  };
  const str = (v: unknown) => (v != null ? String(v) : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : v != null ? Number(v) : undefined);
  return {
    product_variation_id: num(raw.product_variation_id ?? raw.id),
    name: str(raw.name ?? get(raw, 'product_variation.name') ?? get(raw, 'attributes.name') ?? raw.title),
    description: str(raw.description ?? get(raw, 'product_variation.description') ?? get(raw, 'attributes.description')),
    price: num(raw.price ?? get(raw, 'product_variation.price') ?? get(raw, 'attributes.price')),
    image: (raw.image as ApiProductItem['image']) ?? (() => {
      const img = raw.images?.[0] ?? raw.image_url ?? get(raw, 'product_variation.image');
      if (typeof img === 'string') return { urls: { small: { url: img }, original: { url: img } } };
      if (img && typeof img === 'object') {
        const u = img as Record<string, unknown>;
        const url = str(u.url ?? get(u, 'urls.small.url') ?? get(u, 'urls.original.url'));
        if (url) return { urls: { small: { url }, original: { url } } };
      }
      return undefined;
    })(),
    brand: raw.brand as ApiProductItem['brand'] ?? (get(raw, 'product_variation.brand') as ApiProductItem['brand']),
    slug: str(raw.slug ?? get(raw, 'product_variation.slug')),
    ...raw,
  };
}

export type ProductShowcaseStyles = {
  columns?: 1 | 2 | 3 | 4 | 5;
  apiUrl?: string;
  limit?: number;
  /** Путь к массиву элементов в ответе API (например results, data, data.items). Пусто — авто (пробуем results, data, data.data, data.items и т.д.) */
  listPath?: string;
  /** Подзагрузка при скролле (только в превью) */
  infiniteScroll?: boolean;
  /** Имя query-параметра для пагинации (например offset) */
  infiniteScrollParam?: string;
  /** Подсказка: пример путей к полям из ответа API (формируется автоматически по первому товару) */
  sampleFields?: string[];
  /** Делать ли карточки товаров ссылками на страницу продукта */
  cardLinkEnabled?: boolean;
  /** Slug страницы продукта (например product) */
  cardLinkPageSlug?: string;
  /** Поле товара для формирования URL (например slug или product_variation_id) */
  cardLinkField?: string;
};

/** Достаёт значение из объекта по пути (точки и [индекс]). */
function getValueByPath(obj: unknown, path: string): unknown {
  if (obj == null || !path) return undefined;
  const parts = path.trim().split('.');
  let value: unknown = obj;
  for (const segment of parts) {
    if (value == null || typeof value !== 'object') return undefined;
    const bracketMatch = segment.match(/^([^\[\]]+)\[(\d+)\]$/);
    if (bracketMatch) {
      const [, key, indexStr] = bracketMatch;
      value = (value as Record<string, unknown>)[key];
      if (value == null || typeof value !== 'object') return undefined;
      const index = parseInt(indexStr, 10);
      value = Array.isArray(value) ? value[index] : (value as Record<string, unknown>)[indexStr];
    } else {
      value = (value as Record<string, unknown>)[segment];
    }
  }
  return value;
}

/** Добавляет или заменяет query-параметр в URL */
function setQueryParam(url: string, key: string, value: number): string {
  const k = encodeURIComponent(key);
  const v = String(value);
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`([?&])${escapedKey}=[^&]*`);
  const replaced = url.replace(regex, `$1${k}=${v}`);
  if (replaced !== url) return replaced;
  const hasQuery = url.includes('?');
  return url + (hasQuery ? '&' : '?') + k + '=' + v;
}

/** Собирает пути к полям (name, price, image.urls.small.url и т.п.) из объекта товара */
function collectFieldPaths(obj: unknown, prefix = '', depth = 0, acc?: Set<string>): string[] {
  const set = acc ?? new Set<string>();
  if (!obj || typeof obj !== 'object' || depth > 3) {
    return acc ? [] : Array.from(set).sort();
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value == null || typeof value !== 'object') {
      set.add(path);
    }
    if (value && typeof value === 'object') {
      collectFieldPaths(value, path, depth + 1, set);
    }
  }
  return acc ? [] : Array.from(set).sort();
}

// Рендер шаблона карточки из сериализованного дерева (для превью — N карточек)
type SerializedNode = {
  type: { resolvedName?: string } | string;
  props?: Record<string, unknown>;
  nodes?: string[];
  linkedNodes?: Record<string, string>;
};
type SerializedNodes = Record<string, SerializedNode>;
const TEMPLATE_RESOLVER: Record<string, React.ComponentType<any>> = {
  'Box': Box,
  'Text': Text,
  'Link': Link,
  'Image': Image,
};

function TemplateRenderer({
  rootIds,
  nodes,
  resolver,
}: {
  rootIds: string[];
  nodes: SerializedNodes;
  resolver: Record<string, React.ComponentType<any>>;
}) {
  function renderNode(nodeId: string): React.ReactNode {
    const node = nodes[nodeId];
    if (!node) return null;
    const resolvedName = typeof node.type === 'string' ? node.type : node.type?.resolvedName;
    const Comp = resolvedName ? resolver[resolvedName] : null;
    if (!Comp) return null;
    const childIds = node.nodes ?? [];
    const children = childIds.map(renderNode);
    return (
      <Comp key={nodeId} {...(node.props || {})}>
        {children}
      </Comp>
    );
  }
  return (
    <>
      {rootIds.map((rid) => renderNode(rid))}
    </>
  );
}

function extractList(body: unknown, listPath?: string): unknown[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  if (listPath && listPath.trim()) {
    const value = getValueByPath(body, listPath.trim());
    return Array.isArray(value) ? value : [];
  }
  if (Array.isArray(b.results)) return b.results;
  if (Array.isArray(b.data)) return b.data;
  const data = b.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.products)) return data.products;
  }
  if (Array.isArray(b.items)) return b.items;
  if (Array.isArray(b.list)) return b.list;
  if (Array.isArray(b.products)) return b.products;
  return [];
}

export const ProductShowcase = ({
  columns = 3,
  apiUrl = '',
  limit = 30,
  listPath = '',
  infiniteScroll = false,
  infiniteScrollParam = 'offset',
  cardLinkEnabled = false,
  cardLinkPageSlug = 'product',
  cardLinkField = 'slug',
}: ProductShowcaseStyles) => {
  const { connectors: { connect, drag }, selected, id, actions: nodeActions } = useNode((node) => ({
    selected: node.events.selected,
    id: node.id,
  }));

  const isConstructor = useContext(EditorModeContext);
  const { serialized, nodeIds } = useEditor((state, q) => ({
    serialized: q.serialize(),
    nodeIds: Object.keys(state.nodes || {}).sort().join(','),
  }));

  const [products, setProducts] = useState<ApiProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const buildInitialUrl = (base: string) => {
    return base.includes('limit=')
      ? base.replace(/limit=\d+/, `limit=${limit}`)
      : `${base}${base.includes('?') ? '&' : '?'}limit=${limit}`;
  };

  useEffect(() => {
    const urlTrimmed = apiUrl?.trim() ?? '';
    if (!urlTrimmed) {
      setProducts([]);
      setError(null);
      setHasMore(true);
      return;
    }
    setLoading(true);
    setError(null);
    setHasMore(true);
    const url = buildInitialUrl(urlTrimmed);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        const list = extractList(body, listPath);
        const normalized = list.map((p) => normalizeApiProduct(p as Record<string, unknown>));
        setProducts(normalized);
        setHasMore(list.length >= limit);
        if (list.length > 0) {
          const fields = collectFieldPaths(list[0]);
          nodeActions.setProp((props: Record<string, unknown>) => {
            (props as ProductShowcaseStyles).sampleFields = fields;
          });
        } else {
          nodeActions.setProp((props: Record<string, unknown>) => {
            (props as ProductShowcaseStyles).sampleFields = [];
          });
        }
      })
      .catch((err) => {
        setError(err?.message || 'Ошибка загрузки');
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [apiUrl, limit, listPath]);

  const loadMore = useCallback(() => {
    const urlTrimmed = apiUrl?.trim() ?? '';
    if (!urlTrimmed || loadingMore || !hasMore || isConstructor || !infiniteScroll) return;
    const paramName = (infiniteScrollParam || 'offset').trim() || 'offset';
    let url = buildInitialUrl(urlTrimmed);
    url = setQueryParam(url, paramName, products.length);
    setLoadingMore(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        const list = extractList(body, listPath);
        setProducts((prev) => [...prev, ...list.map((p) => normalizeApiProduct(p as Record<string, unknown>))]);
        setHasMore(list.length >= limit);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [apiUrl, limit, listPath, products.length, loadingMore, hasMore, isConstructor, infiniteScroll, infiniteScrollParam]);

  const cardStyle: React.CSSProperties = {
    border: '1px solid #eee',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 120,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: 16,
    padding: 16,
    minHeight: 120,
    outline: selected ? selectedOutline : 'none',
    outlineOffset: 2,
    borderRadius: 8,
  };

  const sampleProduct: ProductItem | null = products[0] ?? MOCK_PRODUCT;

  const { templateRootIds, templateNodes } = useMemo(() => {
    if (!serialized) return { templateRootIds: [] as string[], templateNodes: {} as SerializedNodes };
    try {
      const parsed = JSON.parse(serialized) as SerializedNodes & { [key: string]: { nodes?: string[]; linkedNodes?: Record<string, string> } };
      const nodeData = parsed[id];
      const fromNodes = nodeData?.nodes ?? [];
      const fromLinked = nodeData?.linkedNodes ? Object.values(nodeData.linkedNodes) : [];
      const rootIds = [...fromNodes, ...fromLinked];
      return { templateRootIds: rootIds, templateNodes: parsed };
    } catch {
      return { templateRootIds: [] as string[], templateNodes: {} as SerializedNodes };
    }
  }, [serialized, id, nodeIds]);

  const showRepeatedCards = !isConstructor && !loading && !error && products.length > 0 && templateRootIds.length > 0;
  const showConstructorGrid = isConstructor && !loading && !error;
  /** В конструкторе показываем только первую порцию (limit), чтобы не скроллить лишнее при настройке страницы */
  const productsInConstructor = products.slice(0, limit);

  const buildCardHref = (p: ProductItem): string | null => {
    if (!cardLinkEnabled || !cardLinkPageSlug) return null;
    const value =
      (cardLinkField && getProductFieldValue(p, cardLinkField)) ??
      p.slug ??
      p.product_variation_id;
    if (value == null) return null;
    const base = cardLinkPageSlug.replace(/^\//, '').split('/')[0] || 'product';
    return `/${base}/${encodeURIComponent(String(value))}`;
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isConstructor || !infiniteScroll || !hasMore || loadingMore || !showRepeatedCards) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isConstructor, infiniteScroll, hasMore, loadingMore, loadMore, showRepeatedCards]);

  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      data-craft-node-id={id}
      style={gridStyle}
    >
      {loading && (
        <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: '#666' }}>
          Загрузка товаров…
        </div>
      )}
      {error && (
        <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: '#c00' }}>
          {error}
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: '#888' }}>
          {apiUrl ? 'Нет данных' : 'Укажите URL API в настройках витрины'}
        </div>
      )}

      {showConstructorGrid && (
        <>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#2563eb', marginBottom: 4 }}>
            Конструктор: первая ячейка — шаблон. Показана первая порция ({productsInConstructor.length} товаров), в превью отобразятся все, включая подзагрузку.
          </div>
          {/* В конструкторе — только первая порция (limit), чтобы не скроллить лишнее */}
          {Array.from({ length: 1 + Math.max(0, productsInConstructor.length) }, (_, i) => (
            <div key={i} style={{ ...cardStyle, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  fontSize: 10,
                  color: '#888',
                  background: i === 0 ? '#e0f2fe' : '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: 4,
                  zIndex: 1,
                }}
              >
                {i === 0 ? 'Шаблон — сюда перетаскивайте элементы' : `Товар ${i}`}
              </div>
              <div style={{ paddingTop: 24, flex: 1, minHeight: 80 }}>
                <ProductContext.Provider value={i === 0 ? sampleProduct : (productsInConstructor[i - 1] as ProductItem)}>
                  {i === 0 ? (
                    <Element id={id} is={Box} canvas />
                  ) : templateRootIds.length > 0 ? (
                    <TemplateRenderer rootIds={templateRootIds} nodes={templateNodes} resolver={TEMPLATE_RESOLVER} />
                  ) : (
                    <div style={{ fontSize: 11, color: '#aaa', padding: 8 }}>
                      Добавьте элементы в первую ячейку — они появятся здесь
                    </div>
                  )}
                </ProductContext.Provider>
              </div>
            </div>
          ))}
        </>
      )}

      {/* В режиме «Превью» — все товары из API, у каждой карточки свой продукт в контексте */}
      {showRepeatedCards &&
        products.map((p, i) => (
          <div key={p.product_variation_id ?? p.slug ?? i} style={cardStyle}>
            {(() => {
              const href = buildCardHref(p as ProductItem);
              const inner = (
                <ProductContext.Provider value={p as ProductItem}>
                  <TemplateRenderer rootIds={templateRootIds} nodes={templateNodes} resolver={TEMPLATE_RESOLVER} />
                </ProductContext.Provider>
              );
              return href && !isConstructor ? (
                <a
                  href={href}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                  {inner}
                </a>
              ) : (
                inner
              );
            })()}
          </div>
        ))}
      {showRepeatedCards && loadingMore && (
        <div style={{ gridColumn: '1 / -1', padding: 16, textAlign: 'center', color: '#888', fontSize: 13 }}>
          Загрузка…
        </div>
      )}
      {showRepeatedCards && infiniteScroll && hasMore && !loadingMore && (
        <div ref={sentinelRef} style={{ gridColumn: '1 / -1', height: 1, visibility: 'hidden' }} aria-hidden="true" />
      )}
    </div>
  );
};

ProductShowcase.craft = {
  displayName: 'Витрина',
  props: {
    columns: 3,
    apiUrl: '',
    limit: 30,
    listPath: '',
    infiniteScroll: false,
    infiniteScrollParam: 'offset',
    sampleFields: [],
    cardLinkEnabled: false,
    cardLinkPageSlug: 'product',
    cardLinkField: 'slug',
  },
};
