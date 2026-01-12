import { memo } from 'react';
import './FormGroup.css';

const FormGroup = ({ 
  label, 
  children, 
  error, 
  required = false,
  className = '',
  charCount,
  maxLength
}) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {children}
      {charCount !== undefined && maxLength && (
        <div className="char-count">
          {charCount} / {maxLength} characters
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
};

export default memo(FormGroup);
