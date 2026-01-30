import { useNode } from '@craftjs/core';

type TextProps = {
  content?: string;
  tag?: 'span' | 'p' | 'h1' | 'h2' | 'h3';
  className?: string;
};

const defaultContent = 'Текст';

export function Text({ content = defaultContent, tag: Tag = 'p', className }: TextProps) {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <Tag
      ref={(ref) => ref && connect(drag(ref))}
      className={className ?? 'text-base text-neutral-800 dark:text-neutral-200'}
    >
      {content}
    </Tag>
  );
}

Text.craft = {
  displayName: 'Текст',
  props: {
    content: defaultContent,
    tag: 'p',
  },
};
