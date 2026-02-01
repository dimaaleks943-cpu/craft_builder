import { useEffect, useState } from 'react';
import { Editor, Frame, Element, useEditor } from '@craftjs/core';
import { Box, Text } from './components/canvas';

// Ширины viewport по устройствам (px)
const VIEWPORT_WIDTH = { desktop: null as number | null, tablet: 768, mobile: 375 } as const;
type ViewportType = keyof typeof VIEWPORT_WIDTH;

type ViewMode = 'constructor' | 'preview';

// Панель отмены/возврата, переключатель устройств, Сохранить JSON и переключатель Конструктор/Превью
const HistoryToolbar = ({
  viewport,
  setViewport,
  viewMode,
  setViewMode,
}: {
  viewport: ViewportType;
  setViewport: (v: ViewportType) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}) => {
  const { canUndo, canRedo, actions, query } = useEditor((_state, q) => ({
    canUndo: q.history.canUndo(),
    canRedo: q.history.canRedo(),
  }));

  const handleSaveJson = () => {
    const json = query.serialize();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'page-structure.json';
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <button type="button" title="Скачать JSON структуры страницы" onClick={handleSaveJson} style={{ ...deviceStyle(false), borderColor: '#16a34a', color: '#16a34a', background: '#fff' }}>
        Сохранить JSON
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

// Палитра — контейнер и текст, перетаскиваемые на холст
const Toolbox = () => {
  const { connectors } = useEditor();
  const itemStyle = {
    padding: '12px 16px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: 8,
    cursor: 'grab',
    userSelect: 'none' as const,
    marginBottom: 8,
  };
  return (
    <div style={{ padding: 16, borderRight: '1px solid #ddd', width: 200 }}>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>Перетащи на холст или внутрь блока</div>
      <div
        ref={(ref) => ref && connectors.create(ref, <Element is={Box} canvas />)}
        style={itemStyle}
      >
        Контейнер
      </div>
      <div
        ref={(ref) => ref && connectors.create(ref, <Element is={Text} content="Текст" />)}
        style={itemStyle}
      >
        Текст
      </div>
    </div>
  );
};

// Панель настроек — редактирование содержимого текста при выборе
const SettingsPanel = () => {
  const { selectedId, actions, query, selectedNodeProps, displayName, isDeletable } = useEditor((state, q) => {
    const id = q.getEvent('selected').first();
    const node = id ? state.nodes[id] : null;
    const props = node?.data?.props ?? {};
    return {
      selectedId: id,
      selectedNodeProps: props,
      displayName: node?.data?.displayName ?? null,
      isDeletable: id ? q.node(id).isDeletable() : false,
    };
  });

  const isText = displayName === 'Текст';
  const isBox = displayName === 'Контейнер';
  const textProps = isText ? (selectedNodeProps as Record<string, unknown>) : {};
  const boxProps = isBox ? (selectedNodeProps as Record<string, unknown>) : {};
  const contentFromStore = isText ? String(textProps.content ?? '') : '';

  const [localContent, setLocalContent] = useState(contentFromStore);
  useEffect(() => {
    setLocalContent(contentFromStore);
  }, [selectedId, contentFromStore]);

  const setProp = (key: string, value: unknown) => {
    if (selectedId) actions.setProp(selectedId, (props) => { (props as Record<string, unknown>)[key] = value; });
  };
  const setTextProp = <K extends keyof typeof textProps>(key: K, value: (typeof textProps)[K]) => setProp(key, value);
  const setBoxProp = (key: string, value: unknown) => setProp(key, value);

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

const resolver = { Box, Text };

const App = () => {
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [viewMode, setViewMode] = useState<ViewMode>('constructor');

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
          <HistoryToolbar viewport={viewport} setViewport={setViewport} viewMode={viewMode} setViewMode={setViewMode} />
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
            <div style={isConstructor ? canvasWrapperStyle : previewWrapperStyle}>
              <Frame>
                <Element is={Box} canvas />
              </Frame>
            </div>
          </div>
        </div>
        {isConstructor && <SettingsPanel />}
      </Editor>
    </div>
  );
};

export default App;
