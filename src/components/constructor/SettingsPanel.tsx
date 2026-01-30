import { useEditor } from '@craftjs/core';

export function SettingsPanel() {
  const { selectedId, query } = useEditor((_state, query) => ({
    selectedId: query.getEvent('selected').first(),
  }));

  const node = selectedId ? query.node(selectedId).get() : null;
  const displayName = node?.data?.displayName ?? null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Настройки
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Стили, свойства и логика
        </p>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {!selectedId ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center dark:border-neutral-600 dark:bg-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Выберите элемент на холсте, чтобы редактировать его свойства
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Компонент
              </label>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {displayName ?? 'Элемент'}
              </p>
            </div>
            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Панель стилей и свойств будет здесь
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
