修复旧数据存在不同上级的同名分类时，“只删除当前节点”被重复检查阻止的问题。删除按完整路径定位，保留其他分支；提升后完整路径相同的节点汇总参考图并保留全部植物。

保留另一套分类、照片、坐标、账号隔离、版本检查与事务回滚；新增分类仍检查重复。140 项自动测试通过。

[服务器安装步骤](https://github.com/yunjunyisg/leaf-archive/blob/main/docs/taxonomy-duplicate-deletion-fix.md)。安装后生效，网页刷新、Windows／安卓软件重开即可。
