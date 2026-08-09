const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src');
const output = path.join(projectRoot, 'dist');
const clientOutput = path.join(output, 'client');
const serverOutput = path.join(output, 'server');

if (!output.startsWith(`${projectRoot}${path.sep}`)) throw new Error('Unsafe build output path');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(clientOutput, { recursive: true });
fs.mkdirSync(serverOutput, { recursive: true });
fs.cpSync(source, clientOutput, { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'site', 'worker.js'), path.join(serverOutput, 'index.js'));
fs.copyFileSync(path.join(projectRoot, 'site', 'package.json'), path.join(serverOutput, 'package.json'));

for (const required of ['index.html', 'manifest.webmanifest', 'service-worker.js', 'platform.js', 'icons/icon-192.png', 'icons/icon-512.png']) {
  if (!fs.existsSync(path.join(clientOutput, required))) throw new Error(`Missing PWA file: ${required}`);
}

console.log(`PWA build ready: ${output}`);
