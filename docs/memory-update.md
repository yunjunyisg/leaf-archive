# 服务端内存精简更新

主站：https://gloriouscarnivorousplants.top。

## 保留体验，改变资源加载方式

功能、地图地区覆盖、坐标精度、图片清晰度和植物标识均保留。用户档案、照片、账号、权限和数据库不作删减。上一版的地图流畅切换、本地地形底纹继续保留。

原先独立站直接使用约 51 MB 的内嵌资源程序包，启动就载入大量图片、压缩边界和地名库。本次独立站改为原生 Node 构建：执行代码约 1.3 MB，公开资源独立保存在程序目录；按请求以约 64 KB 的缓冲流式读取。全球边界不再保留三个大文件的内容缓存，仅保留少量校验元数据。澳大利亚地名库也流式解压查询，保留 Kingston Rest 等小地名。

这不是删除图片或降低边界精度。浏览器收到的资源字节与原先版本一致；地图在浏览器中的分区缓存与交互保持。第一次读取某资源会增加本地磁盘读取及完整性校验，具体延迟取决于磁盘和同时访问人数；内存降低有利于小内存服务器保持稳定，不能承诺所有场景都更快。

历史 Worker 构建单独放在 `dist/worker/`，仅用于兼容性回归测试，不作为此次主站的运行包，也不会发布到旧站。

## 本地实测

同一执行环境、同一程序和固定请求，统计 Node 进程常驻内存 RSS；不是整台服务器的总占用：

| 场景 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 启动网站及数据库 | 约 289 MiB | 约 47 MiB |
| 读取图片及中国、印度、加拿大较大三级地图后 | 约 310 MiB | 约 92 MiB |

精简后连续三次独立进程测量结果均为 47 / 92 MiB，累计返回资源字节均为 36,231,897；启动 RSS 下降约 84%，上述请求后下降约 70%。这是本地测试结果，线上还会受系统缓存、并发、访问内容和数据库规模影响，不保证固定数值。

复现：

```bash
npm run build
node scripts/measure-server-memory.mjs
```

九十项自动测试与本地浏览器检查通过，涵盖公开资源字节一致、图片和地形底纹、真实 gzip 响应、Kingston Rest 查询、登录及账号隔离、地图切换，以及静态资源缺失时停止安装和升级失败时恢复旧程序。

## 安装

本包复用已装的全球边界，包含新程序和所需公开资源，不包含数据库或个人照片。请勿只替换 `index.js`，否则图片和地名库可能无法读取。

下载[内存精简更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/memory-20261031-v1/leaf-archive-memory-20261031-v1.tar.gz)，上传到 `/root/leaf-migration/` 后执行：

```bash
install -d -m 700 /root/leaf-migration/memory-update
tar -xzf /root/leaf-migration/leaf-archive-memory-20261031-v1.tar.gz -C /root/leaf-migration/memory-update
bash /root/leaf-migration/memory-update/deploy/apply-standalone-update.sh
```

安装前校验程序、公开资源及已有全球边界。缺少资源或版本不符会停止，尚未修改程序。若没有安装全球边界，请先安装[全球地图完整包](global-map-update.md)，再应用本包。

程序和公开资源一起备份、替换及回滚，不回滚或覆盖用户数据库。更新会重启网站服务；无需重装 Windows、安卓软件。开发环境没有目标服务器执行连接，必须在服务器安装后才会生效。

安装后核对：

```bash
systemctl --no-pager status leaf-archive
ps -eo pid,comm,rss,%mem --sort=-rss | head -12
systemctl show leaf-archive -p MemoryCurrent -p MemoryPeak
```

建议同时确认登录、图片、地名搜索、地图缩放和底纹开关。服务整体内存还可能包含系统计入的文件缓存，不能直接等同于 Node 进程 RSS。
