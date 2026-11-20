#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo '请在服务器管理员终端执行。'; exit 1; fi
PLANT_ID_SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
command -v python3 >/dev/null
[ -x /usr/bin/node ] || { echo '未找到 /usr/bin/node，请先安装 Node.js 24。'; exit 1; }
/usr/bin/node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || { echo '需要 Node.js 24 或更高版本。'; exit 1; }
(cd "$PLANT_ID_SOURCE" && sha256sum -c SHA256SUMS)
getent passwd plant-id >/dev/null || useradd --system --home-dir /var/lib/plant-id --no-create-home --shell /usr/sbin/nologin plant-id
install -d -m 755 /opt/plant-id /opt/plant-id/releases
install -d -o plant-id -g plant-id -m 700 /var/lib/plant-id
PLANT_ID_RELEASE=$(mktemp -d /opt/plant-id/releases/$(date +%Y%m%d-%H%M%S).XXXXXX)
cp -a "$PLANT_ID_SOURCE/." "$PLANT_ID_RELEASE/"
chown -R root:plant-id "$PLANT_ID_RELEASE"
find "$PLANT_ID_RELEASE" -type d -exec chmod 750 {} +
find "$PLANT_ID_RELEASE" -type f -exec chmod 640 {} +
if [ ! -f /etc/plant-id.env ]; then install -o root -g root -m 600 "$PLANT_ID_SOURCE/.env.example" /etc/plant-id.env; fi
PLANT_ID_OLD=$(readlink -f /opt/plant-id/current || true)
PLANT_ID_UNIT_BACKUP=$(mktemp /opt/plant-id/old-unit.XXXXXX)
if [ -f /etc/systemd/system/plant-id.service ]; then cp -a /etc/systemd/system/plant-id.service "$PLANT_ID_UNIT_BACKUP"; else rm -f "$PLANT_ID_UNIT_BACKUP"; fi
rollback(){
 trap - ERR
 systemctl show plant-id -p ActiveState -p Result -p ExecMainStatus >&2 || true
 echo '独立服务启动失败，正在恢复安装前的服务配置。'
 if [ -n "$PLANT_ID_OLD" ] && [ -d "$PLANT_ID_OLD" ]; then ln -sfn "$PLANT_ID_OLD" /opt/plant-id/current; else rm -f /opt/plant-id/current; fi
 if [ -f "$PLANT_ID_UNIT_BACKUP" ]; then cp -a "$PLANT_ID_UNIT_BACKUP" /etc/systemd/system/plant-id.service; systemctl daemon-reload; systemctl restart plant-id || true; else systemctl disable --now plant-id || true; rm -f /etc/systemd/system/plant-id.service; systemctl daemon-reload; fi
 echo '请执行 journalctl -u plant-id -n 40 --no-pager 查看启动日志。'
 exit 1
}
trap rollback ERR
ln -sfn "$PLANT_ID_RELEASE" /opt/plant-id/current
install -m 644 "$PLANT_ID_SOURCE/deploy/plant-id.service" /etc/systemd/system/plant-id.service
systemctl daemon-reload
systemctl restart plant-id
PLANT_ID_READY=false
for ((attempt=0; attempt<15; attempt++)); do
 if systemctl is-active --quiet plant-id && \
    curl --noproxy '*' --fail --silent --max-time 2 http://127.0.0.1:3110/plant-id/healthz; then
  PLANT_ID_READY=true
  break
 fi
 sleep 1
done
[ "$PLANT_ID_READY" = true ]
systemctl enable plant-id
rm -f "$PLANT_ID_UNIT_BACKUP"
trap - ERR
echo
echo '识植助手独立服务已启动。植藏服务和数据库未改动。'
echo '下一步：bash /opt/plant-id/current/deploy/configure-model.sh'
echo '然后将 /opt/plant-id/current/deploy/nginx-location.conf 的内容加到宝塔域名配置的 server 块内。'
echo '网页入口：https://gloriouscarnivorousplants.top/plant-id/'
echo '应用选择：https://gloriouscarnivorousplants.top/plant-id/apps'
