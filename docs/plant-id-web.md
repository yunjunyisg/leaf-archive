# 识植助手独立网页版安装

这是新增的第二个应用，不是植藏中的识别按钮，也不是原 Windows／安卓软件的替换包。

| 应用 | 安装后的网址 | 使用方式 |
|---|---|---|
| 植藏 | https://gloriouscarnivorousplants.top/ | 原有账号、收藏、分类树和地图 |
| 识植助手 | https://gloriouscarnivorousplants.top/plant-id/ | 单独注册账号，照片／文字识别 |
| 应用选择页 | https://gloriouscarnivorousplants.top/plant-id/apps | 分别打开两个应用 |

新应用使用独立服务、数据库和登录会话，不导入原植物档案。入口需完成以下安装和代理配置才会生效，源码及下载包发布不代表已经部署。

## 一、下载并安装独立服务

如果安装 1.0.0 时本机 3110 连接失败并回滚，直接安装当前版本。旧版启动入口比较了两种不同的路径，服务可能直接退出。新版支持通过安装程序使用的 current 符号链接启动。

下载[识植助手安装包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.4/plant-id-web-v1.0.4.tar.gz)，上传到阿里云服务器的 `/root/leaf-migration/`。在服务器管理员终端执行：

```bash
(
set -e
cd /root/leaf-migration
echo "ef58cceb19fd4981a975358d650bfb8ae47d18cb447dd3a0556562694a2f21d7  plant-id-web-v1.0.4.tar.gz" | sha256sum -c -
gzip -t plant-id-web-v1.0.4.tar.gz
PLANT_ID_INSTALL_DIR=$(mktemp -d /root/leaf-migration/plant-id-verified.XXXXXX)
tar -xzf plant-id-web-v1.0.4.tar.gz -C "$PLANT_ID_INSTALL_DIR"
(cd "$PLANT_ID_INSTALL_DIR" && sha256sum -c SHA256SUMS)
bash "$PLANT_ID_INSTALL_DIR/deploy/install.sh"
)
```

需要服务器已有 `/usr/bin/node`，版本至少 24，以及系统自带的 Python 3。不需要安装额外软件包或下载本地视觉模型。

安装程序新增 `plant-id` 系统用户、`plant-id.service`，程序放在 `/opt/plant-id/current`，数据放在 `/var/lib/plant-id/`。它不会替换 `/opt/leaf-archive`、植藏数据库、照片或证书，也不重启植藏服务；升级独立服务失败时恢复上一独立程序版本。

此时健康检查成功只说明服务启动，不说明密钥或网页代理已经完成。

## 二、在服务器配置新密钥

用户已确认选择智谱开放平台。曾在聊天中发送的密钥建议先在智谱控制台撤销，然后重新生成。不要把新密钥发到聊天、写进网页、上传到 GitHub，或放在命令参数中。

执行：

```bash
bash /opt/plant-id/current/deploy/configure-model.sh
```

按提示粘贴新密钥。输入时屏幕不会显示字符，按回车即可。脚本写入只有管理员可读的 `/etc/plant-id.env`，选择智谱和 `glm-4.6v-flash` 并重启独立服务。后续也可用此脚本更新密钥；其他限额设置保留。

[智谱视觉模型官方文档](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash)列出了模型调用方式。实际模型权限、额度和费用以智谱控制台为准；配置的是中国内地官方接口，不经境外转发。

## 三、给域名增加前缀代理

打开宝塔“网站”，找到 `gloriouscarnivorousplants.top` 对应网站的“设置 → 配置文件”。先保存一份原配置备份。

在该网站已有的 `server { ... }` 内加入以下两段，与原来的 `location /` 同级，不能放进另一个 `location` 内。保留原来的植藏代理、证书和其他配置。如果已有 `/plant-id/` 配置，修改原段，不重复添加。

```nginx
location = /plant-id {
    return 308 /plant-id/;
}
location ^~ /plant-id/ {
    proxy_pass http://127.0.0.1:3110;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    client_max_body_size 12m;
    proxy_read_timeout 110s;
    proxy_send_timeout 110s;
    proxy_next_upstream off;
}
```

注意 `proxy_pass` 末尾不加斜杠，保留 `/plant-id/` 路径。`^~` 让新应用自己的脚本、样式和图片走独立服务，避免被原网站的静态文件规则截走。3110 只监听本机，不需要开放公网端口或更改安全组。

宝塔保存并重载配置成功后，打开 https://gloriouscarnivorousplants.top/plant-id/ ，单独注册新账号，勾选发送资料的同意项，再选一张植物照片实际识别。

## 四、确认与排查

- 原网址仍能正常进入植藏，原档案与登录保留。
- 新网址能显示“识植助手”，用新账号注册登录，并能显示候选、概率、支持依据及区分方法。
- 补充文字后点击“更新识别”；原图只在本机生成识别副本，本站历史不保存照片。
- 换另一个识植助手账号，不能看到第一个账号的记录。
- 若显示“未开通”，检查独立密钥是否配置；显示“授权失败”，到智谱检查密钥、模型权限和额度，不要发送密钥截图。
- 若网页打不开或脚本加载失败，检查新前缀代理是否位于正确域名的 `server` 内，是否保留了路径。若长时间等待后失败，检查服务器到智谱接口的连接和平台状态。

```bash
systemctl --no-pager --full status plant-id
curl --fail http://127.0.0.1:3110/plant-id/healthz
journalctl -u plant-id -n 40 --no-pager
systemctl show plant-id -p MemoryCurrent -p MemoryPeak
```

不要把 `/etc/plant-id.env` 的内容发出来。模型请求和图片不会写入服务日志。

默认每账号每天最多 20 次，全站每天最多 100 次，并发最多 2 次，按北京时间日期重置。请求已提交后即计次，停止等待或平台失败可能仍消耗一次。可由服务器管理员修改 `/etc/plant-id.env` 中相应限额后重启 `plant-id`；不要删除数据库来重置额度。


## 图片文字识别

在识植助手顶部点击「文字识别」，或打开 `/plant-id/ocr`。登录后可上传一张不超过 5 MiB 的 JPG 或 PNG，提取并复制标签、包装或截图中的原文。OCR 与植物识别共用当前视觉服务及每日额度。本站不保存 OCR 图片和结果。已有密钥和代理配置可继续使用。

## 识别结果格式提示

植物识别支持多种结构化返回格式，可从常见的代码块或附带说明中读取结构化结果，并接受整数百分数字符串。1.0.4 会将无法整理为候选卡片的可读回复作为纯文本展示。截断的回复会标明只显示部分内容。原文只显示在当前页，不写入历史。已有智谱模型、密钥和每日额度可继续使用。每次提交只调用一次模型。

## 本次验证范围

15 项自动测试通过，包括从与生产相同的 current 符号链接启动进程并访问健康检查。其他测试覆盖真实本地 HTTP 与图片内容传输、独立账号与会话、历史归属、补充识别、密钥未配置时不伪造结果、授权与连接失败不泄露密钥、非法图像与来源检查、请求大小、限额、并发及退出后不写入迟到结果、数据库重开后的历史与额度保留。脚本语法和安装包内文件摘要已检查。

模型调用测试使用模拟响应核对请求协议和图像字节，没有使用聊天中暴露的真实密钥发起推理。当前环境缺少可用的网页预览工具，未完成浏览器交互或手机实机验收；也没有目标服务器执行连接。因此需安装后用重新生成的密钥完成实际识别与设备验收。
