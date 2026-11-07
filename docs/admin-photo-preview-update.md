# 管理员后台图片放大预览

主站：https://gloriouscarnivorousplants.top。

管理员后台使用独立页面，本次为“用户上传图片”和“植物档案详情”的照片添加点击放大预览；从用户总地图打开的档案详情同样适用。图片列表包含用户上传的植物、日志照片及分类参考图。

- 鼠标点击、手机轻点，或聚焦缩略图后按 Enter / 空格打开大图。
- 原图按完整比例适配视窗，不裁剪；显示所属账号与图片标识，或对应档案名称。
- 预览内保留“下载原图”，列表与档案详情原有下载入口也保留。
- 点击“关闭预览”、按 Esc 或点击外部遮罩返回，保留用户筛选、图片页码及已打开的档案详情。
- 沿用 `/api/admin/images/` 管理员鉴权接口及私有禁止缓存；普通用户和未登录者不能借预览访问后台图片。不生成公开链接，不改变原图字节或用户数据。
- 预览关闭、后台会话失效被检测到或退出登录时清除大图来源；加载失败提示关闭后重试。

本包也包含普通用户照片预览、照片日期读取和单张 20 MiB 上传支持，不需要先逐个安装之前的程序包。软件无需重装。

## 安装

下载[更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/admin-photo-preview-v1.5.6/leaf-archive-admin-photo-preview-v1.5.6.tar.gz)，完整上传到 `/root/leaf-migration/` 后执行整段命令：

```bash
(
set -e
cd /root/leaf-migration
echo "f9369a7eb122483ab127e52aeffe6dc99a587422bf9d165574380e3bc3713e53  leaf-archive-admin-photo-preview-v1.5.6.tar.gz" | sha256sum -c -
gzip -t leaf-archive-admin-photo-preview-v1.5.6.tar.gz
UPDATE_DIR=$(mktemp -d /root/leaf-migration/admin-photo-preview-verified.XXXXXX)
tar -xzf leaf-archive-admin-photo-preview-v1.5.6.tar.gz -C "$UPDATE_DIR"
(cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
bash "$UPDATE_DIR/deploy/apply-standalone-update.sh"
)
```

包含程序及全部公开资源，复用并校验已有全球边界；保留数据库、账号权限、档案与私有照片。安装后刷新网页，Windows、安卓软件关闭后重开。预览无需新增代理配置；若尚未配置 20 MB 上传的代理限制，见[20 MB 更新说明](photo-20mb-update.md)。

当前开发环境没有目标服务器执行连接，源码和更新包发布不代表主站已安装。

## 验证

111 项自动测试通过。本地原生 Node HTTPS 程序在桌面与手机尺寸 Chromium 验证：按用户筛选后切换到第二页，打开大图、下载原图、键盘关闭及按钮关闭，筛选与页码保留；档案照片、日志照片及总地图进入的详情均可放大。下载文件 SHA-256 与原图一致；管理员图片接口返回私有禁止缓存，普通账号请求返回 403、未登录返回 401；无页面脚本异常。实际设备与主站仍需安装后验收。
