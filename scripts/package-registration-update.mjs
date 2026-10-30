// The current registration module shares authorization and activity tracking with the admin module.
// Ship the complete standalone runtime so no dependency is omitted.
import {spawnSync} from 'node:child_process';import path from 'node:path';
const result=spawnSync(process.execPath,['scripts/package-runtime-update.mjs',path.resolve(process.argv[2]||'leaf-archive-registration-update.tar.gz')],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
