import { memo } from 'react';
import './Alert.css';

const Alert = ({ type = 'info', message, children, className = '', onClose }) => {
  return (
    <div className={`alert alert-${type} ${className}`}>
      {onClose && (
        <button className="alert-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}
      {message || children}
    </div>
  );
};

export default memo(Alert);
