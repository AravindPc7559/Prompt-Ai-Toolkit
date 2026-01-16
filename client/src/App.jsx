import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/Loading';
import './App.css';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Contact = lazy(() => import('./pages/Contact'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthError = () => {
      navigate('/login');
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [navigate]);

  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <Loading text="Loading..." size="large" />
      </div>
    }>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <Pricing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contact"
          element={
            <ProtectedRoute>
              <Contact />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-success"
          element={
            <ProtectedRoute>
              <PaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
