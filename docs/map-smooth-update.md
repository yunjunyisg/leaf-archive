# 地图层级切换与本地底纹优化

主站：https://gloriouscarnivorousplants.top。

## 修改内容

- 新层级未准备完时保留当前地图；新分区分批建立并在准备完成后替换，避免先清空地图再出现新层。
- 快速连续缩放或切换层级时，仅采用最新请求结果；过时结果不能覆盖当前地图。
- 只绘制当前视野及周围缓冲范围内的分区。缩放变细后也会清理视野外图形；平移到其他地区时重新显示相应分区，不删除边界或降低坐标精度。
- 缓存最近三个已解析分区数据及空间索引；回到已看过的层级、在同一国家平移时复用，减少重复下载、解析和全量重绘。连续地图事件合并处理，悬停仍只更新对应分区。
- 地理底图改为主站本地提供的 Natural Earth II 地形概览，默认开启，可通过“显示地形底纹”关闭。不再请求境外栅格瓦片。底纹按 Web Mercator 重投影，与地图坐标对齐；仅供全球地形概览，不提供街道、卫星或实时影像细节。
- 保留原有国家、省州、二级、三级层级、分类颜色、产地精度、用户数据隔离、失败重试与地区覆盖限制。

普通用户地图、管理员总地图及位置选择器均使用本地地形概览。植物标点优先显示。

## 安装优化包

本次优化包复用已经安装的全球边界文件，无须重新上传上一版约 234 MB 的完整地图包。安装前校验现有边界目录及全部快照；缺少文件或版本不符会在更改程序前停止。

下载[地图优化包](https://github.com/yunjunyisg/leaf-archive/releases/download/map-smooth-20261031-v1/leaf-archive-map-smooth-20261031-v1.tar.gz)，上传到 `/root/leaf-migration/`，执行：

```bash
install -d -m 700 /root/leaf-migration/map-smooth-update
tar -xzf /root/leaf-migration/leaf-archive-map-smooth-20261031-v1.tar.gz -C /root/leaf-migration/map-smooth-update
bash /root/leaf-migration/map-smooth-update/deploy/apply-standalone-update.sh
```

若提示“现有全球地图版本不符、文件缺失或校验失败”，请先安装[全球地图完整包](global-map-update.md)，再运行本次优化包。请勿跳过校验或覆盖数据库。

安装脚本备份并更新程序，检查失败自动恢复旧程序，保留数据库、账号、用户图片和已安装地图。完成后刷新网页或重开 Windows / 安卓软件，不需要重装软件。

当前开发环境没有目标服务器的执行连接，GitHub 发布与服务器安装是两个步骤。此次仅核对线上已有全球地图目录，未在主站直接执行安装命令。

## 验证

八十三项自动测试通过。新增验证涵盖加载中旧层保留、过时请求不能覆盖新层、视野裁剪后恢复相邻地区、缓存复用、本地底纹及校验响应，以及轻量更新校验与失败停止。

本地真实浏览器验证：昆明细看时仅绘制视野内三个二级分区、六个三级分区；故意延迟三级请求时旧层保持；返回二级后过时请求不覆盖；底纹可正常开关，加载地图期间没有外部网络请求。另检查手机尺寸布局。实际设备与主站安装后仍需验收。

## 构建

```bash
npm test
node scripts/package-runtime-update.mjs /absolute/path/leaf-archive-map-smooth-update.tar.gz --with-core --reuse-boundaries
```

不加 `--reuse-boundaries` 可生成同时包含全部全球边界的完整更新包。
