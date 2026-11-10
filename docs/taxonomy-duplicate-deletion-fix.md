# 修复历史同名分类阻止删除

适用于主站 https://gloriouscarnivorousplants.top 的独立服务器。

## 修复内容

旧数据可能同时包含根级“狸藻科”和“木兰纲”下的“狸藻科”。上一版删除“唇形目”并保留下级时，误用了新增分类的全局重名检查，因此即使用户正在清理旧数据也无法删除。

- “只删除当前节点”按完整路径处理，不再因其他上级下存在同名分类而拒绝；保留并提升原下级。
- 同名但上级不同的其他分支保留，不全局按名称删除。
- 提升后的完整路径与已有节点相同时，共用该节点，并汇总该路径全部手动记录的参考图；保留全部关联植物，不复制植物档案。
- “同时删除所有子节点”仍只处理选中的完整分支；植物只解除当前体系分类，档案和图片文件保留。
- 另一套分类、照片、价格和坐标精度保留。仍保留账号隔离、快照版本、事务回滚和必要层级检查；不会关闭新增分类时的重复检查。

## 安装

下载[修复包](https://github.com/yunjunyisg/leaf-archive/releases/download/taxonomy-delete-fix-v1.7.1/leaf-archive-taxonomy-delete-fix-v1.7.1.tar.gz)，上传到服务器 `/root/leaf-migration/` 后执行：

```bash
(
set -e
cd /root/leaf-migration
echo "28efc58991fc2ba9d98f2e09729ac74ebf99cf918b69623788ab0fe0be9130ce  leaf-archive-taxonomy-delete-fix-v1.7.1.tar.gz" | sha256sum -c -
gzip -t leaf-archive-taxonomy-delete-fix-v1.7.1.tar.gz
UPDATE_DIR=$(mktemp -d /root/leaf-migration/taxonomy-delete-fix.XXXXXX)
tar -xzf leaf-archive-taxonomy-delete-fix-v1.7.1.tar.gz -C "$UPDATE_DIR"
(cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
bash "$UPDATE_DIR/deploy/apply-standalone-update.sh"
)
```

包含当前独立程序、运行层及公开资源，复用并校验已装全球边界，不导入或替换数据库。无需先装上一版。安装成功后刷新网页或关闭重开 Windows／安卓软件，无需重装软件；请先保存其他编辑草稿。

当前环境没有服务器执行连接，因此发布代码和修复包不代表主站已安装。

## 验证

140 项自动测试通过。新增回归覆盖 APG IV／ITIS 在不同上级下有历史同名分支时仍可删除、另一分支和其他账号不被改动、完整路径重合后只保留一份手动节点及全部参考图、植物和另一套分类保留，以及合并中途失败时全部回滚。本次为服务端修复，未宣称已在主站或用户设备验收。
