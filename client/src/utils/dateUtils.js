/**
 * Format a date with given options
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return dateObj.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format a date with time
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string with time
 */
export const formatDateTime = (date) => {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
