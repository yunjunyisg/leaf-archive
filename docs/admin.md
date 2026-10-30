# 当前主站的管理员后台

主站：https://gloriouscarnivorousplants.top。后台路径 `/admin`，登录路径 `/auth/local`。本功能仅用于阿里云独立运行层，不修改旧 Sites 站点，也不将用户密码写入仓库或更新包。

## 权限与数据范围

- 管理员角色保存在数据库的独立角色表中。只有真实有效会话对应的持久管理员角色可访问后台，普通注册不能指定角色或认领管理员。
- 后台可查看注册账号、普通账号、管理员、今日/近七日/近五分钟活跃账号、植物/分类/照片数量、存储占用、用户列表及档案照片，并可注销或重置普通账号密码。普通账号的原有 API 继续只允许访问自身数据。
- 活跃账号按登录账号去重，按北京时间统计。统计从本次更新开始记录；过去未记录的日期显示“未记录”，不伪造历史人数。历史账号注册时间未记录时不猜测。
- 不显示密码、密码散列、会话令牌、云密钥或服务端环境变量。后台所有响应均为私有且不缓存；用户提供的内容使用文本方式渲染。
- 管理员登录后进入后台。进入“我的收藏”时仍使用自己的独立数据归属，不把其他人的档案转移给管理员。

## 更新现有服务器

可在构建机运行 `node scripts/package-runtime-update.mjs /绝对路径/leaf-archive-admin-update.tar.gz` 生成仅含独立运行层的更新包。也可由仓库所有者在已登录 GitHub 的浏览器中下载本私有仓库源码压缩包，在服务器私有目录仅提取 `standalone/` 与 `deploy/apply-standalone-update.sh`。

上传到服务器 `/root/leaf-migration`，保持目录仅管理员可访问。不要把源码压缩包放进网站公开目录；整个仓库的历史个人备份也不需要解压到应用目录。

更新目录应包含 `standalone/` 和 `deploy/apply-standalone-update.sh`。在管理员终端运行：

```bash
bash /root/leaf-migration/admin-update/deploy/apply-standalone-update.sh --create-admin
```

脚本检查 Node 语法、备份现有运行层、暂停后台、更新模块，以服务账号交互创建管理员，再启动和检查健康状态。运行失败会恢复旧程序；数据库中的新增表或已经成功创建的账号不会通过旧快照覆盖。

根据终端提示输入管理员账号，以及两次密码。密码不会回显，不传到聊天、命令行参数、GitHub 或更新包。已有普通账号与指定管理员重名时停止，不能默默接管；已有管理员重设密码后撤销其旧会话。

若只更新程序，不创建账号，省略 `--create-admin`。如需在安装后单独配置管理员：

```bash
runuser -u www -- env LEAF_DATA_DIR=/var/lib/leaf-archive /usr/bin/node /opt/leaf-archive/standalone/admin-account.mjs
```

以服务账号访问数据库，避免管理员进程改变 SQLite 日志文件归属。后台添加的角色与活动统计表均为新增表，不修改原档案数据或历史迁移文件。

## 验收

用管理员登录应跳转后台并看到真实统计；普通用户和未登录访问后台应被拒绝。创建两个测试用户，确认普通档案、照片、分类仍按归属隔离。检查既有账号、数据数量、六位密码、来源校验、注册和登录流程。管理员创建工具不依赖已知账号名自动提权，数据库中不存在角色时不会开放后台。

## 普通账号管理

在用户列表的操作栏点击“重置密码”或“注销账号”，确认框会显示目标账号和后果。服务端仅接受有效管理员会话的同源提交；普通注册不能提权，管理员账号不能通过这些按钮被注销或重置。

- 重置密码：默认值为 `000000`，立即撤销该账号所有旧会话。用户使用默认密码登录后进入 `/auth/change-password`，必须验证当前密码、输入并确认新密码。新密码至少六位，不能仍为默认密码或与当前密码相同。成功后再次撤销全部旧会话，仅为当前浏览器签发新会话。
- 强制改密期间，服务端阻止所有档案、照片和后台访问；直接访问接口也不能绕过，仅保留改密及退出登录。
- 注销账号：禁止登录并撤销全部会话，账号名保留，不能通过同名注册或重置密码重新启用。档案、分类和照片保留，管理员仍可查看。本操作不会物理删除用户数据。
- 操作在 `admin_audit` 中记录操作者、目标、操作和时间，不记录密码。新增安全状态保存在 `account_security`，服务重启后继续生效。

### 已有管理员安装本次更新

下载私有仓库的最新源码压缩包：
https://github.com/yunjunyisg/leaf-archive/archive/refs/heads/main.zip

上传为 `/root/leaf-migration/leaf-archive-main.zip`，在服务器终端执行以下命令。仅提取独立运行层和更新脚本，不导入仓库中的历史备份，不重新创建管理员。

```bash
(
set -e
umask 077
cd /root/leaf-migration
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
root = Path('/root/leaf-migration/account-management-update')
with ZipFile('leaf-archive-main.zip') as archive:
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
bash account-management-update/deploy/apply-standalone-update.sh
)
```

更新会短暂停止服务并自动检查健康状态，原有账号、管理员角色、档案和照片保留。完成后重新登录管理员后台即可看到操作按钮；源码推送不等于服务器已安装。
