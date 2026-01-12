import { memo, forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({ 
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  className = '',
  ...props 
}, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={`form-input ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default memo(Input);
