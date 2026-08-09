const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

test('desktop shell runs as a tray utility', () => {
  const main = fs.readFileSync(path.join(projectRoot, 'main.js'), 'utf8');
  assert.match(main, /Menu, nativeImage, screen, shell, Tray/);
  assert.match(main, /skipTaskbar: true/);
  assert.match(main, /tray\.on\('click', toggleWindow\)/);
  assert.match(main, /ipcMain\.handle\('window:minimize', hideWindow\)/);
  assert.match(main, /ipcMain\.handle\('window:close', hideWindow\)/);
  assert.match(main, /args = \['--hidden'\]/);
  assert.match(main, /if \(initialStore\.settings\.launchAtLogin\) setLoginItem\(true\)/);
});

test('Windows package and runtime use the custom icon', () => {
  const main = fs.readFileSync(path.join(projectRoot, 'main.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.build.win.icon, 'src/icons/icon.ico');
  assert.match(main, /process\.platform === 'win32' \? 'icon\.ico'/);
  assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'icons', 'icon.ico')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'icons', 'tray-icon.png')), true);
});
