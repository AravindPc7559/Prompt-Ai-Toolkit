import { memo } from 'react';
import Button from './Button';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  itemsPerPage,
  totalItems 
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-controls">
      <Button
        variant="secondary"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="pagination-button"
      >
        ← Previous
      </Button>
      <span className="pagination-info">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="secondary"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="pagination-button"
      >
        Next →
      </Button>
    </div>
  );
};

export default memo(Pagination);
