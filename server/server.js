import app from './app.js';
import { config } from './config/app.js';
import { connectDB } from './config/database.js';

const PORT = config.port;

// Connect to MongoDB before starting server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Prompt Rewriter Server running on http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
