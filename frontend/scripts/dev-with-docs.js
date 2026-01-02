const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Docusaurus and Next.js...\n');

// Start Docusaurus
const docusaurus = spawn('npm', ['start'], {
  cwd: path.join(__dirname, '../docs'),
  stdio: 'inherit',
  shell: true,
});

// Wait a bit for Docusaurus to start, then start Next.js
setTimeout(() => {
  console.log('\n🚀 Starting Next.js...\n');
  const nextjs = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });

  nextjs.on('close', (code) => {
    console.log(`\nNext.js exited with code ${code}`);
    process.exit(code);
  });
}, 5000);

docusaurus.on('close', (code) => {
  console.log(`\nDocusaurus exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nShutting down servers...');
  docusaurus.kill();
  process.exit(0);
});


