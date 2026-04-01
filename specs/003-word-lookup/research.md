# Research Notes: 单词查询弹窗

## 1. 前端交互与事件处理
- **Decision**: 句子渲染时按空格/标点拆分为单词 `<span>`，在 `dblclick` 事件中阻止默认单击逻辑（使用 `event.preventDefault()` + `event.stopPropagation()`），并通过延迟触发方式避免与单击选句冲突。
- **Rationale**: React 19 在浏览器环境下对 `dblclick` 支持稳定；通过 `setTimeout` 延迟执行单击回调并在 `dblclick` 时清除，可兼容触摸板双击。
- **Alternatives**: 
  1. 基于 `selectionchange` 的文本选中检测 —— 难以精准定位单词，且与句子选择冲突。
  2. 在浏览器 Selection API 基础上识别鼠标释放区间 —— 对标点处理复杂，放弃。

## 2. 连字符与标点处理
- **Decision**: 在拆分单词时使用正则 `/[\p{L}\d'-]+/u` 匹配单词单元，对 `well-known`、`don't` 保留原样；API 请求前再调用 `normalize('NFC')` 并转小写。
- **Rationale**: 确保连字符词组整体查词，兼顾包含撇号/数字的单词。
- **Alternatives**: 单纯按空格 split —— 会拆散连字符词；逐字符遍历 —— 实现复杂且与 i18n 兼容性低。

## 3. 弹窗定位方案
- **Decision**: 使用现有 React Portal（`createPortal`）到 `document.body`，结合 `getBoundingClientRect()` 获取单词位置并在视口边缘时自动调整（上下翻转 + X 轴裁剪）。无需新增独立 `OverlayPortal` 文件，直接在弹窗组件内部创建。
- **Rationale**: 减少额外组件，直接与弹窗组件耦合更易维护。
- **Alternatives**: 新增 `OverlayPortal.tsx` 封装 —— 对当前场景价值不大；使用第三方浮层库 —— 引入额外依赖且不符“简洁”原则。

## 4. 本地词库格式选择
- **Decision**: 采用 ECDICT SQLite 版本（约 45MB），运行时通过 sql.js 只读查询。
- **Rationale**: SQLite 结构化、索引支持良好，可在 Electron 中直接加载；开源许可宽松（CC BY-SA 3.0）。
- **Alternatives**: JSON 版 ECDICT —— 解析耗时且占用内存较大；选择其他词库（如 WordNet） —— 中文释义缺失。

## 5. 词库部署与打包
- **Decision**: 词库随安装包分发，放置于 `extraResources/dictionary/ecdict.db`，应用启动时检测用户数据目录是否存在；若无则复制。
- **Rationale**: 满足离线优先原则；复制到用户数据目录便于后续更新或替换。
- **Alternatives**: 首次运行在线下载 —— 与离线要求冲突；直接放入 asar —— SQLite 文件不宜压缩打包。

## 6. LLM 兜底策略
- **Decision**: 当词库查询无结果时，调用现有 LLM 服务以“词典释义”提示模板获取结构化数据，成功后写入 `word_definitions` 表并标记来源 `llm`。
- **Rationale**: 统一缓存路径，与本地结果共享接口。
- **Alternatives**: LLM 结果只保留在内存 —— 重复调用成本高；存入单独文件 —— 增加管理复杂度。

## 7. 缓存与过期
- **Decision**: 服务端 `word_definitions` 表记录 `updated_at`，前端保留一个生命周期内的内存缓存；默认缓存 7 天后允许自动刷新（超时后请求仍返回旧值并异步刷新）。
- **Rationale**: 兼顾性能与数据更新；对高频查词响应快。
- **Alternatives**: 永不过期 —— 无法吸收最新释义；纯前端缓存 —— 多设备/多窗口不共享。

## 8. 性能与测量
- **Decision**: 后端记录词库和 LLM 查询耗时（日志），前端在手动测试中使用 DevTools Performance 面板记录首次查词耗时，确保符合 SC-001。
- **Rationale**: 提供量化依据支撑成功指标。
- **Alternatives**: 仅凭主观感受 —— 无法验证 2 秒目标。
