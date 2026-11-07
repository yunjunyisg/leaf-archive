# 点击上传照片放大预览

主站：https://gloriouscarnivorousplants.top。

原来上传后的缩略图没有绑定预览操作，本次为以下位置添加独立的大图预览：

- 新增或编辑植物档案中的照片缩略图，收藏、分类树、产地地图三页共用。
- 生长记录中刚上传的照片。
- 分类参考图编辑窗口中的照片，包括重新打开编辑时的已保存参考图。
- 植物档案详情中的主照片。

鼠标点击、手机轻点或聚焦缩略图后按 Enter / 空格可打开。图片按完整比例适配可见区域，不裁剪成缩略图；已读取的拍摄日期或已保存照片日期作为参考显示。点击“关闭预览”、按 Esc 或点击外部遮罩返回原窗口，不提交、不清空草稿。日期输入框和移除按钮继续独立工作，不触发预览。

大图仍通过原有账号鉴权地址加载，不变为公开链接、不新增公共缓存，不压缩或重编码图片。关闭预览清除大图引用，退出账号关闭预览；加载失败显示提示并可关闭后重试。保留单张 20 MiB 上限和原有最多照片数量，无需额外更改代理设置来使用预览。

## 安装

下载[更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/photo-preview-v1.5.5/leaf-archive-photo-preview-v1.5.5.tar.gz)，完整上传到 `/root/leaf-migration/` 后复制执行整段命令：

```bash
(
set -e
cd /root/leaf-migration
echo "d13c981be2b6b7879bfe6afa8046baf9f93bd4fa6eaa7c666be190be43e37f86  leaf-archive-photo-preview-v1.5.5.tar.gz" | sha256sum -c -
gzip -t leaf-archive-photo-preview-v1.5.5.tar.gz
UPDATE_DIR=$(mktemp -d /root/leaf-migration/photo-preview-verified.XXXXXX)
tar -xzf leaf-archive-photo-preview-v1.5.5.tar.gz -C "$UPDATE_DIR"
(cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
bash "$UPDATE_DIR/deploy/apply-standalone-update.sh"
)
```

包含程序及全部公开资源，复用并校验已有全球边界，保留数据库、账号归属和私有照片。安装后刷新网页，Windows 与安卓软件关闭再打开即可，无需重装客户端。

当前开发环境未配置服务器执行连接，代码和更新包发布不代表主站已安装。

## 验证

111 项自动测试通过。本地原生 Node 程序通过 HTTPS 在 Chromium 中验证桌面和手机尺寸：三页新增档案的上传、点击放大、键盘打开、Esc 与按钮关闭、关闭保留编辑内容、修改日期、移除照片及保存后通过 API 再读取；另检查档案主图、生长照片和分类参考图预览、原图正常解码，以及关闭后清除大图来源。真实设备和线上安装尚需验收。
