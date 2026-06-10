import React from 'react';
import { Star } from 'lucide-react';

interface RatingProps {
  value: number;      // 0-5
  max?: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}

export const Rating: React.FC<RatingProps> = ({
  value,
  max = 5,
  size = 16,
  showValue = false,
  count,
  interactive = false,
  onChange,
}) => {
  const [hovered, setHovered] = React.useState(0);
  const display = hovered || value;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: max }).map((_, i) => {
          const filled = i + 1 <= display;
          const half = !filled && i + 0.5 < display;
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onChange?.(i + 1)}
              onMouseEnter={() => interactive && setHovered(i + 1)}
              onMouseLeave={() => interactive && setHovered(0)}
              className={`${interactive ? 'cursor-pointer' : 'cursor-default'} p-0.5`}
            >
              <Star
                size={size}
                className={
                  filled ? 'text-gold fill-gold' :
                  half ? 'text-gold fill-gold/50' :
                  'text-gray-300 fill-gray-100'
                }
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-gray-700 ml-1">
          {value.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-sm text-gray-500">({count.toLocaleString('en-IN')})</span>
      )}
    </div>
  );
};
