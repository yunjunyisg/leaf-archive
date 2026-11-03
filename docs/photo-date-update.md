# 上传照片显示拍摄日期

主站：https://gloriouscarnivorousplants.top。

选中照片导入后，档案、生长记录和分类参考图的预览可显示照片内保存的拍摄日期。网站不能更改手机或电脑系统弹出的相册选择器，日期显示在网站内的选中照片预览中。

- 支持 JPEG、PNG、WebP 中的 EXIF DateTimeOriginal，日期按相机记录的日历日期显示，不做时区换算。
- 档案照片自动填入已有的“照片日期”，允许手动更正，保存后继续用于时间线和对比图。
- 生长记录与新导入的分类参考图逐张显示拍摄日期作为参考；不自动更改生长记录日期，不另建分类参考图日期字段。
- 元数据缺失、格式错误或文件不可读取时显示未读取到日期，不阻断原有上传流程，也不拿文件修改时间或上传时间替代。
- 只在浏览器本地读取日期字段，不读取 GPS，不新增服务端元数据处理或后台批量扫描，不更改旧照片及档案。

## 安装

下载[更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/photo-date-v1.5.3/leaf-archive-photo-date-v1.5.3.tar.gz)，完整上传至 `/root/leaf-migration/`。以下整段命令先校验再安装，任何一步失败停止：

```bash
(
set -e
cd /root/leaf-migration
echo "59e249283516b3e5898015fd636167c8a00a11b1993f16fb581ede2a935c2882  leaf-archive-photo-date-v1.5.3.tar.gz" | sha256sum -c -
gzip -t leaf-archive-photo-date-v1.5.3.tar.gz
UPDATE_DIR=$(mktemp -d /root/leaf-migration/photo-date-verified.XXXXXX)
tar -xzf leaf-archive-photo-date-v1.5.3.tar.gz -C "$UPDATE_DIR"
(cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
bash "$UPDATE_DIR/deploy/apply-standalone-update.sh"
)
```

更新包包含程序及全部公开资源，复用并校验现有全球边界；保留数据库、账号归属和私有照片。安装后刷新网页，软件关闭后重新打开，无需重装。

开发环境未配置服务器执行连接，发布源码和附件不代表主站已安装。

## 验证

108 项自动测试通过。日期解析覆盖两种字节序、三种图片容器、闰年与无效日期、截断与恶意越界偏移、缺失元数据和文件读取失败。桌面及手机尺寸的本地 Chromium 页面验证自动填入、缺失提示、手动修改后保存和生长照片日期提示；没有实际设备或线上安装验收。
