import { memo, forwardRef } from 'react';
import './Textarea.css';

const Textarea = forwardRef(({ 
  placeholder,
  value,
  onChange,
  disabled = false,
  rows = 4,
  className = '',
  ...props 
}, ref) => {
  return (
    <textarea
      ref={ref}
      className={`form-textarea ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      rows={rows}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export default memo(Textarea);
