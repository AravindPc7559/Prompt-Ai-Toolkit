import { memo } from 'react';
import './StatusBadge.css';

const STATUS_MAP = {
  new: { text: 'New', class: 'status-new' },
  in_progress: { text: 'In Progress', class: 'status-in-progress' },
  resolved: { text: 'Resolved', class: 'status-resolved' },
  closed: { text: 'Closed', class: 'status-closed' },
  completed: { text: 'Completed', class: 'status-completed' },
  paid: { text: 'Paid', class: 'status-paid' },
  failed: { text: 'Failed', class: 'status-failed' },
};

const StatusBadge = ({ status, className = '' }) => {
  const statusInfo = STATUS_MAP[status] || { text: status, class: 'status-default' };
  
  return (
    <span className={`status-badge ${statusInfo.class} ${className}`}>
      {statusInfo.text}
    </span>
  );
};

export default memo(StatusBadge);
