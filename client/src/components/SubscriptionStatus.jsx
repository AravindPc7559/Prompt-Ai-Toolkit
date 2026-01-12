import { memo } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import './SubscriptionStatus.css';

const SubscriptionStatus = ({ 
  isSubscribed, 
  subscriptionExpiresAt, 
  freeTrialsRemaining,
  requiresSubscription 
}) => {
  if (isSubscribed) {
    return (
      <div className="subscription-status subscribed">
        <div className="status-icon">✓</div>
        <div className="status-content">
          <h3>Active Subscription</h3>
          <p>You have unlimited access to all features</p>
          {subscriptionExpiresAt && (
            <p className="expiry-date">
              Expires: {new Date(subscriptionExpiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-status trial">
      <div className="status-icon">🎁</div>
      <div className="status-content">
        <h3>Free Trial</h3>
        <p className="trial-count">
          {freeTrialsRemaining} of 10 free trials remaining
        </p>
        <div className="trial-progress">
          <div 
            className="trial-progress-bar" 
            style={{ width: `${(freeTrialsRemaining / 10) * 100}%` }}
          ></div>
        </div>
        {requiresSubscription && (
          <p className="trial-exhausted">
            Free trial exhausted. Subscribe to continue using the service.
          </p>
        )}
      </div>
      <Link to="/pricing" style={{ marginTop: '20px', width: '100%', display: 'block', textDecoration: 'none' }}>
        <Button variant="primary" style={{ width: '100%' }}>
          {requiresSubscription ? 'Subscribe Now' : 'View Pricing'}
        </Button>
      </Link>
    </div>
  );
};

export default memo(SubscriptionStatus);
