import { memo } from 'react';
import './FeatureCard.css';

const FeatureCard = ({ icon, title, description, className = '' }) => {
  return (
    <div className={`feature-card ${className}`}>
      <div className="feature-icon">{icon}</div>
      <div className="feature-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default memo(FeatureCard);
