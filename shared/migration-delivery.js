export function downloadsAvailable(env,owner){return Boolean(owner&&env.LEAF_DOWNLOAD_ENABLED==='true'&&env.LEAF_DOWNLOAD_OWNER===owner&&Number(env.LEAF_DOWNLOAD_EXPIRES)>Date.now());}
