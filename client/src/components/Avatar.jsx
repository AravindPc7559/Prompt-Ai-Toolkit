import { memo } from 'react';
import './Avatar.css';

const Avatar = ({ name, email, size = 'medium', className = '' }) => {
  const initial = (name || email || 'U').charAt(0).toUpperCase();
  
  return (
    <div className={`avatar avatar-${size} ${className}`}>
      {initial}
    </div>
  );
};

export default memo(Avatar);
