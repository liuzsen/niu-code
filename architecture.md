# Zsen Claude Code Web 架构设计

## 项目概述

基于 Vue3 + Node.js 的 Claude Code Web UI 版本，提供比命令行更好的交互体验。

## 核心技术栈

### 前端

- Vue3 + TypeScript + Vite
- PrimeVue (UI 组件库)
- Monaco Editor (代码编辑)
- WebSocket (实时通信)

### 后端

- Node.js + Express
- @anthropic-ai/claude-code SDK
- WebSocket

## 架构设计

### Claude Code SDK 集成

```typescript
import { query } from "@anthropic-ai/claude-code";

class ClaudeSession {
  private messageQueue: Array<UserMessage> = [];
  private currentResolver: Function | null = null;

  async start(initialPrompt: string, cwd: string) {
    const stream = query({
      prompt: this.createPromptGenerator(initialPrompt),
      options: {
        cwd,
        canUseTool: this.handleToolPermission,
        maxTurns: 100,
        stderr: (data) => this.emit("stderr", data),
      },
    });

    for await (const message of stream) {
      this.emit("message", message);
    }
  }

  private async *createPromptGenerator(initialPrompt: string) {
    // 发送初始消息
    yield {
      type: "user",
      message: { role: "user", content: initialPrompt },
      session_id: "",
      parent_tool_use_id: null,
    };

    // 等待后续用户输入
    while (true) {
      const userMessage = await this.waitForUserInput();
      yield userMessage;
    }
  }

  private async waitForUserInput(): Promise<UserMessage> {
    return new Promise((resolve) => {
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift()!);
      } else {
        this.currentResolver = resolve;
      }
    });
  }

  addUserMessage(content: string) {
    const message = {
      type: "user",
      message: { role: "user", content },
      session_id: "",
      parent_tool_use_id: null,
    };

    if (this.currentResolver) {
      this.currentResolver(message);
      this.currentResolver = null;
    } else {
      this.messageQueue.push(message);
    }
  }
}
```

### 工具权限处理

```typescript
private async handleToolPermission(toolName: string, toolInput: any, suggestions: any) {
  // 发送工具权限请求到前端
  const permission = await this.requestToolPermission(toolName, toolInput);

  return {
    behavior: permission.allowed ? "allow" : "deny",
    updatedInput: toolInput,
    updatedPermissions: []
  };
}
```

## 前后端通信协议

### WebSocket 消息类型

```typescript
// 前端 -> 后端
interface ClientMessage {
  type: "user_input" | "tool_permission_response" | "start_session";
  data: any;
}

// 后端 -> 前端
interface ServerMessage {
  type:
    | "claude_message"
    | "tool_permission_request"
    | "error"
    | "session_started";
  data: any;
}
```

## 关键技术挑战

### 1. 多轮对话管理

- 使用 async generator 实现连续对话
- 消息队列处理用户输入
- 状态同步机制

### 2. 工具权限 UI

- 实时弹窗确认工具执行
- 批量权限设置
- 权限记忆功能

### 3. 用户体验增强

- @ 文件引用自动补全
- Slash 命令快捷输入
- 实时代码高亮
- 流式响应显示

## 开发阶段

### Phase 1: 基础框架 (1-2 周)

- 项目初始化 (Vue3 + Express)
- WebSocket 连接建立
- 基础 UI 布局
- SDK 基础集成

### Phase 2: 核心功能 (2-3 周)

- Claude 对话功能
- 工具权限系统
- 消息队列机制
- 基础文件引用

### Phase 3: 交互优化 (2-3 周)

- Slash 命令系统
- 智能补全功能
- 流式响应优化
- 错误处理完善

### Phase 4: 视觉体验 (1-2 周)

- 科技感主题设计
- 动画和过渡效果
- 响应式布局
- 性能优化

## 项目结构

```
zsen-cc-web/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── claude-session.ts
│   │   │   └── websocket.ts
│   │   ├── routes/
│   │   └── app.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel/
│   │   │   ├── ToolPermission/
│   │   │   └── SlashCommands/
│   │   ├── stores/
│   │   ├── services/
│   │   └── main.ts
│   └── package.json
└── shared/
    └── types.ts
```
