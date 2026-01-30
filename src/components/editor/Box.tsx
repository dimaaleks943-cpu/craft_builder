import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';

type BoxProps = {
  children?: ReactNode;
  className?: string;
};

export function Box({ children, className }: BoxProps) {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div ref={(ref) => ref && connect(drag(ref))} className={className ?? 'min-h-[200px]'}>
      {children}
    </div>
  );
}

Box.craft = {
  displayName: 'Контейнер',
};
