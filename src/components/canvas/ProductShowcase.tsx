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
  /** Подзагрузка при скролле (только в превью) */
  infiniteScroll?: boolean;
  /** Имя query-параметра для пагинации (например offset) */
  infiniteScrollParam?: string;
};

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

function extractList(body: ApiResponse): unknown[] {
  const raw = body?.data;
  return Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
      ? (raw as Record<string, unknown[]>).data
      : Array.isArray((raw as Record<string, unknown>)?.items)
        ? (raw as Record<string, unknown[]>).items
        : Array.isArray((raw as Record<string, unknown>)?.list)
          ? (raw as Record<string, unknown[]>).list
          : Array.isArray((raw as Record<string, unknown>)?.products)
            ? (raw as Record<string, unknown[]>).products
            : [];
}

export const ProductShowcase = ({
  columns = 3,
  apiUrl = '',
  limit = 30,
  infiniteScroll = false,
  infiniteScrollParam = 'offset',
}: ProductShowcaseStyles) => {
  const { connectors: { connect, drag }, selected, id } = useNode((node) => ({
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
      .then((body: ApiResponse) => {
        const list = extractList(body);
        setProducts(list.map((p) => normalizeApiProduct(p as Record<string, unknown>)));
        setHasMore(list.length >= limit);
      })
      .catch((err) => {
        setError(err?.message || 'Ошибка загрузки');
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [apiUrl, limit]);

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
      .then((body: ApiResponse) => {
        const list = extractList(body);
        setProducts((prev) => [...prev, ...list.map((p) => normalizeApiProduct(p as Record<string, unknown>))]);
        setHasMore(list.length >= limit);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [apiUrl, limit, products.length, loadingMore, hasMore, isConstructor, infiniteScroll, infiniteScrollParam]);

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
            <ProductContext.Provider value={p as ProductItem}>
              <TemplateRenderer rootIds={templateRootIds} nodes={templateNodes} resolver={TEMPLATE_RESOLVER} />
            </ProductContext.Provider>
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
    infiniteScroll: false,
    infiniteScrollParam: 'offset',
  },
};
