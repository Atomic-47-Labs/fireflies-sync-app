import React from 'react';
import { cn } from '../../lib/utils';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, indeterminate, ...props }, ref) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    React.useImperativeHandle(ref, () => checkboxRef.current!);

    return (
      <label className={cn('flex items-center gap-2 cursor-pointer', className)}>
        <input
          type="checkbox"
          ref={checkboxRef}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          {...props}
        />
        {label && <span className="text-sm text-gray-700 select-none">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';


