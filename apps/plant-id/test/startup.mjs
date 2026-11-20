import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('the installed service starts through the current release symlink', {timeout: 12000}, async () => {
 const directory = await mkdtemp(join(tmpdir(), 'plant-id-startup-'));
 const current = join(directory, 'current');
 await symlink(fileURLToPath(new URL('../', import.meta.url)), current, 'dir');
 const child = spawn(process.execPath, [join(current, 'server.mjs')], {
  env: {
   ...process.env,
   PLANT_ID_ORIGIN: 'https://gloriouscarnivorousplants.top',
   PLANT_ID_DATA_DIR: join(directory, 'data'),
   PLANT_ID_PORT: '0',
  },
 });
 const exited = once(child, 'close');
 try {
  const port = await new Promise((resolve, reject) => {
   let output = '';
   let errors = '';
   const timer = setTimeout(() => reject(new Error('service did not start: ' + errors)), 6000);
   child.stderr.on('data', chunk => { errors += chunk; });
   child.stdout.on('data', chunk => {
    output += chunk;
    const match = output.match(/端口 (\d+) 启动/);
    if(match){ clearTimeout(timer); resolve(match[1]); }
   });
   exited.then(([code]) => {
    clearTimeout(timer);
    reject(new Error('service exited before listening (' + code + '): ' + errors));
   }, error => { clearTimeout(timer); reject(error); });
  });
  const response = await fetch('http://127.0.0.1:' + port + '/plant-id/healthz', {signal: AbortSignal.timeout(3000)});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {status: 'ok'});
 } finally {
  child.kill('SIGTERM');
  try { await exited; } finally { await rm(directory, {recursive: true, force: true}); }
 }
});
