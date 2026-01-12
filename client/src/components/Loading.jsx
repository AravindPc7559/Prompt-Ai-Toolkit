import { memo } from 'react';
import './Loading.css';

const Loading = ({ text = 'Loading...', size = 'medium', className = '' }) => {
  return (
    <div className={`loading-container ${className}`}>
      <div className={`loading-spinner loading-spinner-${size}`}></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default memo(Loading);
