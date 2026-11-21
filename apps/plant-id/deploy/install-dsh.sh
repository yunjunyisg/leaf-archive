#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo '请在服务器管理员终端执行。'; exit 1; fi
umask 022
PLANT_ID_SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
PLANT_ID_NPM=$(command -v npm) || { echo '请先安装 Node.js 24.9 或更高版本及 npm。'; exit 1; }
[ -x /usr/bin/node ] && /usr/bin/node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<24||major===24&&minor<9)process.exit(1)' ||
 { echo '植物问答需要 /usr/bin/node 24.9 或更高版本。'; exit 1; }
[ -f "$PLANT_ID_SOURCE/dsh/runtime/package-lock.json" ] || { echo '当前安装包缺少 DSH 依赖清单。'; exit 1; }
install -d -m 755 /opt/plant-id /opt/plant-id/dsh-releases
PLANT_ID_DSH_LINK=/opt/plant-id/dsh-runtime
if [ -e "$PLANT_ID_DSH_LINK" ] && [ ! -L "$PLANT_ID_DSH_LINK" ]; then
 echo '安装路径已有普通目录，请先核对现有 DSH 配置。'
 exit 1
fi
if [ -f "$PLANT_ID_DSH_LINK/node_modules/@deepseek-ai/dsh-sdk-client/package.json" ] &&
   cmp -s "$PLANT_ID_SOURCE/dsh/runtime/package-lock.json" "$PLANT_ID_DSH_LINK/package-lock.json"; then
 echo '已安装匹配的 DSH 运行时。'
else
 PLANT_ID_NEW_RUNTIME=$(mktemp -d /opt/plant-id/dsh-releases/runtime.XXXXXX)
 cleanup(){ if [ -n "${PLANT_ID_NEW_RUNTIME:-}" ]; then python3 -c 'import shutil,sys;shutil.rmtree(sys.argv[1])' "$PLANT_ID_NEW_RUNTIME"; fi; }
 trap cleanup EXIT
 cp "$PLANT_ID_SOURCE/dsh/runtime/package.json" "$PLANT_ID_SOURCE/dsh/runtime/package-lock.json" "$PLANT_ID_NEW_RUNTIME/"
 /usr/bin/node "$PLANT_ID_NPM" --prefix "$PLANT_ID_NEW_RUNTIME" ci --omit=dev --ignore-scripts --no-audit --no-fund
 /usr/bin/node "$PLANT_ID_NEW_RUNTIME/node_modules/@deepseek-ai/dsh/lib/bin.js" --version
 chmod 755 "$PLANT_ID_NEW_RUNTIME"
 ln -sfn "$PLANT_ID_NEW_RUNTIME" "$PLANT_ID_DSH_LINK"
 PLANT_ID_NEW_RUNTIME=
 trap - EXIT
fi
systemctl restart plant-id
curl --noproxy '*' -fsS --retry 6 --retry-connrefused --retry-delay 1 http://127.0.0.1:3110/plant-id/api/session |
 python3 -c 'import sys,json; data=json.load(sys.stdin); assert data.get("dshAvailable") is True; print("识植助手的 DSH 问答已启用。")'
