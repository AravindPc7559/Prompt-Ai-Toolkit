import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for fetching data with retry logic
 * @param {Function} fetchFn - Async function that returns the data
 * @param {Object} options - Options for the hook
 * @returns {Object} { data, loading, error, retry }
 */
export const useFetch = (fetchFn, options = {}) => {
  const {
    immediate = true,
    retries = 3,
    retryDelay = 1000,
    timeout = 10000
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Use ref to store the fetch function to prevent re-renders
  const fetchFnRef = useRef(fetchFn);
  const hasExecutedRef = useRef(false);
  
  // Update ref when fetchFn changes
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const executeRef = useRef(null);

  const execute = useCallback(async (retryAttempt = 0) => {
    try {
      setError(null);
      setLoading(true);

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      const responsePromise = fetchFnRef.current();
      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (response && response.success !== undefined ? response.success : true) {
        setData(response);
        setRetryCount(0);
        setLoading(false);
        return response;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = err.message || 'Failed to load data';

      // Retry logic
      if (retryAttempt < retries) {
        const delay = Math.pow(2, retryAttempt) * retryDelay;
        console.log(`Retrying in ${delay}ms... (attempt ${retryAttempt + 1}/${retries})`);
        setTimeout(() => {
          setRetryCount(retryAttempt + 1);
          // Use ref to avoid closure issues
          if (executeRef.current) {
            executeRef.current(retryAttempt + 1);
          }
        }, delay);
      } else {
        setError(errorMessage);
        setLoading(false);
      }
    }
  }, [retries, retryDelay, timeout]);

  // Update executeRef when execute changes
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  const retry = useCallback(() => {
    setRetryCount(0);
    hasExecutedRef.current = false;
    if (executeRef.current) {
      executeRef.current(0);
    }
  }, []);

  // Only execute once on mount if immediate is true
  useEffect(() => {
    if (immediate && !hasExecutedRef.current) {
      hasExecutedRef.current = true;
      executeRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return { data, loading, error, retry, retryCount };
};
