import React, { useState, useRef, useEffect, UIEvent } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight?: number | string;
  overscan?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight = 500,
  overscan = 5,
  className = '',
  keyExtractor
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof containerHeight === 'number' ? containerHeight : 500
  );

  useEffect(() => {
    if (containerRef.current) {
      const clientHeight = containerRef.current.clientHeight;
      if (clientHeight > 0) {
        setViewportHeight(clientHeight);
      }
    }
  }, [containerHeight]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = items.length * itemHeight;

  // Calculate visible index bounds
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, totalHeight - (endIndex + 1) * itemHeight);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto w-full relative ${className}`}
      style={{
        height: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight
      }}
    >
      <div style={{ height: `${paddingTop}px` }} />
      {visibleItems.map((item, idx) => {
        const actualIndex = startIndex + idx;
        const key = keyExtractor ? keyExtractor(item, actualIndex) : actualIndex;
        return (
          <React.Fragment key={key}>
            {renderItem(item, actualIndex)}
          </React.Fragment>
        );
      })}
      <div style={{ height: `${paddingBottom}px` }} />
    </div>
  );
}
