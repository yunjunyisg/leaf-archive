# 分类树编辑、删除与杂交种更新

主站：https://gloriouscarnivorousplants.top。

## 本次修改

- 杂交种、种、未定种均为种级单位，杂交种不放在种下。杂交名称或亲本组合填写在种名栏，例 `Nepenthes lowii × veitchii`。支持该节点的参考图与地图独立分类；已有档案不自动重分类。当前杂交种节点暂不混接变种等下级分类。
- 个人分类树的所有节点均提供“编辑分类”“删除分类”，包括手动建立及档案自动生成的节点。示例分类保持只读。
- 编辑可修改名称、层级及上级。改名或移动会同步更新下级分类和关联植物的分类字段，保留档案其他内容。目标分类已存在、移动到自己的下级、下级层次不兼容时拒绝操作。
- 删除前提示影响范围，删除该分支的分类记录及参考图关联；植物档案、价格、日志、原始产地坐标和照片文件保留。关联植物移入“未分类植物”，可点击“重新归类”填写分类后恢复。
- 操作按账号隔离，管理员的个人分类接口仍关闭。采用事务与快照版本检查；其他设备有新修改时要求刷新，异常则整体回滚。分类变更会更新关联档案修订号，旧编辑不能覆盖新分类。

## 安装网站更新

Windows 和安卓软件无需重装。本次涉及页面、校验与接口，必须安装完整包，不能只替换独立运行层。

下载 [完整更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/taxonomy-20261031-v1/leaf-archive-taxonomy-20261031-v1.tar.gz)，上传至服务器 `/root/leaf-migration/`，在服务器终端执行：

```bash
install -d -m 700 /root/leaf-migration/taxonomy-update
tar -xzf /root/leaf-migration/leaf-archive-taxonomy-20261031-v1.tar.gz -C /root/leaf-migration/taxonomy-update
bash /root/leaf-migration/taxonomy-update/deploy/apply-standalone-update.sh
```

安装脚本同时备份并更新页面及接口编译模块与独立运行层，运行检查失败会一起恢复旧程序，不覆盖用户数据库。安装过程不修改已有分类，不删除任何档案。

完成后点击“植藏”刷新，或关闭并重新打开软件。在个人分类树节点下可看到编辑与删除按钮。代码同步、发布更新包与服务器安装是不同步骤；当前构建环境未配置直接执行目标服务器命令的连接。

## 构建与验证

```bash
npm test
node scripts/package-runtime-update.mjs /absolute/path/leaf-archive-taxonomy-update.tar.gz --with-core
```

包内包括 `dist/server/index.js`、`standalone/`、更新脚本及文件校验清单；不包含数据库、个人照片或签名私钥。未改动既有数据库迁移文件。
