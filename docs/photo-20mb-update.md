# 原图单张上传上限提高至 20 MB

主站：https://gloriouscarnivorousplants.top。

植物档案照片、生长记录照片和分类参考图现在允许每张不超过 **20 MiB（20 × 1024 × 1024 字节）**。可以一次选择多张，仍按现有逻辑逐张上传，不是整批只能 20 MB。档案仍最多 12 张，单条生长记录仍最多 6 张。

上传保存原始字节，不缩小尺寸、不重新编码、不压缩画质。JPG、PNG、WebP 格式限制与账号隔离保持不变。拍摄日期读取同步支持 20 MB 照片，截图或缺少元数据的图片不推测日期。头像仍使用独立的 1 MB 限制，不影响植物原图上传。

## 一、先检查宝塔代理限制

只更新程序不能改变现有 Nginx 配置。打开宝塔 → 网站 → 对应主站 → 配置文件。在指向 `http://127.0.0.1:3100` 的 `location /` 中，找到原来的 `client_max_body_size 10m;`，改为：

```nginx
client_max_body_size 24m;
```

若该代理块没有这一行，则在块内新增。保留其他代理设置、证书、证书验证和跳转规则，不要新增重复的 `location /`。如果根域名与 `www` 分属不同站点，两个站点都需检查。先备份原配置，再在宝塔保存并确认校验通过、重载成功；不要忽略错误提示。

代理上限 24m 是为请求包装留出空间；程序对单张文件仍严格限制 20 MiB，图片上传请求整体限制 22 MiB。其他程序接口仍保留原来的 10 MiB 请求上限，头像继续单独校验。

更新包也包含 `deploy/nginx-location.conf` 供核对；安装脚本不会擅自覆盖宝塔配置。

## 二、安装程序

下载[更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/photo-20mb-v1.5.4/leaf-archive-photo-20mb-v1.5.4.tar.gz)，完整上传至 `/root/leaf-migration/` 后执行以下整段命令。校验或解压失败会停止，不要继续执行安装。

```bash
(
set -e
cd /root/leaf-migration
echo "93ff74c9003f9c71ec1d49e8c505d29700c4a3b8d024284015fb7c90957eee13  leaf-archive-photo-20mb-v1.5.4.tar.gz" | sha256sum -c -
gzip -t leaf-archive-photo-20mb-v1.5.4.tar.gz
UPDATE_DIR=$(mktemp -d /root/leaf-migration/photo-20mb-verified.XXXXXX)
tar -xzf leaf-archive-photo-20mb-v1.5.4.tar.gz -C "$UPDATE_DIR"
(cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
bash "$UPDATE_DIR/deploy/apply-standalone-update.sh"
)
```

包含程序及全部公开资源，复用并校验已安装的全球边界；保留数据库、账号和照片。安装后刷新网页，Windows、安卓软件关闭后重新打开即可，无需重新安装客户端。

## 三、验收

上传一张大于 8 MB、小于或等于 20 MB 的照片，保存档案再打开，检查原图显示与日期。大于 20 MiB 的照片应提示超过上限。如果出现 413，请再次检查实际处理该域名的 Nginx 代理块（含宝塔代理扩展配置）是否仍有更小的限制。高分辨率照片上传时间与网络带宽有关，20 MB 上限不代表即时上传。

111 项自动测试通过。本地测试验证真实 Node HTTP multipart 上传恰好 20 MiB、原图下载长度与 SHA-256 一致、超出 1 字节被拒绝且不入库、其他用户无权读取，以及请求包装和其他接口上限。另验证大图日期读取及电脑、手机尺寸页面的前端限制。未配置目标服务器执行连接，发布代码与附件不代表主站已安装或 Nginx 已重载。
