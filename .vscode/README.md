# VSCode 调试配置

本项目已配置了完整的VSCode调试环境，用于调试SentenceLens的服务端和Electron应用。

## 调试配置

### 可用调试配置

1. **Debug Server** - 调试Express服务器
   - 启动服务器并附加调试器
   - 端口: 9229
   - 适用于一般的服务端调试

2. **Debug Server with Breakpoints** - 带断点的服务器调试
   - 启动时暂停等待调试器连接
   - 端口: 9230
   - 适用于需要从一开始就调试的情况

3. **Debug Electron Main** - 调试Electron主进程
   - 调试main.js中的代码
   - 端口: 9231
   - 适用于Electron应用逻辑调试

4. **Attach to Server** - 附加到运行中的服务器
   - 连接到已启动的服务器进程
   - 端口: 9229
   - 适用于服务器已运行时的调试

5. **Debug OCR Processing** - 调试OCR图像处理服务
   - 专门调试imageProcessor.js
   - 端口: 9232
   - 适用于图像处理相关问题的调试

6. **Debug Translation Service** - 调试翻译服务
   - 专门调试translation.js
   - 端口: 9233
   - 适用于翻译相关问题的调试

### 复合调试配置

- **Debug Full App (Server + Electron)** - 调试服务器（Electron需要手动启动）
  - 启动服务器调试会话
  - Electron应用需要手动启动（使用 `npm start`）
  - 适用于同时调试前后端

## 使用方法

### 1. 启动调试

在VSCode中：

1. 打开调试面板 (Ctrl+Shift+D)
2. 从下拉菜单选择调试配置
3. 点击绿色播放按钮或按F5

### 2. 设置断点

在代码中：

- 点击行号左侧设置断点
- 使用条件断点：右键行号 → "Add Conditional Breakpoint"
- 使用日志断点：右键行号 → "Add Logpoint"

### 3. 调试控制

- **F5**: 开始调试
- **F10**: 单步跳过
- **F11**: 单步进入
- **Shift+F11**: 单步跳出
- **F9**: 切换断点
- **Ctrl+F5**: 重新开始调试

## 调试任务

在VSCode中按Ctrl+Shift+P，输入"Tasks: Run Task"可选择以下任务：

- **Start Server for Debugging** - 启动服务器调试模式 (端口9230)
- **Start Electron with Debug** - 启动Electron应用
- **Build Frontend** - 构建前端代码
- **Install Dependencies** - 安装依赖
- **Run Tests** - 运行测试
- **Debug: Start Server Only** - 仅启动服务器调试 (端口9229)
- **Debug: Launch Electron App** - 启动Electron应用 (自动构建前端)

## 端口分配

为了避免端口冲突，不同调试配置使用不同端口：

- **9229**: 服务器调试 (Debug Server)
- **9230**: 服务器断点调试 (Debug Server with Breakpoints)
- **9231**: Electron主进程调试 (Debug Electron Main)
- **9232**: OCR处理调试 (Debug OCR Processing)
- **9233**: 翻译服务调试 (Debug Translation Service)

## 调试技巧

### 服务器调试

1. **API端点调试**: 在路由处理函数中设置断点
2. **数据库操作**: 在数据库查询前后设置断点检查数据
3. **中间件调试**: 在Express中间件中设置断点
4. **错误处理**: 在catch块中设置断点查看错误详情

### 常用调试场景

```javascript
// 在server/app.js中设置断点调试API请求
app.post("/api/records/:id/text/edit", async (req, res) => {
  try {
    // 在这里设置断点查看请求数据
    const { text } = req.body;
    const recordId = req.params.id;

    // 调试文本编辑逻辑
    const result = await handleTextEdit(recordId, text);

    res.json(result);
  } catch (error) {
    // 在这里设置断点查看错误
    console.error("Text edit error:", error);
    res.status(500).json({ error: error.message });
  }
});
```

### 调试环境变量

调试配置会自动设置以下环境变量：

- `NODE_ENV=development`
- `DEBUG=*` (仅在Debug Server with Breakpoints中)

## 故障排除

### 常见问题

1. **端口被占用**:
   - 检查端口分配表
   - 关闭其他调试会话
   - 修改launch.json中的端口号

2. **调试器无法连接**:
   - 确保防火墙允许本地连接
   - 检查端口是否正确

3. **断点不生效**:
   - 检查源码映射和文件路径
   - 确保文件路径正确

4. **Electron调试失败**:
   - 使用 `npm start` 手动启动Electron
   - 确保前端已构建
   - 检查electron路径

5. **复合调试失败**:
   - 确保端口不冲突
   - 先启动服务器调试，再手动启动Electron
   - 检查任务依赖

### 调试日志

调试输出会显示在：

- **Debug Console**: VSCode内置调试控制台
- **Terminal**: 集成终端输出
- **Output Panel**: 选择"Debug"输出通道

## 推荐调试流程

### 1. 仅调试服务器

使用 "Debug Server" 配置，端口9229

### 2. 仅调试Electron

使用 `npm start` 手动启动，然后使用 "Debug Electron Main" 调试主进程

### 3. 调试完整应用

1. 使用 "Debug Server" 启动服务器调试
2. 手动运行 `npm start` 启动Electron
3. 使用 "Debug Electron Main" 调试Electron主进程

### 4. 调试特定服务

- OCR问题: "Debug OCR Processing"
- 翻译问题: "Debug Translation Service"

## 性能调试

对于性能问题，可以使用：

- **CPU Profiling**: 在调试时启用性能分析
- **Memory Profiling**: 检查内存使用情况
- **Network Tab**: 查看网络请求（如果使用浏览器调试）

## 热重载

服务端代码修改后需要手动重启调试会话。可以使用VSCode的自动重启功能：

```json
"restart": true  // 在launch.json中配置
```

## 修复的问题

- 端口冲突问题：每个调试配置使用独立端口
- Electron启动问题：简化配置，使用npm start手动启动
- 任务依赖：确保前端构建后再启动Electron
- 复合调试：简化为仅调试服务器，Electron手动启动

## 注意事项

由于VSCode调试器在Windows环境下直接执行Electron存在兼容性问题，推荐使用以下方式：

1. **服务器调试**: 使用VSCode调试配置
2. **Electron调试**: 使用 `npm start` 手动启动，然后使用 "Debug Electron Main" 进行主进程调试

这种方式虽然需要手动启动Electron，但更稳定可靠。
