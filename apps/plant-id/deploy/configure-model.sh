#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo '请在服务器管理员终端执行。'; exit 1; fi
if [ ! -t 0 ]; then echo '请直接在交互终端执行，以便隐藏密钥输入。'; exit 1; fi
read -r -s -p '请输入重新生成的智谱 API 密钥（不显示）：' PLANT_ID_NEW_KEY
echo
if [[ ! "$PLANT_ID_NEW_KEY" =~ ^[A-Za-z0-9_.-]{20,256}$ ]]; then echo '密钥格式不符合要求，未保存。'; exit 1; fi
umask 077
printf '%s' "$PLANT_ID_NEW_KEY" | python3 -c '
import os,sys,tempfile,pathlib
key=sys.stdin.read();p=pathlib.Path("/etc/plant-id.env")
lines=p.read_text().splitlines() if p.exists() else []
replace={"PLANT_ID_PROVIDER":"bigmodel","PLANT_ID_MODEL":"glm-4.6v-flash","PLANT_ID_API_KEY":key}
out=[]
for line in lines:
 name=line.split("=",1)[0]
 if name not in replace:out.append(line)
out.extend(name+"="+value for name,value in replace.items())
fd,temp=tempfile.mkstemp(prefix=".plant-id-",dir="/etc")
try:
 os.fchmod(fd,0o600)
 with os.fdopen(fd,"w") as f:f.write("\n".join(out)+"\n");f.flush();os.fsync(f.fileno())
 os.replace(temp,p)
finally:
 if os.path.exists(temp):os.unlink(temp)
'
unset PLANT_ID_NEW_KEY
systemctl restart plant-id
echo '密钥已保存在独立服务配置中，未写入网页或源码。请打开识植助手上传一张照片进行实际识别。'
