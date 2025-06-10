const express = require('express');
const path = require('path');

function createTestServer(port = 3000) {
  const app = express();
  
  // Serve static files from fixtures directory
  app.use(express.static(path.join(__dirname, 'fixtures')));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).send('Page not found');
  });
  
  const server = app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
  });
  
  return {
    app,
    server,
    close: () => new Promise((resolve) => server.close(resolve)),
    url: `http://localhost:${port}`
  };
}

// If run directly, start the server
if (require.main === module) {
  createTestServer();
}

module.exports = { createTestServer };