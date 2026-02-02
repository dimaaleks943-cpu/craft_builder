import { createContext } from 'react';

/** Режим редактора: true = конструктор (редактирование), false = превью (просмотр) */
export const EditorModeContext = createContext<boolean>(true);
