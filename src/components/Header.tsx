type ViewMode = 'constructor' | 'preview';

type HeaderProps = {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
};

export function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="flex items-center gap-1 border-b border-neutral-200 bg-white px-4 py-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <span className="mr-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Режим:
      </span>
      <nav className="flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'constructor'}
          onClick={() => onModeChange('constructor')}
          className={
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
            (mode === 'constructor'
              ? 'bg-white text-neutral-900 shadow dark:bg-neutral-700 dark:text-white'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white')
          }
        >
          Конструктор
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          onClick={() => onModeChange('preview')}
          className={
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
            (mode === 'preview'
              ? 'bg-white text-neutral-900 shadow dark:bg-neutral-700 dark:text-white'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white')
          }
        >
          Превью
        </button>
      </nav>
    </header>
  );
}
