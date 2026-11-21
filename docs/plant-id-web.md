# 识植助手独立网页版安装

这是新增的第二个应用，不是植藏中的识别按钮，也不是原 Windows／安卓软件的替换包。

| 应用 | 安装后的网址 | 使用方式 |
|---|---|---|
| 植藏 | https://gloriouscarnivorousplants.top/ | 原有账号、收藏、分类树和地图 |
| 识植助手 | https://gloriouscarnivorousplants.top/plant-id/ | 单独注册账号，照片／文字识别 |
| 应用选择页 | https://gloriouscarnivorousplants.top/plant-id/apps | 分别打开两个应用 |

新应用使用独立服务、数据库和登录会话，不导入原植物档案。入口需完成以下安装和代理配置才会生效，源码及下载包发布不代表已经部署。


## 安卓与 Windows 安装包

识植助手客户端启动后进入 `https://gloriouscarnivorousplants.top/plant-id/`。请使用识植助手自己的账号。客户端需联网，功能和页面布局随服务器上的识植助手版本更新。升级服务器后，重新打开客户端即可加载新版页面。

- 安卓 10 或更新版本使用 `PlantId-Android-1.0.1.apk`。
- Windows 10/11 64 位使用 `PlantId-Windows-x64-1.0.1.exe`。

[客户端安装包下载](https://github.com/yunjunyisg/leaf-archive/releases/tag/plant-id-apps-v1.0.1)


## 一、下载并安装独立服务

安装 1.0.5 后，识植助手首次启动时会删除每个账号超过最近 10 条的旧植物识别结果。每轮成功保存算一条，同一会话的多轮结果各自计数。请在升级前复制需要另外保留的旧结果。

如果安装 1.0.0 时本机 3110 连接失败并回滚，直接安装当前版本。旧版启动入口比较了两种不同的路径，服务可能直接退出。新版支持通过安装程序使用的 current 符号链接启动。

下载[识植助手安装包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.13/plant-id-web-v1.0.13.tar.gz)，上传到阿里云服务器的 `/root/leaf-migration/`。在服务器管理员终端执行：

```bash
(
set -e
cd /root/leaf-migration
echo "0ea6e536fa138b06908f57a2dcbf7ae91f53809fcb2ddc7999a7146f3d00d48f  plant-id-web-v1.0.13.tar.gz" | sha256sum -c -
gzip -t plant-id-web-v1.0.13.tar.gz
PLANT_ID_INSTALL_DIR=$(mktemp -d /root/leaf-migration/plant-id-verified.XXXXXX)
tar -xzf plant-id-web-v1.0.13.tar.gz -C "$PLANT_ID_INSTALL_DIR"
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

识植助手和 OCR 取消站内每日识别次数限制。智谱或百炼仍可能按账户限制用量、并发或计费。本站默认同时处理最多两次模型识别。候选参考图通过服务器向 iNaturalist 查询，只发送公开学名和公开分类编号。页面标出实际照片的物种、作者、许可和原始观察。若图库无可靠匹配或服务器暂时无法访问图库，识别结果仍可查看。


## 图片文字识别

在识植助手顶部点击「文字识别」，或打开 `/plant-id/ocr`。登录后可上传一张不超过 5 MiB 的 JPG 或 PNG，提取并复制标签、包装或截图中的原文。OCR 与植物识别共用当前视觉服务。本站不保存 OCR 图片和结果。已有密钥和代理配置可继续使用。

## 识别结果格式提示

植物识别支持多种结构化返回格式，可从常见的代码块或附带说明中读取结构化结果，并接受整数百分数字符串。1.0.4 会将无法整理为候选卡片的可读回复作为纯文本展示。截断的回复会标明只显示部分内容。原文只显示在当前页，不写入历史。已有智谱模型和密钥可继续使用。每次提交只调用一次模型。

## 全球植物资料库

1.0.7 导入 World Flora Online 2026-06 名录，含 382,386 个接受种名、16,252 个属名、738 个科名及 608,087 条已解析异名关联。候选可展开查阅接受学名、科名和原始名录。食虫植物的补充形态资料及已有社区观察照常可查。

每轮识别会为候选提供中文植物描述，包括典型形态和有把握的生境。该描述由模型整理，与本轮照片证据分开。若找到匹配的公开文章摘要，还会附原文节选及许可。全球名录主要提供分类信息，描述覆盖受模型输出和公开来源影响。[资料来源与导入方式](../apps/plant-id/knowledge/README.md)

## 名称核对与种级细化

填写「已知名称或学名」可核对接受名、异名和俗名。若同一属内能找到唯一的近似种加词，会给出可能的拼写更正。缩写需要本轮或前一轮有可确定的属名。常见中文名优先查本地资料，专门填写的中文名可能发送至 iNaturalist 查询俗名。

「当前判定层级」反映模型认为现有证据支持的精度。可以在同一记录中补拍花、果、叶序或模型指出的关键部位，继续比较同属种。仅有名称而缺少个体证据时会保留待定。

## 启用 DSH 植物问答

首次启用植物问答时，安装识植助手后，在阿里云管理员终端执行。已启用 1.0.9 的服务器可在升级后直接复用现有运行时。

```bash
bash /opt/plant-id/current/deploy/install-dsh.sh
```

需要 Node.js 24.9 或更新版本和 npm。首次运行会下载固定版本的官方 DeepSeek Harness 及 SDK 依赖，测试环境安装后的依赖约 1.3 GiB。升级时相同版本可复用。如果安装后页面仍提示运行时加载失败，重新执行上面的脚本。新版会用网站服务账号验证 SDK 能否加载，失败时在终端显示原因。看到「识植助手的 DSH 问答已启用」后刷新网页，打开「植物问答」，或从候选卡片点击「询问这株植物」。

用户只需选择服务商。网站会使用该平台预设的模型。第一次使用某家服务商时，填写该平台签发的 API Key 并发送问题。支持 DeepSeek、智谱开放平台、阿里云百炼中国内地站、硅基流动中国内地站、OpenAI，以及管理员配置的兼容网关。问答按所选服务商和用户账号计费。服务端所在网络需要能访问所选接口。识别和 OCR 继续使用原有视觉配置。

首次成功回答后，密钥按识植助手账号与服务商加密保存。下次登录或换设备，可以直接提问。要主动修改时点「更换密钥」，用新密钥成功回答后更新保存记录。服务商明确拒绝已保存的密钥时，网页会提示重新填写。额度不足或暂时连接不上时保留原密钥。切换服务商或关闭窗口会清除当前对话和未保存的输入。

密钥密文保存在应用数据库，加密用的文件是 `/var/lib/plant-id/ask-credentials.key`。迁移时需一并保存这两个文件，并限制访问权限。服务端为每次问答建立临时工作目录，处理结束后删除。各服务商的回答均可使用共享植物资料。

### 智谱问答

智谱问答默认用 `glm-4.7-flash`，以关闭思考模式的方式生成可显示的回答。智谱返回模型繁忙（1305）或模型不存在（1211）时，站点会自动尝试一次 `glm-4.5-flash`。账号额度、欠费、模型权限和密钥错误会分别提示。模型调用权限和用量由智谱开放平台账号决定。 [智谱错误码](https://docs.bigmodel.cn/cn/api/api-code)

### 添加其他兼容服务商

管理员可在 `/etc/plant-id.env` 添加 `PLANT_ID_ASK_GATEWAYS`。网关需使用受信任的 HTTPS 公网地址，支持 OpenAI Chat Completions 的流式响应和 Bearer 密钥认证。将下面的域名和模型替换为服务商提供的接口地址和模型标识，再运行 `systemctl restart plant-id`。用户刷新后可在问答窗口选择新服务商，并填写自己的 Key。

```ini
PLANT_ID_ASK_GATEWAYS='[{"id":"custom-example","label":"示例网关","baseURL":"https://gateway.example.com/v1","model":"vendor/model"}]'
```

### 共享资料库插件

网站用户可直接使用网页，无需安装本地工具。有自己 DSH 环境的人也可下载[共享植物资料库插件](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.9/plant-knowledge-dsh-v1.0.0.tar.gz)，按包内说明把公共资料库挂进自己的配置。这个连接只提供公开、只读的名录检索。运营者可按[资料库导入流程](../apps/plant-id/knowledge/README.md)维护和部署自己的共享索引，所有已连接的用户自动读取新版资料。用户的私有账号资料不在 MCP 的读取范围内。

## 本次验证范围

26 项自动测试通过，覆盖问答密钥的账号与服务商隔离、加密保存、重启复用、更换和失效。另用真实 DSH 运行时和模拟模型服务检查了智谱回答正文、模型繁忙时的备用调用、欠费和鉴权失败，通过移动尺寸浏览器验证了问答表单。安装包内文件校验通过。模型测试使用模拟接口，目标服务器仍需部署后实测。
