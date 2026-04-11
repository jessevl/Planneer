import { useCallback } from 'react';
import { EDITOR_COLORS } from '@/lib/editorColors';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import type { BackgroundColor } from '../types';

type ColorPickerProps = {
  selectedColor: BackgroundColor;
  onColorSelect: (color: BackgroundColor) => void;
  label?: string;
};

const ColorPicker = ({ selectedColor, onColorSelect, label }: ColorPickerProps) => {
  const isDark = useIsDarkMode();

  const handleColorClick = useCallback(
    (colorName: string | null) => {
      onColorSelect(colorName);
    },
    [onColorSelect]
  );

  return (
    <div className="yoopta-advanced-table-color-picker">
      {label && <div className="yoopta-advanced-table-color-picker-label">{label}</div>}
      
      <button
        type="button"
        className="yoopta-advanced-table-color-clear-button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleColorClick(null);
        }}
      >
        Clear color
      </button>

      <div className="yoopta-advanced-table-color-picker-grid">
        {EDITOR_COLORS.map((color) => {
          const bgColor = isDark ? color.bgDark : color.bgLight;
          return (
            <button
              key={color.name}
              type="button"
              className={`yoopta-advanced-table-color-swatch ${
                selectedColor === color.name ? 'yoopta-advanced-table-color-swatch-selected' : ''
              }`}
              style={{ backgroundColor: bgColor }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleColorClick(color.name);
              }}
              title={color.name}
            >
              {selectedColor === color.name && (
                <svg
                  className="yoopta-advanced-table-color-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { ColorPicker };
