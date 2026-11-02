# 分类树与产地地图新增、编辑无响应修复

主站：https://gloriouscarnivorousplants.top。

## 问题与修复

分类树和产地地图仍使用旧版植物表单，而共用脚本已经增加杂交种相关交互。旧表单缺少 `speciesLabel` 节点和杂交种选项，新增或编辑时触发脚本错误，编辑窗口不能正常打开；网页和连接主站的软件都会受到影响。

本次将收藏、分类树、产地地图的植物编辑表单同步，恢复新增植物、档案详情中的编辑、地图未定位植物的编辑及产地位置选择。已有杂交种打开编辑时保留正确类别，保存继续使用原有版本冲突检查与账号隔离。

增加构建检查：三个页面的编辑表单不一致时拒绝构建，并增加原生 Node 与 Worker 页面一致性的回归测试，避免以后只改动收藏页面而再次遗漏其他页面。

不更改用户数据库，不删除植物、照片、价格、日志或坐标；保留此前的地图与低内存优化。

## 安装

下载[修复更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/editor-fix-v1.4.1/leaf-archive-editor-fix-v1.4.1.tar.gz)，上传到 `/root/leaf-migration/`，在服务器终端执行：

```bash
install -d -m 700 /root/leaf-migration/editor-fix-v1.4.1
tar -xzf /root/leaf-migration/leaf-archive-editor-fix-v1.4.1.tar.gz -C /root/leaf-migration/editor-fix-v1.4.1
bash /root/leaf-migration/editor-fix-v1.4.1/deploy/apply-standalone-update.sh
```

此包包含当前完整程序及配套公开资源，复用已经安装的全球边界；安装前校验程序、资源及边界，失败会停止或恢复旧程序，保留用户数据。若提示未安装全球边界或版本不符，请先按[全球地图说明](global-map-update.md)安装完整边界，再应用本包。

安装后刷新网页，Windows 与安卓关闭后重新打开即可，无需重装软件。必须更新编译程序，不能只上传 HTML 文件或单独替换入口文件。

当前开发环境未配置目标服务器的执行连接，因此源码发布与服务器安装是两个步骤；需在服务器执行上述安装后主站才会生效。

## 验证

九十一项自动测试通过。修复前已在浏览器复现两个页面点击新增后编辑窗口不打开，并出现空节点脚本错误。

修复后使用真实 Chromium 浏览器分别检查普通网页、Windows 软件使用的页面标识、安卓 WebView 标识与手机尺寸，共六个页面场景：新增杂交种、打开及取消产地选择、保存新档案、编辑原档案、保存及刷新读取均通过；原价格、杂交种类别和精确坐标保留，无页面脚本异常。产地地图“定位产地”编辑入口也可正常打开。

这是本地浏览器与页面模式检查，尚未在用户实际设备及主站完成安装后验收。
