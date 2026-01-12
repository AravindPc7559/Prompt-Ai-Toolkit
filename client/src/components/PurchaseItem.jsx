import { memo } from 'react';
import StatusBadge from './StatusBadge';
import InfoRow from './InfoRow';
import { formatDate } from '../utils/dateUtils';
import './PurchaseItem.css';

const PurchaseItem = ({ payment }) => {
  return (
    <div className="purchase-item">
      <div className="purchase-header">
        <div className="purchase-icon">💳</div>
        <div className="purchase-info">
          <h3>Monthly Subscription</h3>
          <p className="purchase-date">
            {formatDate(payment.createdAt, { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="purchase-amount">
          ₹{payment.amount}
        </div>
      </div>
      <div className="purchase-details">
        <InfoRow 
          label="Payment ID:" 
          value={payment.razorpayPaymentId || 'N/A'} 
        />
        <InfoRow label="Order ID:" value={payment.razorpayOrderId} />
        {payment.subscriptionExpiresAt && (
          <InfoRow
            label="Subscription Expires:"
            value={formatDate(payment.subscriptionExpiresAt, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          />
        )}
        <div className="info-row">
          <span className="info-label">Status:</span>
          <StatusBadge status={payment.status === 'paid' ? 'completed' : payment.status} />
        </div>
      </div>
    </div>
  );
};

export default memo(PurchaseItem);
