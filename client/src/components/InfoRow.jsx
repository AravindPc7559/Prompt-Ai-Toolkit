import { memo } from 'react';
import './InfoRow.css';

const InfoRow = ({ label, value, className = '' }) => {
  return (
    <div className={`info-row ${className}`}>
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
};

export default memo(InfoRow);
