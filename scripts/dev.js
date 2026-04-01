const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const backendDir = path.join(projectRoot, 'backend');
const backendPort = 5000;
const frontendPreferredPort = 5500;
const host = '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.mpeg': 'audio/mpeg'
};

let backendProcess = null;
let frontendServer = null;
let shuttingDown = false;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (error) => {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
          resolve(true);
          return;
        }
        resolve(false);
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (await isPortInUse(port)) {
    port += 1;
  }
  return port;
}

function serveStaticFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Internal server error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream'
    });
    response.end(content);
  });
}

function createFrontendServer(port) {
  frontendServer = http.createServer((request, response) => {
    const requestPath = (request.url || '/').split('?')[0];
    const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
    const safeRelativePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(projectRoot, safeRelativePath);

    if (!filePath.startsWith(projectRoot)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (!error && stats.isFile()) {
        serveStaticFile(filePath, response);
        return;
      }

      if (!error && stats.isDirectory()) {
        serveStaticFile(path.join(filePath, 'index.html'), response);
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
  });

  return new Promise((resolve, reject) => {
    frontendServer.once('error', reject);
    frontendServer.listen(port, host, () => resolve());
  });
}

function startBackendIfNeeded() {
  return isPortInUse(backendPort).then((inUse) => {
    if (inUse) {
      console.log(`[backend] already running at http://${host}:${backendPort}`);
      return;
    }

    console.log('[backend] starting server...');
    backendProcess = spawn('node', ['server.js'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: false
    });

    backendProcess.on('exit', (code, signal) => {
      backendProcess = null;
      if (!shuttingDown) {
        console.log(`[backend] stopped (code: ${code ?? 'null'}, signal: ${signal ?? 'none'})`);
      }
    });
  });
}

async function start() {
  await startBackendIfNeeded();

  const frontendPort = await findAvailablePort(frontendPreferredPort);
  await createFrontendServer(frontendPort);

  console.log(`[frontend] running at http://${host}:${frontendPort}`);
  console.log('');
  console.log('MediAssist launch links:');
  console.log(`  Home:    http://${host}:${frontendPort}/`);
  console.log(`  Patient: http://${host}:${frontendPort}/patient.html`);
  console.log(`  Staff:   http://${host}:${frontendPort}/staff.html`);
  console.log(`  Vitals:  http://${host}:${frontendPort}/vital.html`);
  console.log(`  Doctor:  http://${host}:${frontendPort}/doctor.html`);
  console.log('');
  console.log('Voice transcription uses the backend on port 5000 and will start from these pages automatically.');
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  const finish = () => process.exit(0);

  if (frontendServer) {
    frontendServer.close(() => {
      if (backendProcess) {
        backendProcess.kill();
        setTimeout(finish, 250);
      } else {
        finish();
      }
    });
    return;
  }

  if (backendProcess) {
    backendProcess.kill();
    setTimeout(finish, 250);
    return;
  }

  finish();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  console.error('Unable to start MediAssist:', error.message);
  process.exit(1);
});
