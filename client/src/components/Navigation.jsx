import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

const Navigation = ({ activePage = 'dashboard' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <img src="/assets/pnglogo.png" alt="Prompt AI Toolkit" className="nav-logo" />
        <h2>Prompt AI Toolkit</h2>
      </div>
      <div className="nav-links">
        <Link 
          to="/dashboard" 
          className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link 
          to="/pricing" 
          className={`nav-link ${activePage === 'pricing' ? 'active' : ''}`}
        >
          Pricing
        </Link>
        <Link 
          to="/contact" 
          className={`nav-link ${activePage === 'contact' ? 'active' : ''}`}
        >
          Contact Us
        </Link>
      </div>
      <div className="nav-user">
        <span className="user-email">{user?.email}</span>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
