import { useRef } from 'react';

type ResizeHandleProps = {
  onResize: (width: number) => void;
  tdWidth: number;
  columnIndex: number;
};

/**
 * Column resize handle
 * Uses React event handler directly instead of useEffect to avoid stale closures.
 * Uses refs for tracking start position to avoid dependency on props during drag.
 */
const ResizeHandle = ({ onResize, tdWidth }: ResizeHandleProps) => {
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Capture current values at drag start
    startX.current = e.clientX;
    startWidth.current = tdWidth;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + deltaX);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="yoopta-advanced-table-resize-handle"
      contentEditable={false}
      onMouseDown={handleMouseDown}
    >
      <div className="yoopta-advanced-table-resize-handle-inner" />
    </div>
  );
};

export { ResizeHandle };
