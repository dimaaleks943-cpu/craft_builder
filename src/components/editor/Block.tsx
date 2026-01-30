import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';

type BlockProps = {
  children?: ReactNode;
  className?: string;
};

export function Block({ children, className }: BlockProps) {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      className={className ?? 'block min-h-[2rem]'}
    >
      {children}
    </div>
  );
}

Block.craft = {
  displayName: 'Блок',
};
