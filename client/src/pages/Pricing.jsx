import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { paymentAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Alert from '../components/Alert';
import './Pricing.css';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const handleGetStarted = async () => {
    try {
      setLoading(true);
      setError(null);

      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        setError('Failed to load Razorpay. Please try again.');
        setLoading(false);
        return;
      }

      const orderData = await paymentAPI.createOrder(130, 'monthly');
      
      if (!orderData.success) {
        setError(orderData.error || 'Failed to create order');
        setLoading(false);
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Prompt AI Toolkit',
        description: 'Monthly Subscription',
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            const verificationData = await paymentAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verificationData.success) {
              sessionStorage.setItem('paymentSuccess', JSON.stringify({
                amount: verificationData.amount || 130,
                paymentId: verificationData.paymentId,
                orderId: verificationData.orderId,
                subscriptionExpiresAt: verificationData.subscriptionExpiresAt
              }));
              
              navigate('/payment-success');
            } else {
              setError(verificationData.error || 'Payment verification failed');
            }
          } catch (err) {
            console.error('Payment verification error:', err);
            setError('Payment verification failed. Please contact support.');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: ''
        },
        theme: {
          color: '#6366f1'
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      
      razorpay.open();
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.error || 'Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  const features = [
    'Unlimited prompt rewriting',
    'Grammar correction',
    'Email formatting',
    'Browser extension access',
    'Priority support'
  ];

  return (
    <div className="pricing-container">
      <Navigation activePage="pricing" />

      <div className="pricing-content">
        <PageHeader 
          title="Simple, Transparent Pricing"
          subtitle="Choose the plan that works best for you"
        />

        <div className="pricing-card">
          <div className="pricing-badge">Most Popular</div>
          <div className="pricing-title">Monthly Plan</div>
          <div className="pricing-price">
            <span className="currency">₹</span>
            <span className="amount">130</span>
            <span className="period">/month</span>
          </div>
          <div className="pricing-features">
            {features.map((feature, index) => (
              <div key={index} className="feature-item">
                <span className="feature-icon">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          {error && <Alert type="error" message={error} />}
          <Button 
            variant="primary"
            onClick={handleGetStarted}
            disabled={loading}
            loading={loading}
            className="pricing-button"
          >
            Get Started
          </Button>
        </div>

        <div className="pricing-footer">
          <p>All plans include a 7-day money-back guarantee</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
