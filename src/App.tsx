import { useEffect, useState, useCallback, useRef } from 'react';
import { Editor, Frame, Element, useEditor } from '@craftjs/core';
import { Box, Text, Link, Image, ProductShowcase } from './components/canvas';
import { EditorModeContext } from './contexts/EditorModeContext';

// Состояние одной страницы: name — для вкладки, slug — путь (product → ссылка /product)
type PageRecord = { name: string; slug: string; json: string | null };
type PagesState = Record<string, PageRecord>;
/** Формат файла при сохранении/загрузке: все страницы */
type SitePagesFile = { pages: PagesState };
const INITIAL_PAGE_JSON = `{"ROOT":{"type":{"resolvedName":"Box"},"isCanvas":true,"props":{"padding":16,"margin":0,"borderWidth":1,"borderStyle":"dashed","borderColor":"#ccc","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","gap":8,"customCss":""},"displayName":"Контейнер","custom":{},"hidden":false,"nodes":["aPhu18Iicn","N03NwJIH0I"],"linkedNodes":{}},"aPhu18Iicn":{"type":{"resolvedName":"Text"},"isCanvas":false,"props":{"content":"Текст","fontSize":14,"fontWeight":"normal","color":"#000000","textAlign":"left","productField":""},"displayName":"Текст","custom":{},"parent":"ROOT","hidden":false,"nodes":[],"linkedNodes":{}},"N03NwJIH0I":{"type":{"resolvedName":"Link"},"isCanvas":false,"props":{"href":"x","target":"_self","content":"Ссылка","fontSize":14,"fontWeight":"normal","color":"#2563eb","textAlign":"left","textDecoration":"underline","fontStyle":"normal","customCss":""},"displayName":"Ссылка","custom":{},"parent":"ROOT","hidden":false,"nodes":[],"linkedNodes":{}}}`;
// Пустая страница: один корневой Box без детей (валидный Craft.js JSON). Fallback, когда у страницы нет сохранённого json.
const EMPTY_PAGE_JSON = {"ROOT":{"type":{"resolvedName":"Box"},"isCanvas":true,"props":{"padding":16,"margin":0,"borderWidth":1,"borderStyle":"dashed","borderColor":"#ccc","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","gap":8,"customCss":""},"displayName":"Контейнер","custom":{},"hidden":false,"nodes":["BogS102Ql_"],"linkedNodes":{}},"BogS102Ql_":{"type":{"resolvedName":"Link"},"isCanvas":false,"props":{"href":"x","target":"_self","content":"Ссылка","fontSize":14,"fontWeight":"normal","color":"#2563eb","textAlign":"left","textDecoration":"underline","fontStyle":"normal","customCss":""},"displayName":"Ссылка","custom":{},"parent":"ROOT","hidden":false,"nodes":[],"linkedNodes":{}}};

// Шаблон для новых страниц: чистый холст (только корневой Box). Используется только при создании страницы.
const NEW_PAGE_JSON = {"ROOT":{"type":{"resolvedName":"Box"},"isCanvas":true,"props":{"padding":16,"margin":0,"borderWidth":1,"borderStyle":"dashed","borderColor":"#ccc","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","gap":8,"customCss":""},"displayName":"Контейнер","custom":{},"hidden":false,"nodes":["new_page_box"],"linkedNodes":{}},"new_page_box":{"type":{"resolvedName":"Box"},"isCanvas":true,"props":{"padding":16,"margin":0,"borderWidth":0,"borderStyle":"solid","borderColor":"#ccc","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","gap":8,"customCss":""},"displayName":"Контейнер","custom":{},"hidden":false,"nodes":[],"linkedNodes":{},"parent":"ROOT"}};

// Модалка: имя страницы (slug) для URL, например product → /product
const AddPageModal = ({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (slug: string) => void;
}) => {
  const [value, setValue] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = value.trim().toLowerCase().replace(/^\//, '').replace(/[^a-z0-9-_]/g, '-') || 'page';
    if (slug) {
      onSubmit(slug);
      onClose();
    }
  };
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          minWidth: 320,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Новая страница</div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          Имя для URL (латиница): <code>product</code> → ссылка <code>/product</code>
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="product"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              marginBottom: 16,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
              Отмена
            </button>
            <button type="submit" style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Переключатель страниц: вкладки + «Добавить страницу»
const PageSwitcher = ({
  pages,
  setPages,
  currentPageId,
  setCurrentPageId,
}: {
  pages: PagesState;
  setPages: React.Dispatch<React.SetStateAction<PagesState>>;
  currentPageId: string;
  setCurrentPageId: (id: string) => void;
}) => {
  const { query, actions } = useEditor();
  const [showAddModal, setShowAddModal] = useState(false);

  const switchToPage = useCallback(
    (targetId: string) => {
      if (targetId === currentPageId) return;
      const serialized = query.serialize();
      const targetJson = pages[targetId]?.json ?? EMPTY_PAGE_JSON;
      setPages((prev) => ({
        ...prev,
        [currentPageId]: { ...prev[currentPageId], json: serialized },
      }));
      setCurrentPageId(targetId);
      actions.deserialize(targetJson);
    },
    [currentPageId, pages, setPages, setCurrentPageId, query, actions]
  );

  const addPageWithSlug = useCallback(
    (slug: string) => {
      const serialized = query.serialize();
      const newId = `page-${Date.now()}`;
      const normalizedSlug = slug.trim().toLowerCase().replace(/^\//, '').replace(/[^a-z0-9-_]/g, '-') || 'page';
      setPages((prev) => ({
        ...prev,
        [currentPageId]: { ...prev[currentPageId], json: serialized },
        [newId]: { name: normalizedSlug, slug: normalizedSlug, json: NEW_PAGE_JSON },
      }));
      setCurrentPageId(newId);
      queueMicrotask(() => actions.deserialize(NEW_PAGE_JSON));
    },
    [currentPageId, setPages, setCurrentPageId, query, actions]
  );

  const tabStyle = (active: boolean) => ({
    padding: '8px 14px',
    border: `1px solid ${active ? '#2563eb' : '#ddd'}`,
    borderRadius: 6,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#2563eb' : '#333',
    cursor: 'pointer',
    fontSize: 13,
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #eee', background: '#fafafa', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Страницы:</span>
        {Object.entries(pages).map(([id, page]) => (
          <button key={id} type="button" onClick={() => switchToPage(id)} style={tabStyle(id === currentPageId)} title={`/${page.slug}`}>
            {page.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{ ...tabStyle(false), borderStyle: 'dashed', color: '#16a34a', borderColor: '#16a34a' }}
        >
          + Добавить страницу
        </button>
      </div>
      {showAddModal && <AddPageModal onClose={() => setShowAddModal(false)} onSubmit={addPageWithSlug} />}
    </>
  );
};

// Один холст: один Frame всегда смонтирован, меняется только обёртка (стиль + onClick в превью). Так состояние редактора не сбрасывается при переключении Конструктор/Превью.
const CanvasWithPreview = ({
  isConstructor,
  canvasWrapperStyle,
  previewWrapperStyle,
  pages,
  setPages,
  currentPageId,
  setCurrentPageId,
}: {
  isConstructor: boolean;
  canvasWrapperStyle: React.CSSProperties;
  previewWrapperStyle: React.CSSProperties;
  pages: PagesState;
  setPages: React.Dispatch<React.SetStateAction<PagesState>>;
  currentPageId: string;
  setCurrentPageId: (id: string) => void;
}) => {
  const { actions, query } = useEditor();

  // При первом открытии подгружаем шаблон текущей страницы (INITIAL_PAGE_JSON), иначе холст остаётся пустым
  useEffect(() => {
    const initialJson = pages[currentPageId]?.json ?? EMPTY_PAGE_JSON;
    actions.deserialize(typeof initialJson === 'string' ? initialJson : JSON.stringify(initialJson));
  }, []);

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConstructor) return;
      const a = (e.target as HTMLElement).closest('a[href]');
      if (!a) return;
      const href = (a as HTMLAnchorElement).getAttribute('href') ?? '';
      // Не перехватываем внешние ссылки (http:, https:, mailto:) и якоря (#)
      if (href.includes(':') || href === '' || href === '#') return;
      const path = href.replace(/^\//, '').split('/')[0] || 'main';
      const entry = Object.entries(pages).find(([, p]) => p.slug === path || (path === 'main' && p.slug === 'main'));
      if (!entry) return;
      e.preventDefault();
      e.stopPropagation();
      const [targetId] = entry;
      if (targetId === currentPageId) return;
      // Сначала сохраняем текущую страницу в pages, иначе правки на ней потеряются
      const serialized = query.serialize();
      setPages((prev) => ({
        ...prev,
        [currentPageId]: { ...prev[currentPageId], json: serialized },
      }));
      setCurrentPageId(targetId);
      actions.deserialize(pages[targetId]?.json ?? EMPTY_PAGE_JSON);
    },
    [isConstructor, pages, currentPageId, setPages, setCurrentPageId, query, actions]
  );

  return (
    <EditorModeContext.Provider value={isConstructor}>
      <div
        style={isConstructor ? canvasWrapperStyle : previewWrapperStyle}
        onClick={handlePreviewClick}
      >
        <Frame>
          <Element is={Box} canvas />
        </Frame>
      </div>
    </EditorModeContext.Provider>
  );
};

// Ширины viewport по устройствам (px)
const VIEWPORT_WIDTH = { desktop: null as number | null, tablet: 768, mobile: 375 } as const;
type ViewportType = keyof typeof VIEWPORT_WIDTH;

type ViewMode = 'constructor' | 'preview';

// Панель отмены/возврата, переключатель устройств, Сохранить/Загрузить JSON и переключатель Конструктор/Превью
const HistoryToolbar = ({
  viewport,
  setViewport,
  viewMode,
  setViewMode,
  pages,
  setPages,
  currentPageId,
  setCurrentPageId,
}: {
  viewport: ViewportType;
  setViewport: (v: ViewportType) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  pages: PagesState;
  setPages: React.Dispatch<React.SetStateAction<PagesState>>;
  currentPageId: string;
  setCurrentPageId: (id: string) => void;
}) => {
  const { canUndo, canRedo, actions, query } = useEditor((_state, q) => ({
    canUndo: q.history.canUndo(),
    canRedo: q.history.canRedo(),
  }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Сохранить все страницы в один JSON (текущая — из редактора, остальные — из state)
  const handleSaveJson = () => {
    const exportPages: PagesState = {};
    for (const [id, p] of Object.entries(pages)) {
      const json =
        id === currentPageId
          ? query.serialize()
          : typeof p.json === 'string'
            ? p.json
            : p.json == null
              ? null
              : JSON.stringify(p.json);
      exportPages[id] = { name: p.name, slug: p.slug, json };
    }
    const data: SitePagesFile = { pages: exportPages };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-pages.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Загрузить JSON со всеми страницами и показать первую
  const handleLoadJson = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const data = JSON.parse(text) as SitePagesFile;
          if (!data?.pages || typeof data.pages !== 'object') return;
          const ids = Object.keys(data.pages);
          if (ids.length === 0) return;
          setPages(data.pages);
          setCurrentPageId(ids[0]);
          const firstJson = data.pages[ids[0]]?.json;
          const toDeserialize =
            firstJson == null ? EMPTY_PAGE_JSON : typeof firstJson === 'string' ? firstJson : JSON.stringify(firstJson);
          actions.deserialize(toDeserialize);
        } catch (_) {
          /* ignore */
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    },
    [setPages, setCurrentPageId, actions]
  );

  const btnStyle = (disabled: boolean) => ({
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    background: disabled ? '#f0f0f0' : '#fff',
    color: disabled ? '#999' : '#333',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
  });

  const deviceStyle = (active: boolean) => ({
    padding: '6px 10px',
    border: `1px solid ${active ? '#2563eb' : '#ddd'}`,
    borderRadius: 6,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#2563eb' : '#333',
    cursor: 'pointer',
    fontSize: 12,
  });

  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 24px', borderBottom: '1px solid #eee', background: '#fff', alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        type="button"
        title="Отменить (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => actions.history.undo()}
        style={btnStyle(!canUndo)}
      >
        ← Назад
      </button>
      <button
        type="button"
        title="Повторить (Ctrl+Y)"
        disabled={!canRedo}
        onClick={() => actions.history.redo()}
        style={btnStyle(!canRedo)}
      >
        Вперёд →
      </button>
      <span style={{ width: 1, height: 20, background: '#eee', marginLeft: 4 }} />
      <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Вид:</span>
      <button type="button" title="Десктоп" onClick={() => setViewport('desktop')} style={deviceStyle(viewport === 'desktop')}>
        Десктоп
      </button>
      <button type="button" title="Планшет (768px)" onClick={() => setViewport('tablet')} style={deviceStyle(viewport === 'tablet')}>
        Планшет
      </button>
      <button type="button" title="Мобильный (375px)" onClick={() => setViewport('mobile')} style={deviceStyle(viewport === 'mobile')}>
        Мобильный
      </button>
      <span style={{ width: 1, height: 20, background: '#eee', marginLeft: 4 }} />
      <button type="button" title="Скачать JSON всех страниц" onClick={handleSaveJson} style={{ ...deviceStyle(false), borderColor: '#16a34a', color: '#16a34a', background: '#fff' }}>
        Сохранить JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleLoadJson}
      />
      <button type="button" title="Загрузить JSON со всеми страницами" onClick={() => fileInputRef.current?.click()} style={{ ...deviceStyle(false), borderColor: '#0ea5e9', color: '#0ea5e9', background: '#fff' }}>
        Загрузить JSON
      </button>
      <span style={{ width: 1, height: 20, background: '#eee', marginLeft: 4 }} />
      <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Режим:</span>
      <button type="button" title="Редактирование" onClick={() => setViewMode('constructor')} style={deviceStyle(viewMode === 'constructor')}>
        Конструктор
      </button>
      <button type="button" title="Просмотр как сайт" onClick={() => setViewMode('preview')} style={deviceStyle(viewMode === 'preview')}>
        Превью
      </button>
    </div>
  );
};

// Стили палитры
const toolboxSectionStyle = {
  marginBottom: 16,
} as const;
const toolboxSectionTitleStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 8,
  paddingLeft: 4,
};
const toolboxItemStyle = {
  padding: '12px 16px',
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: 8,
  cursor: 'grab',
  userSelect: 'none' as const,
  marginBottom: 8,
};

// Палитра — компоненты по отделам (Layout, Text)
const Toolbox = () => {
  const { connectors } = useEditor();
  return (
    <div style={{ padding: 16, borderRight: '1px solid #ddd', width: 200 }}>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>Перетащи на холст или внутрь блока</div>

      <div style={toolboxSectionStyle}>
        <div style={toolboxSectionTitleStyle}>Layout</div>
        <div
          ref={(ref) => ref && connectors.create(ref, <Element is={Box} canvas />)}
          style={toolboxItemStyle}
        >
          Контейнер
        </div>
      </div>

      <div style={toolboxSectionStyle}>
        <div style={toolboxSectionTitleStyle}>Text</div>
        <div
          ref={(ref) => ref && connectors.create(ref, <Element is={Text} content="Текст" />)}
          style={toolboxItemStyle}
        >
          Текст
        </div>
        <div
          ref={(ref) => ref && connectors.create(ref, <Element is={Link} content="Ссылка" />)}
          style={toolboxItemStyle}
        >
          Ссылка
        </div>
        <div
          ref={(ref) => ref && connectors.create(ref, <Element is={Image} />)}
          style={toolboxItemStyle}
        >
          Картинка
        </div>
      </div>

      <div style={toolboxSectionStyle}>
        <div style={toolboxSectionTitleStyle}>Секции</div>
        <div
          ref={(ref) => ref && connectors.create(ref, <Element is={ProductShowcase} />)}
          style={toolboxItemStyle}
        >
          Витрина товаров
        </div>
      </div>
    </div>
  );
};

// Панель настроек — редактирование содержимого текста при выборе
const SettingsPanel = () => {
  const { selectedId, actions, query, selectedNodeProps, displayName, isDeletable, isInsideShowcase, showcaseFields } = useEditor((state, q) => {
    const id = q.getEvent('selected').first();
    const node = id ? state.nodes[id] : null;
    const props = node?.data?.props ?? {};
    let isInsideShowcase = false;
    let showcaseFields: string[] = [];
    if (id) {
      try {
        const ancestors = q.node(id).ancestors();
        const showcaseId = ancestors.find((ancId: string) => state.nodes[ancId]?.data?.displayName === 'Витрина');
        isInsideShowcase = Boolean(showcaseId);
        if (showcaseId) {
          const showcaseNode = state.nodes[showcaseId];
          const sProps = (showcaseNode?.data?.props ?? {}) as Record<string, unknown>;
          const sample = sProps.sampleFields;
          if (Array.isArray(sample)) {
            showcaseFields = sample as string[];
          }
        }
      } catch {
        // ignore
      }
    }
    return {
      selectedId: id,
      selectedNodeProps: props,
      displayName: node?.data?.displayName ?? null,
      isDeletable: id ? q.node(id).isDeletable() : false,
      isInsideShowcase,
      showcaseFields,
    };
  });

  const isText = displayName === 'Текст';
  const isBox = displayName === 'Контейнер';
  const isLink = displayName === 'Ссылка';
  const isImage = displayName === 'Картинка';
  const isShowcase = displayName === 'Витрина';
  const textProps = isText ? (selectedNodeProps as Record<string, unknown>) : {};
  const boxProps = isBox ? (selectedNodeProps as Record<string, unknown>) : {};
  const linkProps = isLink ? (selectedNodeProps as Record<string, unknown>) : {};
  const imageProps = isImage ? (selectedNodeProps as Record<string, unknown>) : {};
  const showcaseProps = isShowcase ? (selectedNodeProps as Record<string, unknown>) : {};
  const contentFromStore = isText ? String(textProps.content ?? '') : isLink ? String(linkProps.content ?? '') : '';

  const [localContent, setLocalContent] = useState(contentFromStore);
  useEffect(() => {
    setLocalContent(contentFromStore);
  }, [selectedId, contentFromStore]);

  const setProp = (key: string, value: unknown) => {
    if (selectedId) actions.setProp(selectedId, (props) => { (props as Record<string, unknown>)[key] = value; });
  };
  const setImageProp = (key: string, value: unknown) => setProp(key, value);
  const setTextProp = <K extends keyof typeof textProps>(key: K, value: (typeof textProps)[K]) => setProp(key, value);
  const setBoxProp = (key: string, value: unknown) => setProp(key, value);
  const setLinkProp = (key: string, value: unknown) => setProp(key, value);
  const setShowcaseProp = (key: string, value: unknown) => setProp(key, value);

  const labelStyle = { display: 'block' as const, fontSize: 11, color: '#666', marginBottom: 4, marginTop: 12 };
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box' as const,
  };

  const deleteBtnStyle = {
    width: '100%',
    marginTop: 16,
    padding: '10px 14px',
    border: '1px solid #dc2626',
    borderRadius: 6,
    background: '#fff',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 13,
  };

  return (
    <div style={{ width: 280, padding: 16, borderLeft: '1px solid #ddd', background: '#fff', overflowY: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 12 }}>Настройки</div>
      {!selectedId ? (
        <div style={{ fontSize: 12, color: '#888' }}>Кликните по элементу на холсте</div>
      ) : (
        <>
          {isDeletable && (
            <button
              type="button"
              onClick={() => selectedId && actions.delete(selectedId)}
              style={deleteBtnStyle}
            >
              Удалить элемент
            </button>
          )}
          {isText ? (
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>
            Текст <span style={{ color: '#2563eb', fontWeight: 500 }}>(выбран на холсте)</span>
          </label>
          <input
            type="text"
            value={localContent}
            onChange={(e) => {
              setLocalContent(e.target.value);
              setTextProp('content', e.target.value);
            }}
            style={inputStyle}
          />

          <label style={labelStyle}>Размер шрифта</label>
          <select
            value={textProps.fontSize ?? 14}
            onChange={(e) => setTextProp('fontSize', Number(e.target.value))}
            style={inputStyle}
          >
            {[12, 14, 16, 18, 20, 24, 28, 32].map((n) => (
              <option key={n} value={n}>{n}px</option>
            ))}
          </select>

          <label style={labelStyle}>Начертание</label>
          <select
            value={textProps.fontWeight ?? 'normal'}
            onChange={(e) => setTextProp('fontWeight', e.target.value as 'normal' | 'bold')}
            style={inputStyle}
          >
            <option value="normal">Обычный</option>
            <option value="bold">Жирный</option>
          </select>

          <label style={labelStyle}>Цвет</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={textProps.color ?? '#000000'}
              onChange={(e) => setTextProp('color', e.target.value)}
              style={{ width: 40, height: 36, padding: 2, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={textProps.color ?? '#000000'}
              onChange={(e) => setTextProp('color', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          <label style={labelStyle}>Выравнивание</label>
          <select
            value={textProps.textAlign ?? 'left'}
            onChange={(e) => setTextProp('textAlign', e.target.value as 'left' | 'center' | 'right')}
            style={inputStyle}
          >
            <option value="left">По левому краю</option>
            <option value="center">По центру</option>
            <option value="right">По правому краю</option>
          </select>

          {isInsideShowcase && (
            <>
              <label style={{ ...labelStyle, marginTop: 16, color: '#2563eb', fontWeight: 600 }}>Витрина: путь к полю товара</label>
              <input
                type="text"
                placeholder="name, price, image.urls.small.url"
                value={String(textProps.productField ?? '')}
                onChange={(e) => setTextProp('productField', e.target.value)}
                style={inputStyle}
                title={
                  showcaseFields && showcaseFields.length
                    ? `Примеры полей: ${showcaseFields.slice(0, 20).join(', ')}${showcaseFields.length > 20 ? ' …' : ''}`
                    : 'Путь к полю из объекта товара (например name или image.urls.small.url)'
                }
              />
              {showcaseFields && showcaseFields.length > 0 && (
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                  Примеры полей из ответа: {showcaseFields.slice(0, 5).join(', ')}
                  {showcaseFields.length > 5 ? ' …' : ''}
                </div>
              )}
            </>
          )}
        </div>
          ) : isLink ? (
        <div>
          <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 8 }}>Ссылка (выбран на холсте)</div>

          <label style={{ ...labelStyle, marginTop: 0 }}>Адрес (URL)</label>
          <input
            type="text"
            placeholder="/page или https://..."
            value={String(linkProps.href ?? '#')}
            onChange={(e) => setLinkProp('href', e.target.value || '#')}
            style={inputStyle}
          />

          <label style={labelStyle}>Открывать</label>
          <select
            value={linkProps.target ?? '_self'}
            onChange={(e) => setLinkProp('target', e.target.value as '_self' | '_blank')}
            style={inputStyle}
          >
            <option value="_self">В этом окне</option>
            <option value="_blank">В новой вкладке</option>
          </select>

          <label style={labelStyle}>Текст ссылки</label>
          <input
            type="text"
            value={isLink ? localContent : ''}
            onChange={(e) => {
              setLocalContent(e.target.value);
              setLinkProp('content', e.target.value);
            }}
            style={inputStyle}
          />

          <label style={labelStyle}>Размер шрифта</label>
          <select
            value={linkProps.fontSize ?? 14}
            onChange={(e) => setLinkProp('fontSize', Number(e.target.value))}
            style={inputStyle}
          >
            {[12, 14, 16, 18, 20, 24, 28, 32].map((n) => (
              <option key={n} value={n}>{n}px</option>
            ))}
          </select>

          <label style={labelStyle}>Начертание</label>
          <select
            value={linkProps.fontWeight ?? 'normal'}
            onChange={(e) => setLinkProp('fontWeight', e.target.value as 'normal' | 'bold')}
            style={inputStyle}
          >
            <option value="normal">Обычный</option>
            <option value="bold">Жирный</option>
          </select>

          <label style={labelStyle}>Стиль шрифта</label>
          <select
            value={linkProps.fontStyle ?? 'normal'}
            onChange={(e) => setLinkProp('fontStyle', e.target.value as 'normal' | 'italic')}
            style={inputStyle}
          >
            <option value="normal">Обычный</option>
            <option value="italic">Курсив</option>
          </select>

          <label style={labelStyle}>Цвет</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={linkProps.color ?? '#2563eb'}
              onChange={(e) => setLinkProp('color', e.target.value)}
              style={{ width: 40, height: 36, padding: 2, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={linkProps.color ?? '#2563eb'}
              onChange={(e) => setLinkProp('color', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          <label style={labelStyle}>Подчёркивание</label>
          <select
            value={linkProps.textDecoration ?? 'underline'}
            onChange={(e) => setLinkProp('textDecoration', e.target.value as 'none' | 'underline')}
            style={inputStyle}
          >
            <option value="underline">Подчёркнуто</option>
            <option value="none">Без подчёркивания</option>
          </select>

          <label style={labelStyle}>Выравнивание</label>
          <select
            value={linkProps.textAlign ?? 'left'}
            onChange={(e) => setLinkProp('textAlign', e.target.value as 'left' | 'center' | 'right')}
            style={inputStyle}
          >
            <option value="left">По левому краю</option>
            <option value="center">По центру</option>
            <option value="right">По правому краю</option>
          </select>

          <label style={labelStyle}>Свой CSS</label>
          <textarea
            placeholder="свойство: значение;\n@media (max-width: 768px) { ... }"
            value={String(linkProps.customCss ?? '')}
            onChange={(e) => setLinkProp('customCss', e.target.value)}
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
        </div>
          ) : isImage ? (
        <div>
          <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 8 }}>Картинка (выбран на холсте)</div>

          <label style={{ ...labelStyle, marginTop: 0 }}>URL картинки</label>
          <input
            type="text"
            placeholder="https://..."
            value={String(imageProps.src ?? '')}
            onChange={(e) => setImageProp('src', e.target.value)}
            style={inputStyle}
          />

          {isInsideShowcase && (
            <>
              <label style={{ ...labelStyle, marginTop: 16, color: '#2563eb', fontWeight: 600 }}>Витрина: привязка к полю товара</label>
              <input
                type="text"
                placeholder="image.urls.small.url"
                value={String(imageProps.productField ?? '')}
                onChange={(e) => setImageProp('productField', e.target.value)}
                style={inputStyle}
                title={
                  showcaseFields && showcaseFields.length
                    ? `Примеры полей: ${showcaseFields.slice(0, 20).join(', ')}${showcaseFields.length > 20 ? ' …' : ''}`
                    : 'Путь к полю из объекта товара (например image.urls.small.url)'
                }
              />
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Например: image.urls.small.url — фото товара</div>
            </>
          )}

          <label style={labelStyle}>Подпись (alt)</label>
          <input
            type="text"
            value={String(imageProps.alt ?? '')}
            onChange={(e) => setImageProp('alt', e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Обрезка (object-fit)</label>
          <select
            value={String(imageProps.objectFit ?? 'cover')}
            onChange={(e) => setImageProp('objectFit', e.target.value)}
            style={inputStyle}
          >
            <option value="cover">Обложка (cover)</option>
            <option value="contain">Вписать (contain)</option>
            <option value="fill">Заполнить (fill)</option>
            <option value="none">Нет</option>
          </select>
        </div>
          ) : isShowcase ? (
        <div>
          <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 8 }}>Витрина товаров (выбран на холсте)</div>

          <label style={{ ...labelStyle, marginTop: 0 }}>URL API товаров</label>
          <input
            type="text"
            placeholder="https://dev-api.cezyo.com/v3/client/catalog/products?limit=30&filter=%7B%7D"
            value={String(showcaseProps.apiUrl ?? '')}
            onChange={(e) => setShowcaseProp('apiUrl', e.target.value)}
            style={inputStyle}
          />
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>GET-запрос, ответ: объект с полем data — массив товаров (name, price, image.urls.small.url)</div>

          <label style={labelStyle}>Колонок в сетке</label>
          <select
            value={showcaseProps.columns ?? 3}
            onChange={(e) => setShowcaseProp('columns', Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
            style={inputStyle}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <label style={labelStyle}>Лимит товаров (limit)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={showcaseProps.limit ?? 30}
            onChange={(e) => setShowcaseProp('limit', Number(e.target.value) || 30)}
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Подзагрузка при скролле (только в превью)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={Boolean(showcaseProps.infiniteScroll)}
              onChange={(e) => setShowcaseProp('infiniteScroll', e.target.checked)}
            />
            Включить подзагрузку при скролле
          </label>
          {showcaseProps.infiniteScroll && (
            <>
              <label style={labelStyle}>Параметр запроса для пагинации</label>
              <input
                type="text"
                placeholder="offset"
                value={String(showcaseProps.infiniteScrollParam ?? 'offset')}
                onChange={(e) => setShowcaseProp('infiniteScrollParam', e.target.value.trim() || 'offset')}
                style={inputStyle}
              />
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                В запрос подставляется значение «сколько товаров уже загружено» (например offset=30, offset=60)
              </div>
            </>
          )}

          <label style={{ ...labelStyle, marginTop: 16 }}>Карточка как ссылка</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={Boolean(showcaseProps.cardLinkEnabled)}
              onChange={(e) => setShowcaseProp('cardLinkEnabled', e.target.checked)}
            />
            Сделать карточки товара ссылками
          </label>
          {showcaseProps.cardLinkEnabled && (
            <>
              <label style={labelStyle}>Страница продукта (slug)</label>
              <input
                type="text"
                placeholder="product"
                value={String(showcaseProps.cardLinkPageSlug ?? 'product')}
                onChange={(e) => setShowcaseProp('cardLinkPageSlug', e.target.value.trim() || 'product')}
                style={inputStyle}
              />

              <label style={labelStyle}>Поле товара для URL</label>
              <input
                type="text"
                placeholder="slug или product_variation_id"
                value={String(showcaseProps.cardLinkField ?? 'slug')}
                onChange={(e) => setShowcaseProp('cardLinkField', e.target.value)}
                style={inputStyle}
                title={
                  showcaseFields && showcaseFields.length
                    ? `Примеры полей: ${showcaseFields.slice(0, 20).join(', ')}${showcaseFields.length > 20 ? ' …' : ''}`
                    : 'Путь к полю из объекта товара (например slug или product_variation_id)'
                }
              />
              {showcaseFields && showcaseFields.length > 0 && (
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                  Примеры полей из ответа: {showcaseFields.slice(0, 5).join(', ')}
                  {showcaseFields.length > 5 ? ' …' : ''}
                </div>
              )}
            </>
          )}
        </div>
          ) : isBox ? (
        <div>
          <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 8 }}>Контейнер (выбран на холсте)</div>

          <label style={labelStyle}>Внутренний отступ (padding), px</label>
          <input
            type="number"
            min={0}
            value={boxProps.padding ?? 16}
            onChange={(e) => setBoxProp('padding', Number(e.target.value) || 0)}
            style={inputStyle}
          />

          <label style={labelStyle}>Внешний отступ (margin), px</label>
          <input
            type="number"
            min={0}
            value={boxProps.margin ?? 0}
            onChange={(e) => setBoxProp('margin', Number(e.target.value) || 0)}
            style={inputStyle}
          />

          <label style={labelStyle}>Рамка (border)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              type="number"
              min={0}
              placeholder="ширина"
              value={boxProps.borderWidth ?? 1}
              onChange={(e) => setBoxProp('borderWidth', Number(e.target.value) || 0)}
              style={{ ...inputStyle, width: 60 }}
            />
            <select
              value={boxProps.borderStyle ?? 'dashed'}
              onChange={(e) => setBoxProp('borderStyle', e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 80 }}
            >
              <option value="none">нет</option>
              <option value="solid">сплошная</option>
              <option value="dashed">пунктир</option>
              <option value="dotted">точки</option>
            </select>
            <input
              type="color"
              value={boxProps.borderColor ?? '#ccc'}
              onChange={(e) => setBoxProp('borderColor', e.target.value)}
              style={{ width: 40, height: 36, padding: 2, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}
            />
          </div>

          <label style={labelStyle}>Размещение контента</label>
          <label style={{ ...labelStyle, marginTop: 4, fontSize: 10 }}>Направление</label>
          <select
            value={boxProps.flexDirection ?? 'column'}
            onChange={(e) => setBoxProp('flexDirection', e.target.value)}
            style={inputStyle}
          >
            <option value="column">Колонка (сверху вниз)</option>
            <option value="row">Ряд (слева направо)</option>
          </select>

          <label style={{ ...labelStyle, marginTop: 4, fontSize: 10 }}>Выравнивание по поперечной оси</label>
          <select
            value={boxProps.alignItems ?? 'stretch'}
            onChange={(e) => setBoxProp('alignItems', e.target.value)}
            style={inputStyle}
          >
            <option value="flex-start">По началу</option>
            <option value="center">По центру</option>
            <option value="flex-end">По концу</option>
            <option value="stretch">Растянуть</option>
          </select>

          <label style={{ ...labelStyle, marginTop: 4, fontSize: 10 }}>Выравнивание по основной оси</label>
          <select
            value={boxProps.justifyContent ?? 'flex-start'}
            onChange={(e) => setBoxProp('justifyContent', e.target.value)}
            style={inputStyle}
          >
            <option value="flex-start">По началу</option>
            <option value="center">По центру</option>
            <option value="flex-end">По концу</option>
            <option value="space-between">Между</option>
            <option value="space-around">Вокруг</option>
          </select>

          <label style={labelStyle}>Расстояние между элементами (gap), px</label>
          <input
            type="number"
            min={0}
            value={boxProps.gap ?? 8}
            onChange={(e) => setBoxProp('gap', Number(e.target.value) || 0)}
            style={inputStyle}
          />

          <label style={labelStyle}>Свой CSS</label>
          <textarea
            placeholder={'background: #f0f0f0;\nborder-radius: 12px;\n@media (max-width: 768px) {\n  display: none;\n}'}
            value={String(boxProps.customCss ?? '')}
            onChange={(e) => setBoxProp('customCss', e.target.value)}
            rows={6}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            Свойства: свойство: значение; @media — срабатывает по ширине холста (Десктоп/Планшет/Мобильный), не по окну браузера.
          </div>
        </div>
          ) : (
            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Выбран: {displayName ?? 'элемент'}</div>
          )}
        </>
      )}
    </div>
  );
};

// Строковые ключи обязательны: при минификации имена переменных (Box, ProductShowcase) меняются на "a", "ke" и т.д., и Craft перестаёт находить компонент в resolver
const resolver: Record<string, React.ComponentType<any>> = {
  'Box': Box,
  'Text': Text,
  'Link': Link,
  'Image': Image,
  'ProductShowcase': ProductShowcase,
};

const INITIAL_PAGE_ID = 'page-1';

const App = () => {
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [viewMode, setViewMode] = useState<ViewMode>('constructor');
  const [pages, setPages] = useState<PagesState>(() => ({
    [INITIAL_PAGE_ID]: { name: 'Главная', slug: 'main', json: INITIAL_PAGE_JSON },
  }));
  const [currentPageId, setCurrentPageId] = useState<string>(INITIAL_PAGE_ID);

  const canvasWidth = VIEWPORT_WIDTH[viewport];
  const canvasWrapperStyle = {
    maxWidth: canvasWidth ?? 1200,
    width: canvasWidth ? canvasWidth : '100%',
    margin: '0 auto',
    minHeight: 400,
    background: '#fff',
    border: '2px dashed #ccc',
    borderRadius: 8,
    boxShadow: viewport !== 'desktop' ? '0 0 0 1px #e5e7eb' : undefined,
    containerType: 'inline-size' as const,
  };

  const previewWrapperStyle = {
    width: '100%',
    minHeight: '100vh',
    background: '#fff',
    containerType: 'inline-size' as const,
  };

  const isConstructor = viewMode === 'constructor';

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Editor
        resolver={resolver}
        enabled={isConstructor}
        indicator={{ style: { pointerEvents: 'none' } }}
      >
        {isConstructor && <Toolbox />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {isConstructor && (
            <PageSwitcher
              pages={pages}
              setPages={setPages}
              currentPageId={currentPageId}
              setCurrentPageId={setCurrentPageId}
            />
          )}
          <HistoryToolbar
            viewport={viewport}
            setViewport={setViewport}
            viewMode={viewMode}
            setViewMode={setViewMode}
            pages={pages}
            setPages={setPages}
            currentPageId={currentPageId}
            setCurrentPageId={setCurrentPageId}
          />
          <div
            style={{
              flex: 1,
              padding: isConstructor ? 24 : 0,
              overflow: 'auto',
              background: isConstructor ? '#fafafa' : '#fff',
              display: 'flex',
              justifyContent: isConstructor ? 'center' : 'stretch',
            }}
          >
            <CanvasWithPreview
              isConstructor={isConstructor}
              canvasWrapperStyle={canvasWrapperStyle}
              previewWrapperStyle={previewWrapperStyle}
              pages={pages}
              setPages={setPages}
              currentPageId={currentPageId}
              setCurrentPageId={setCurrentPageId}
            />
          </div>
        </div>
        {isConstructor && <SettingsPanel />}
      </Editor>
    </div>
  );
};

export default App;
