import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import confetti from 'canvas-confetti';
import Navigation from '../components/Navigation';
import Card from '../components/Card';
import InfoRow from '../components/InfoRow';
import Button from '../components/Button';
import { formatDate } from '../utils/dateUtils';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const paymentInfo = sessionStorage.getItem('paymentSuccess');
    
    if (paymentInfo) {
      try {
        const data = JSON.parse(paymentInfo);
        setPaymentData(data);
        setIsValid(true);
        
        triggerConfetti();
        
        setTimeout(() => {
          sessionStorage.removeItem('paymentSuccess');
        }, 5000);
      } catch (e) {
        console.error('Error parsing payment data:', e);
        navigate('/dashboard');
      }
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
      });

      confetti({
        particleCount: 2,
        angle: 90,
        spread: 45,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
      });
    }, 100);

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
      });
    }, 500);
  };

  const handleGoToDashboard = () => {
    sessionStorage.removeItem('paymentSuccess');
    navigate('/dashboard');
  };

  if (!isValid || !paymentData) {
    return (
      <div className="payment-success-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="payment-success-container">
      <Navigation activePage="pricing" />

      <div className="success-content">
        <div className="success-icon-container">
          <div className="success-icon">
            <svg viewBox="0 0 100 100" className="checkmark">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#10b981" strokeWidth="4" />
              <path
                d="M30 50 L45 65 L70 35"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <h1 className="success-title">Payment Successful!</h1>
        <p className="success-message">
          Your subscription has been activated successfully. You now have unlimited access to all features!
        </p>

        <Card className="payment-details-card" header="Payment Details">
          <InfoRow label="Amount Paid:" value={`₹${paymentData.amount || 130}`} />
          <InfoRow label="Payment ID:" value={paymentData.paymentId || 'N/A'} />
          <InfoRow label="Order ID:" value={paymentData.orderId || 'N/A'} />
          {paymentData.subscriptionExpiresAt && (
            <InfoRow
              label="Subscription Expires:"
              value={formatDate(paymentData.subscriptionExpiresAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            />
          )}
        </Card>

        <div className="success-actions">
          <Button variant="primary" onClick={handleGoToDashboard}>
            Go to Dashboard
          </Button>
          <Link to="/pricing">
            <Button variant="secondary">View Plans</Button>
          </Link>
        </div>

        <div className="celebration-text">
          <span className="emoji">🎉</span>
          <span>Thank you for your purchase!</span>
          <span className="emoji">🎉</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
