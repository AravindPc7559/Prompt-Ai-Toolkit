import express from 'express';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Prompt Rewriter Server is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
