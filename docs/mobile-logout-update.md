# 手机退出登录入口修复

主站：https://gloriouscarnivorousplants.top。

原因是旧样式在窄屏下隐藏整个顶部栏，同时隐藏了退出入口。新版恢复手机账号栏和适合触摸的“退出登录”按钮，并为服务器旧页面构建提供兼容样式，网站端更新不需要重新构建整个站点。

安卓应用另提供固定的原生“退出登录”按钮，确认后调用主站退出接口，成功后返回登录页；退出失败时提示重试，不虚报已退出。打开登录页会清除旧的浏览历史，避免返回原先的个人页面。此应用按钮通过新版安卓安装包即可使用，无需等待网站升级。

- 安卓用户：在 [应用下载页](https://github.com/yunjunyisg/leaf-archive/releases/tag/apps-v1.0.1) 下载并覆盖安装新版。签名与原版一致，无需卸载。
- 手机浏览器用户：安装下方网站更新后刷新页面。
- 退出仅撤销当前登录会话，不注销账号或删除档案，不影响其他设备的独立登录。

## 安装网站修复包

下载 [网站修复包](https://github.com/yunjunyisg/leaf-archive/releases/download/apps-v1.0.1/leaf-archive-mobile-logout-20261030-v1.tar.gz)，上传到服务器 `/root/leaf-migration/` 后，在服务器终端运行：

```bash
install -d -m 700 /root/leaf-migration/mobile-logout-runtime
tar -xzf /root/leaf-migration/leaf-archive-mobile-logout-20261030-v1.tar.gz -C /root/leaf-migration/mobile-logout-runtime
bash /root/leaf-migration/mobile-logout-runtime/deploy/apply-standalone-update.sh
```

更新会短暂停止服务并检查运行状态，保留现有账号与档案；完成后刷新手机网页。

## 从源码压缩包安装（另一种方式）





下载本次手机退出登录更新的固定版本源码包，文件名为 `leaf-archive-mobile-logout-20261030-v1.zip`，与之前的源码包区分：
https://github.com/yunjunyisg/leaf-archive/archive/refs/tags/mobile-logout-20261030-v1.zip

上传为 `/root/leaf-migration/leaf-archive-mobile-logout-20261030-v1.zip`，在服务器终端执行以下命令。仅提取独立运行层和更新脚本，不导入仓库中的历史备份，不重新创建管理员。

```bash
(
set -e
umask 077
cd /root/leaf-migration
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
root = Path('/root/leaf-migration/mobile-logout-update')
with ZipFile('leaf-archive-mobile-logout-20261030-v1.zip') as archive:
    for item in archive.infolist():
        parts = PurePosixPath(item.filename).parts
        if item.is_dir() or len(parts) < 3:
            continue
        relative = PurePosixPath(*parts[1:])
        if '..' in relative.parts:
            raise SystemExit('压缩包路径异常，已停止')
        if relative.parts[0] == 'standalone' or str(relative) == 'deploy/apply-standalone-update.sh':
            target = root.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))
PYTHON
bash mobile-logout-update/deploy/apply-standalone-update.sh
)
```

更新会短暂停止服务并自动检查健康状态，原有账号、管理员角色、档案和照片保留。完成后在手机刷新网站，顶部账号栏和“退出登录”按钮会正常显示；源码推送不等于服务器已安装。
