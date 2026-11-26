const { spawn } = require('node:child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://localhost:5180',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
