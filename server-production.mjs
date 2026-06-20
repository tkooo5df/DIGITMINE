import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const port = parseInt(process.env.PORT || '3000', 10);
const nodeEnv = process.env.NODE_ENV || 'production';

// Static files directory
const clientDir = join(process.cwd(), 'dist', 'client');
const publicDir = join(process.cwd(), 'public');

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// Read the built server module
const serverModulePath = join(process.cwd(), 'dist', 'server', 'server.js');
let serverEntry;

async function loadServerEntry() {
  try {
    // Dynamic import the server module
    const module = await import(serverModulePath);
    serverEntry = module.default || module;
    console.log('✅ Server entry loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load server entry:', error.message);
    throw error;
  }
}

// Serve static files
function serveStaticFile(req, res) {
  // First, try to serve from public directory (for product images, etc.)
  const publicPath = join(publicDir, req.url);
  if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    const ext = extname(publicPath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const fileContent = readFileSync(publicPath);
    res.writeHead(200);
    res.end(fileContent);
    return true;
  }
  
  // Then, try to serve from dist/client (for built assets)
  const clientPath = join(clientDir, req.url);
  if (existsSync(clientPath) && statSync(clientPath).isFile()) {
    const ext = extname(clientPath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const cacheControl = (ext === '.js' || ext === '.css') 
      ? 'public, max-age=31536000, immutable' 
      : 'public, max-age=86400';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    const fileContent = readFileSync(clientPath);
    res.writeHead(200);
    res.end(fileContent);
    return true;
  }
  
  return false; // File doesn't exist, let SSR handle it
}

// Convert Node.js IncomingMessage to Web API Request
function nodeRequestToWebRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;
  
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  return new Request(url, {
    method: req.method || 'GET',
    headers: headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

// Convert Web API Response to Node.js ServerResponse
async function webResponseToNodeResponse(webResponse, res) {
  // Set status
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  // Set headers
  for (const [key, value] of webResponse.headers.entries()) {
    res.setHeader(key, value);
  }

  // Send body
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  res.end();
}

// Create HTTP server
const server = createServer(async (req, res) => {
  try {
    // First, try to serve static files
    if (req.method === 'GET' && serveStaticFile(req, res)) {
      return; // Static file served
    }
    
    // Ensure server entry is loaded
    if (!serverEntry) {
      await loadServerEntry();
    }

    // Convert Node.js request to Web API Request
    const webRequest = nodeRequestToWebRequest(req);

    // Create mock context for Cloudflare Workers compatibility
    const ctx = {
      waitUntil: (promise) => {
        promise.catch((error) => {
          console.error('Unhandled promise rejection:', error);
        });
      },
      passThroughOnException: () => {},
    };

    // Mock environment (empty for now, can add Supabase keys etc later)
    const env = {
      // Pass through environment variables for Supabase
      SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
      SESSION_SECRET: process.env.SESSION_SECRET || '',
      NODE_ENV: process.env.NODE_ENV || 'production',
    };

    // Handle the request
    const webResponse = await serverEntry.fetch(webRequest, env, ctx);
    
    // Convert Web API Response to Node.js Response
    await webResponseToNodeResponse(webResponse, res);
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

// Start server
server.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📍 Environment: ${nodeEnv}`);
  
  // Preload server entry
  try {
    await loadServerEntry();
  } catch (error) {
    console.error('Failed to preload server entry:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
