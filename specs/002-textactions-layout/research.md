# Phase 0 Research — TextActions 工具栏与输入栏交互优化

## 决策 1：句子级操作以内联按钮呈现
- **Decision**: 使用句子下方的内联按钮（小型图标 + 文字），替代 BottomBar。加载状态时显示旋转图标并禁用。
- **Rationale**: 降低视线移动距离，符合富文本编辑器常见交互模式；移除 BottomBar 可简化布局并减少重复状态同步。
- **Alternatives considered**:
  - BottomBar 保留但压缩高度：仍需视线下移，体验未根本改善。
  - Hover 弹出工具条：移动端体验不佳且 hover 状态不稳定。

## 决策 2：翻译文本与操作按钮的层级关系
- **Decision**: 选中句子时的布局顺序固定为「句子 → 翻译文本 → 操作按钮」，并控制外边距，避免互相遮挡。
- **Rationale**: 确保翻译内容保持可读；操作按钮置于翻译下方可保持上下文连续性。
- **Alternatives considered**:
  - 操作按钮位于翻译上方：按钮与句子距离过远，用户需上下搜索。
  - 使用左右分栏：在窄屏下易引发布局压缩。

## 决策 3：InputBar 文本框自适应高度策略
- **Decision**: 采用基于 scrollHeight 的自动增高方案，最小高度 38px，最大高度 220px；超出部分滚动显示，发送成功后重置高度。
- **Rationale**: 保持输入体验流畅，同时限制占用空间；220px 约等于 7–8 行，可覆盖大部分输入场景。
- **Alternatives considered**:
  - 无上限自适应：会挤压主内容区，影响阅读体验。
  - 固定高度 + 显式“展开”按钮：交互步骤更多。

## 决策 4：可访问性与键盘操作支持
- **Decision**: 保留 `Enter` 发送、`Shift+Enter` 换行的逻辑；内联按钮使用 `button` 元素并提供 `aria-label`（对于图标按钮）。
- **Rationale**: 维持原有键盘体验，兼容屏幕阅读器；同时满足章程要求的跨平台及简洁实现。
- **Alternatives considered**:
  - 自定义键位：与用户习惯不符。
  - 使用 div 冒充按钮：可访问性差。
