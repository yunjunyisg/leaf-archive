# 分类选项列表滚动与遮挡修复

主站：https://gloriouscarnivorousplants.top。

## 修复

原先列表位于植物表单的滚动容器内，长列表可能被容器边缘或底部按钮裁掉。本次改成位于当前编辑弹窗内的独立浮层，按可见空间定位和限制高度。

- 列表内部可用鼠标滚轮或手机手指上下滑动，不带动整个表单滚动。
- 标题和关闭按钮、底部“显示更多”保持可见，中间选项区域独立滚动。
- 长列表分批显示，展开更多后保留滚动位置；全部展开后隐藏“显示更多”。
- 弹窗下方空间不足时向上展开；小视窗或软键盘改变可见区域时重新计算位置。滚动表单让对应输入框离开可见范围时关闭浮层，避免悬浮在错误位置。
- 保留片段筛选、键盘选择、当前账号隔离和原有保存逻辑。收藏、分类树、产地地图以及分类树名称输入均使用同一修复。

不修改用户档案、分类、价格、照片或坐标，保留低内存和地图优化。

## 安装

下载[滚动修复更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/taxonomy-scroll-v1.5.1/leaf-archive-taxonomy-scroll-v1.5.1.tar.gz)，上传到 `/root/leaf-migration/` 后执行：

```bash
install -d -m 700 /root/leaf-migration/taxonomy-scroll-v1.5.1
tar -xzf /root/leaf-migration/leaf-archive-taxonomy-scroll-v1.5.1.tar.gz -C /root/leaf-migration/taxonomy-scroll-v1.5.1
bash /root/leaf-migration/taxonomy-scroll-v1.5.1/deploy/apply-standalone-update.sh
```

包含当前完整程序及公开资源，复用已安装的全球边界。程序、资源及边界会先校验；失败停止或回滚，保留用户数据库和照片。若提示缺少全球边界，先按[全球地图说明](global-map-update.md)安装完整边界。

安装后刷新网页或重开 Windows、安卓软件即可，无需重装软件。开发环境没有目标服务器的执行连接，需在服务器安装后主站才会生效。

## 验证

一百项自动测试通过，新增检查包括上下展开、左右边界、短视窗和空间不足时的浮层高度约束。

使用真实 Chromium 浏览器及含九十五个测试属名的长列表，分别检查三个页面的桌面滚轮、移动 WebView 标识和触摸事件滑动：列表内部滚动、表单位置保持、展开更多、选择靠后名称均通过，并核对选项中心点没有被其他元素覆盖。另检查分类树名称输入和缩小手机视窗时的浮层位置，没有页面脚本异常。

以上是本地浏览器与触摸事件检查，实际设备及主站仍需安装后验收。
