// BottomBar 组件已被句子内联操作区取代，保留文件以避免潜在引用错误。
export default function BottomBar() {
  if (import.meta.env.DEV) {
    console.warn('[BottomBar] 已弃用，请改用 TextDisplay 内联操作按钮');
  }
  return null;
}
