import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import Navigation from '../components/Navigation';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Avatar from '../components/Avatar';
import InfoRow from '../components/InfoRow';
import FeatureCard from '../components/FeatureCard';
import SubscriptionStatus from '../components/SubscriptionStatus';
import PurchaseItem from '../components/PurchaseItem';
import Pagination from '../components/Pagination';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Button from '../components/Button';
import { useFetch } from '../hooks/useFetch';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Memoize the fetch function to prevent recreating it on every render
  const fetchUsageInfo = useCallback(() => {
    return userAPI.getUsage();
  }, []);

  const { data: usageInfo, loading, error, retry, retryCount } = useFetch(
    fetchUsageInfo,
    { retries: 3, retryDelay: 1000, timeout: 10000 }
  );

  useEffect(() => {
    if (usageInfo) {
      setCurrentPage(1);
    }
  }, [usageInfo]);

  const currentPayments = useMemo(() => {
    if (!usageInfo?.payments) return [];
    return usageInfo.payments.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [usageInfo?.payments, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil((usageInfo?.payments?.length || 0) / itemsPerPage);
  }, [usageInfo?.payments?.length, itemsPerPage]);

  const features = [
    { icon: '✨', title: 'Prompt Rewriting', description: 'Enhance your prompts with AI-powered rewriting' },
    { icon: '✏️', title: 'Grammar Check', description: 'Improve your text with advanced grammar correction' },
    { icon: '📧', title: 'Email Formatter', description: 'Format content into professional emails' }
  ];

  return (
    <div className="dashboard-container">
      <Navigation activePage="dashboard" />

      <div className="dashboard-content">
        <PageHeader 
          title={`Welcome back, ${user?.name || 'User'}!`}
          subtitle="Manage your account and access all features"
        />

        <div className="dashboard-grid">
          <Card 
            className="profile-card"
            header="Profile"
            headerIcon={<Avatar name={user?.name} email={user?.email} size="medium" />}
          >
            <InfoRow label="Name" value={user?.name || 'Not set'} />
            <InfoRow label="Email" value={user?.email || 'N/A'} />
          </Card>

          <Card className="features-card" header="Features">
            <div className="features-list">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </Card>

          <Card 
            className="usage-card"
            header="Usage & Subscription"
            headerAction={
              retryCount > 0 && (
                <span className="retry-indicator">Retrying... ({retryCount}/3)</span>
              )
            }
          >
            {loading ? (
              <Loading text={retryCount > 0 ? `Loading... (Retry ${retryCount}/3)` : 'Loading...'} />
            ) : error ? (
              <div className="error-container">
                <Alert type="error" message={error} />
                <Button variant="secondary" onClick={retry} style={{ marginTop: '10px' }}>
                  Retry
                </Button>
              </div>
            ) : usageInfo ? (
              <>
                <SubscriptionStatus
                  isSubscribed={usageInfo.user?.isSubscribed}
                  subscriptionExpiresAt={usageInfo.user?.subscriptionExpiresAt}
                  freeTrialsRemaining={usageInfo.user?.freeTrialsRemaining || 0}
                  requiresSubscription={usageInfo.usage?.requiresSubscription}
                />
              </>
            ) : null}
          </Card>

          {loading && !usageInfo ? (
            <Card className="purchase-card" header="Purchase History">
              <Loading text="Loading purchase history..." />
            </Card>
          ) : error && !usageInfo?.payments ? (
            <Card className="purchase-card" header="Purchase History">
              <Alert type="error" message={error} />
              <Button variant="secondary" onClick={retry} style={{ marginTop: '10px' }}>
                Retry
              </Button>
            </Card>
          ) : usageInfo?.payments && usageInfo.payments.length > 0 ? (
            <Card 
              className="purchase-history-card"
              header="Purchase History"
              headerAction={
                <span className="purchase-count">
                  ({usageInfo.payments.length} {usageInfo.payments.length === 1 ? 'payment' : 'payments'})
                </span>
              }
            >
              <div className="purchase-list">
                {currentPayments.map((payment, index) => (
                  <PurchaseItem key={payment._id || index} payment={payment} />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={usageInfo.payments.length}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
