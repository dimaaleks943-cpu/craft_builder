import React from 'react';
import { useEditor, Element } from '@craftjs/core';
import { Box } from '../editor/Box';
import { Block } from '../editor/Block';
import { Text } from '../editor/Text';

type PaletteItem = {
  label: string;
  element: React.ReactElement;
};

const paletteItems: PaletteItem[] = [
  { label: 'Контейнер', element: <Element is={Box} canvas /> },
  { label: 'Блок', element: <Element is={Block} canvas /> },
  { label: 'Текст', element: <Element is={Text} content="Текст" /> },
];

function PaletteItemRow({ item }: { item: PaletteItem }) {
  const { connectors } = useEditor();

  return (
    <div
      ref={(ref) => ref && connectors.create(ref, item.element)}
      className="flex cursor-grab items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm transition-shadow hover:shadow dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-neutral-500"
      style={{ userSelect: 'none' }}
    >
      <span className="text-neutral-600 dark:text-neutral-300">{item.label}</span>
    </div>
  );
}

export function ComponentsPanel() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Компоненты
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Перетащите на холст
        </p>
      </div>
      <div className="flex flex-col gap-2 overflow-auto p-3">
        {paletteItems.map((item) => (
          <PaletteItemRow key={item.label} item={item} />
        ))}
      </div>
    </aside>
  );
}
