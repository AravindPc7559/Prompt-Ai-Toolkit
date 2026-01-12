import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contactAPI } from '../services/api';
import Navigation from '../components/Navigation';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import FormGroup from '../components/FormGroup';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils/dateUtils';
import './Contact.css';

const Contact = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [contactHistory, setContactHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchContactHistory = useCallback(async () => {
    try {
      const response = await contactAPI.getContactHistory();
      if (response.success) {
        setContactHistory(response.contacts || []);
      }
    } catch (err) {
      console.error('Error fetching contact history:', err);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters long');
      return;
    }

    try {
      setLoading(true);
      const response = await contactAPI.submitContact(subject.trim(), message.trim());
      
      if (response.success) {
        setSuccess(true);
        setSubject('');
        setMessage('');
        fetchContactHistory();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(response.error || 'Failed to submit message. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting contact form:', err);
      setError(err.response?.data?.error || 'Failed to submit message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowHistory = () => {
    if (!showHistory) {
      fetchContactHistory();
    }
    setShowHistory(!showHistory);
  };

  const contactInfo = [
    { icon: '📧', title: 'Email', text: 'support@promptaitoolkit.com' },
    { icon: '⏰', title: 'Response Time', text: 'We typically respond within 24-48 hours' },
    { icon: '💬', title: 'Support', text: 'For technical issues, please include as much detail as possible' }
  ];

  return (
    <div className="contact-container">
      <Navigation activePage="contact" />

      <div className="contact-content">
        <PageHeader 
          title="Contact Us"
          subtitle="Have a question or need help? We're here to assist you!"
        />

        <div className="contact-grid">
          <Card className="form-card" header="Send us a Message">
            <form onSubmit={handleSubmit} className="contact-form">
              {error && <Alert type="error" message={error} />}
              {success && (
                <Alert type="success" message="Your message has been submitted successfully. We will get back to you soon." />
              )}

              <FormGroup label="Subject" required>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this regarding?"
                  maxLength={200}
                  disabled={loading}
                />
              </FormGroup>

              <FormGroup 
                label="Message" 
                required
                charCount={message.length}
                maxLength={2000}
              >
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your issue or question in detail..."
                  rows={8}
                  maxLength={2000}
                  disabled={loading}
                />
              </FormGroup>

              <Button 
                type="submit"
                variant="submit"
                disabled={loading || !subject.trim() || !message.trim()}
                loading={loading}
              >
                Submit Message
              </Button>
            </form>
          </Card>

          <Card className="info-card" header="Contact Information">
            <div className="info-content">
              {contactInfo.map((info, index) => (
                <div key={index} className="info-item">
                  <div className="info-icon">{info.icon}</div>
                  <div className="info-text">
                    <h3>{info.title}</h3>
                    <p>{info.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="history-section">
              <Button variant="secondary" onClick={handleShowHistory} className="history-toggle">
                {showHistory ? 'Hide' : 'Show'} Message History
              </Button>

              {showHistory && (
                <div className="history-list">
                  {contactHistory.length === 0 ? (
                    <p className="no-history">No previous messages</p>
                  ) : (
                    contactHistory.map((contact, index) => (
                      <div key={index} className="history-item">
                        <div className="history-header">
                          <h4>{contact.subject}</h4>
                          <StatusBadge status={contact.status} />
                        </div>
                        <p className="history-message">{contact.message}</p>
                        <p className="history-date">
                          Submitted: {formatDateTime(contact.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Contact;
