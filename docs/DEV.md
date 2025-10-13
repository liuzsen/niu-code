### 后端 (Rust + Actix-web)

- **Actix-web** HTTP/WebSocket 服务器,用于实时通信
- **cc-sdk** crate:对 Claude Code CLI 的自定义 Rust 封装
- **server** crate:会话管理、文件监控和消息路由
- **嵌入式前端**:使用 rust-embed 将静态文件构建到二进制文件中

### 前端 (Vue3 + TypeScript)

- **Vue 3** 组合式 API
- **PrimeVue** 组件库,配合自定义 Tailwind CSS v4 样式
- **TipTap** 富文本编辑器及自定义扩展
- **Pinia** 状态管理
- **Mermaid** Markdown 图表支持

### 前置要求

- **Rust** 1.70 或更高版本
- **Node.js** 18 或更高版本
- **pnpm** 10.x

### 设置

```bash
# 克隆仓库
git clone https://github.com/liuzsen/niu-code.git
cd niu-code

# 安装前端依赖
cd frontend
pnpm install

# 构建前端
pnpm run build

# 构建后端
cd ../backend
cargo build --release
```

### 开发工作流

**终端 1 - 前端:**

```bash
cd frontend
pnpm run dev
```

**终端 2 - 后端:**

```bash
cd backend
cargo run
```

前端开发服务器会将 `/api` 请求代理到后端。

### 代码质量检查

```bash
# 前端
cd frontend
pnpm run check  # TypeScript 检查 + ESLint
pnpm run lint   # 仅 ESLint

# 后端
cd backend
cargo check     # 检查所有 workspace crate 的类型
cargo test      # 运行测试
```

## 项目结构

```
.
├── backend/                 # Rust 后端 (Cargo workspace)
│   ├── src/
│   │   ├── main.rs         # 服务器入口点
│   │   ├── api.rs          # HTTP/WebSocket 路由
│   │   └── embedded.rs     # 静态文件服务
│   ├── cc-sdk/             # Claude Code CLI 封装
│   └── server/             # 核心业务逻辑
├── frontend/               # Vue3 前端
│   ├── src/
│   │   ├── components/    # Vue 组件
│   │   ├── stores/        # Pinia stores
│   │   ├── services/      # API 客户端
│   │   └── composables/   # 组合式函数
│   └── dist/              # 构建输出(嵌入到二进制文件)
├── scripts/               # 安装脚本
│   ├── install.sh        # Linux/macOS 安装器
│   ├── install.ps1       # Windows 安装器
│   ├── systemd/          # systemd 服务模板
│   └── launchd/          # launchd plist 模板
└── .github/workflows/    # CI/CD 工作流
```
