const path = require('path');
const { spawn } = require('child_process');

let workerProcess = null;
let workerReady = null;
let requestQueue = Promise.resolve();

function startWorker() {
  if (workerReady) {
    return workerReady;
  }

  workerReady = new Promise((resolve, reject) => {
    const pythonCommand = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, '..', 'python', 'transcribe.py');

    workerProcess = spawn(pythonCommand, [scriptPath, '--stdio-server'], {
      cwd: path.join(__dirname, '..')
    });

    let stdoutBuffer = '';
    let isResolved = false;

    workerProcess.stdout.setEncoding('utf8');
    workerProcess.stderr.setEncoding('utf8');

    workerProcess.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;

      let newlineIndex = stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

        if (!line) {
          newlineIndex = stdoutBuffer.indexOf('\n');
          continue;
        }

        try {
          const parsed = JSON.parse(line);
          if (!isResolved && parsed && parsed.ready) {
            isResolved = true;
            resolve();
          }
        } catch (_error) {
          // Ignore until request-specific listener attaches.
        }

        newlineIndex = stdoutBuffer.indexOf('\n');
      }
    });

    workerProcess.stderr.on('data', (chunk) => {
      const message = String(chunk || '').trim();
      if (!isResolved && message) {
        reject(new Error(message));
      }
    });

    workerProcess.on('error', (error) => {
      if (!isResolved) {
        reject(error);
      }
      workerProcess = null;
      workerReady = null;
    });

    workerProcess.on('exit', (code) => {
      if (!isResolved) {
        reject(new Error(`Transcription worker exited with code ${code}`));
      }
      workerProcess = null;
      workerReady = null;
    });
  });

  return workerReady;
}

function transcribeWithWorker(audioPath) {
  requestQueue = requestQueue.then(async () => {
    await startWorker();

    return new Promise((resolve, reject) => {
      if (!workerProcess) {
        reject(new Error('Transcription worker is not available.'));
        return;
      }

      let stdoutBuffer = '';

      const onStdout = (chunk) => {
        stdoutBuffer += chunk;
        const newlineIndex = stdoutBuffer.indexOf('\n');
        if (newlineIndex === -1) return;

        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        cleanup();

        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.error) {
            reject(new Error(parsed.error));
            return;
          }
          resolve(parsed);
        } catch (_error) {
          reject(new Error('Transcription worker returned invalid JSON.'));
        }
      };

      const onStderr = (chunk) => {
        cleanup();
        reject(new Error(String(chunk || '').trim() || 'Transcription worker failed.'));
      };

      const onExit = () => {
        cleanup();
        reject(new Error('Transcription worker stopped unexpectedly.'));
      };

      function cleanup() {
        if (!workerProcess) return;
        workerProcess.stdout.off('data', onStdout);
        workerProcess.stderr.off('data', onStderr);
        workerProcess.off('exit', onExit);
      }

      workerProcess.stdout.on('data', onStdout);
      workerProcess.stderr.on('data', onStderr);
      workerProcess.on('exit', onExit);
      workerProcess.stdin.write(`${JSON.stringify({ audio_path: audioPath })}\n`);
    });
  });

  return requestQueue;
}

module.exports = {
  transcribeWithWorker
};
