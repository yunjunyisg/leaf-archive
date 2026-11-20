# 识植助手 · Plant ID (DSH Agent Preset)

一个可安装的 DeepSeek Harness **Agent 预设**：把「识植助手」从一段对话里的提示词，变成这个
profile 里随时可切换、也可分享给别人的智能体。

## 它是什么

- 一个 `@deepseek-ai/dsh-agent-preset` 声明（`cordis.patch.yml`），id 为 `plant-id`，显示名「识植助手」。
- 自带系统人格：识别流程、「照片中可见 / 用户描述 / 推测」三分、候选排序 + 概率 + 区分方法、
  补拍建议、食用/药用/宠物安全边界。
- 自带工具集：读文件与读图（`read_image`）、文件检索、网页搜索与抓取、提问工具、基础上下文压缩。
- 不含 shell、写入类工具：识植物不需要改你的文件。

## 本机安装（已完成）

```powershell
# 在本仓库目录外执行均可；target 指向这个目录的绝对路径
# 通过 agent 工具：plugin_manager(install_bundle, target="<abs path to this dir>")
```

安装后验证：

```powershell
# 通过 agent 工具：plugin_manager(list_plugins, offset=190)
# 期望看到 patchId=preset-plant-id、enabled=true、fiberPhase=active
```

## 给别人用

这个目录是一个标准 DSH bundle，三件事就能复用：

1. 把 `plant-id-agent/` 整个目录发过去（或推到 git / npm）。
2. 对方执行 `plugin_manager` 的 `install_bundle`，target 指向该目录。
3. 重启/刷新后，新会话的 Agent 列表里出现「识植助手」。

别人装同一份 bundle 即得到同一套人格与工具，互不影响各自的会话与其它预设。

## 照片直读的前提（已实测）

`dsh-tool-fs` 的 `readImage: true` 让预设自带 `read_image`；在默认 `deepseek-flash` 会话里实测可用：
图片以 image block 回传给模型，助手能描述画面并据此作答，不会退化成「看不到图」。

- 想更强：会话里改用视觉模型路由（`dsh-vision-router` 的「👁 识图」）。
- 会话确实没有看图能力时，人格要求它明说「当前无法查看图片」，请你改用文字描述，而不是硬猜。

## 自检记录（2026-11-20）

| 项 | 方式 | 结果 |
|---|---|---|
| 预设装得上、能激活 | `plugin_manager` → `fiberPhase: active` | 通过 |
| 人格真的进系统提示 | 任务卡跑一轮，解码会话日志 | 通过：`agentPreset: plant-id`，system prompt 含完整识别规则 |
| 照片真的能看 | 任务卡读 `samples/sample-01.jpg` | 通过：调用 `read_image`，识别为蒲公英属（55%），表格概率合计 100% |

`samples/sample-01.jpg` 为自检用图，来源 Wikimedia Commons（DandelionFlower.jpg），仅作回归测试。

## 结构

```
plant-id-agent/
├── package.json        # dsh.bundle.patch 指向 cordis.patch.yml
├── cordis.patch.yml    # preset-plant-id 声明：persona + 工具列表
└── README.md
```

## 改人格

编辑 `cordis.patch.yml` 里 `plant-id-persona` 行的 `config.prefix`，保存后通过
`plugin_manager` 重新 `install_bundle` 同一目录即可生效；已开的会话保留旧 revision，
**新开会话**才用新人格。
