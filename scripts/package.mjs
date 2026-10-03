import {spawnSync} from 'node:child_process';
import path from 'node:path';
const target=path.resolve(process.argv[2]||'site-build.tar.gz');
// Sites reads schema migrations from drizzle/ at the archive root.
const result=spawnSync('tar',['-czf',target,'.openai/hosting.json','dist','drizzle'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
console.log(target);
