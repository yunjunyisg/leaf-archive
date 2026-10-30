# 阿里云 ECS / 宝塔部署

目标域名 gloriouscarnivorousplants.top，已核对公网 IP 121.40.59.222，Ubuntu 24.04 x86_64、2 核 2GB。服务器已有宝塔、Nginx、HTTPS 和 MySQL；本程序不使用或覆盖现有 MySQL、证书、Nginx 全局配置。这是当前唯一主站；原 Sites 环境为迁移来源，不再作为默认开发或发布目标。

## 当前交付范围

`standalone/` 提供 Node.js 24 LTS 运行适配、SQLite 持久化、私有文件图片存储、网站账号密码登录和完整备份导入器。用户已选择先用网站账号密码，之后接微信。新站明确忽略外部 Sites 身份头，不自动把旧账号档案交给第一个登录者。新用户可在注册页创建独立空账号，原档案归属仍须由管理员在交互配置时明确选择。

程序包不包含真实档案、照片、会话、网站密码或云密钥。完整数据备份另行私密交付。已确认服务器已导入部署预演数据、建立原档案账号并启动后台，域名已接入反向代理。登录修复和多人注册代码及更新包已交付，用户是否已在服务器应用最新更新尚待线上核验；下文是可重现安装及后续运维步骤，不能据此宣称每项更新均已上线。

## 准备

1. 在宝塔“软件商店”安装 Node.js 版本管理器，并安装、启用 Node.js **24 LTS**。也可使用官方 Node.js 24 x64 发行版；不要用 Ubuntu 仓库中版本较老的 Node 18。
2. 确认 `node -v` 显示 v24.x；记录 `command -v node` 返回的真实绝对路径。当前已核对 Node 路径为 `/usr/bin/node`，服务模板已采用该路径；其他服务器安装时按实际结果调整。
3. 使用宝塔文件管理器或 Workbench 文件传输，把程序包上传至 `/opt/leaf-archive-release.tar.gz`，完整数据包上传至 `/root/leaf-migration-backup.tar.gz`。禁止把数据库或备份放进 `/www/wwwroot/` 等网站公开目录。
4. 对现有宝塔网站配置和数据建立备份。若 `/opt/leaf-archive` 已存在，先核对版本，不覆盖运行中的目录。

程序包可以在构建机通过 `npm ci && npm run build && node scripts/package-standalone.mjs /绝对路径/leaf-archive-aliyun.tar.gz` 生成。目标服务器无需 npm install，包内仅使用 Node 标准库。

## 导入与账号

确认路径为空后，解压程序和私密备份，再运行：

```bash
mkdir -p /opt/leaf-archive
chmod 700 /opt/leaf-archive
# 程序包不含真实数据，可放在 /opt；备份必须保持 700/600 权限。
tar -xzf /opt/leaf-archive-release.tar.gz -C /opt/leaf-archive
mkdir -m 700 /root/leaf-migration-backup
tar -xzf /root/leaf-migration-backup.tar.gz -C /root/leaf-migration-backup
cd /opt/leaf-archive
node standalone/import.mjs /root/leaf-migration-backup
node standalone/account.mjs
```

先导入，再创建账号。根据提示设置网站专用账号和至少 6 个字符的密码，密码不回显；选择属于自己的原档案归属。新用户可自行注册独立空账号；已有档案的归属绑定仍通过管理员终端进行，不开放首次访问认领。重复设置同一账号密码会撤销该归属的全部已有会话。

备份格式：`database.json` 保留 sourceProjectId、四张持久表的 columns/rows；`objects.json` 为所有图片的 key、sha256、size 清单；对象位于 `objects/{sha256(逻辑键)}`。逻辑键保持原始 `owner/id`。导入器要求目标数据表为空、来源项目匹配、所有对象存在且校验一致，不导入旧会话、OAuth 状态和地名缓存。历史 `backups/personal/` 不能替代最终完整快照。

## 启动和接入现有 Nginx

1. 确认宝塔 `www` 用户/组存在。将 `/opt/leaf-archive` 程序目录设为 www 可读，`/var/lib/leaf-archive` 及其内容归 www，数据目录权限 700。数据库、照片和密码散列不放在公开网站目录。
2. 按实际 Node 路径修订 `deploy/leaf-archive.service`，安装到 `/etc/systemd/system/leaf-archive.service` 后执行 `systemctl daemon-reload`、`systemctl enable --now leaf-archive`。
3. 用 `curl -f http://127.0.0.1:3100/healthz` 检查应用。应用仅监听本机 3100，不需要在安全组公开该端口。
4. 宝塔“网站 → gloriouscarnivorousplants.top → 设置”，备份现有站点配置后配置反向代理到 `http://127.0.0.1:3100`。参考 `deploy/nginx-location.conf`；替换现有 `location /`，不能重复创建。保留原有 HTTPS 证书、ACME 规则和 HTTP 跳转。禁止启用个人 API/图片的代理缓存。
5. 检查 Nginx 配置后再重载（宝塔使用 `/www/server/nginx/sbin/nginx -t`）。`www` 子域名如保留，应在宝塔设为跳转至无 www 的 HTTPS 主域名；账号 Cookie 和服务端来源校验均以主域名为准。

## 验收与切换

检查专用账号登录、原档案数量、分类、每张照片、地图分层、保存冲突、多设备同步；创建第二个空账号验证不能访问他人档案与照片。服务器重启后再次检查持久化与自动启动。当前地名在线搜索及可选 OSM 瓦片仍使用境外服务，迁移服务器不等于替换这些服务。

最终切换前停止旧站写入并制作最终快照；此前的导出用于预演，不能冒充最终完整数据。新站验收通过后再设置旧站迁移提示/维护入口，防止两个站点继续分别写入。回退时先保全新站新增记录，不能用旧快照覆盖。

临时照片导出路由默认关闭，仅在迁移期间接受短期密钥且限制原账号归属；导出完毕删除 LEAF_EXPORT_SHA256、LEAF_EXPORT_EXPIRES、LEAF_EXPORT_OWNERS 并重新部署原站，不能保留长期导出入口。

登录页使用同源来源策略，以保留浏览器表单提交所需的来源信息；不得设置为完全隐藏来源，也不得通过允许空来源或在反向代理中伪造来源来绕过服务端校验。修改已安装的登录模块后需重启后台，并从新打开的登录页重新提交。

## 多人自助注册

新站登录页提供“注册新账号”入口，注册页路径为 `/auth/register`。账号支持三至六十四位字母、数字、点、下划线和横线，不区分英文字母大小写；密码最低六位，需要重复确认。注册成功后自动登录，并生成全新的数据归属。访客不能指定或认领已有归属，重复或并发注册不会覆盖现有密码或档案。注册尝试按地址限制，继续保留同源校验和私有会话。

已安装服务器可使用独立的注册更新包，只替换 `standalone/local-auth.mjs` 后重启服务；不重新导入数据库，不更改现有账号及原档案归属。更新前备份原模块，新模块继续包含登录来源策略修复。
