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

test('desktop releases build Windows and universal macOS installers', () => {
  const workflow = fs.readFileSync(path.join(projectRoot, '.github', 'workflows', 'release.yml'), 'utf8');
  const packageConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const macTarget = packageConfig.build.mac.target[0];

  assert.deepEqual(macTarget.arch, ['universal']);
  assert.equal(packageConfig.build.mac.icon, 'build/icon.icns');
  assert.equal(packageConfig.build.mac.artifactName, 'Xiaojian-${version}-mac-${arch}.${ext}');
  assert.equal(packageConfig.build.win.artifactName, 'Xiaojian-Setup-${version}-windows-${arch}.${ext}');
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /runs-on: macos-latest/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /gh release upload/);
});
