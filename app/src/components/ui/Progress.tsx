import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

export function Progress({ 
  value, 
  showLabel = false, 
  size = 'md', 
  variant = 'primary',
  className,
  ...props 
}: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const colors = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('h-full transition-all duration-300 ease-out', colors[variant])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-gray-600 text-right">
          {clampedValue.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

