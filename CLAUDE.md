# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack web application providing a web UI for Claude Code, offering better interaction experience than command line. The project uses **Rust (Actix-web)** for the backend and **Vue3** for the frontend, with a custom Rust SDK wrapper around the @anthropic-ai/claude-code CLI.

## Development Commands

### Backend (Rust + Actix-web)

```bash
cd backend
cargo check              # Type check all workspace crates
cargo build              # Build the backend binary
cargo run                # Run the backend server (port 33333)
```

The backend is a Cargo workspace with 3 crates:
- `backend` - Main binary crate (Actix-web server)
- `cc-sdk` - Rust wrapper around Claude Code CLI
- `server` - WebSocket/HTTP server implementation

### Frontend (Vue3 + Vite + TypeScript)

```bash
cd frontend
pnpm install
pnpm run check        # Type check + lint
pnpm run lint         # ESLint check
pnpm run build        # Production build
```

### Project Setup

- Backend uses **Cargo workspace** (Rust 2024 edition)
- Frontend uses **pnpm** as package manager (pnpm@10.15.1)
- Backend server runs on port **33333** by default
- Frontend dev server runs on port 5173 (Vite default)

## Claude Usage Rules

- **Claude is prohibited from starting development servers** using commands like `pnpm run dev`, `cargo run` or similar. Development servers must be started manually by humans.

## Architecture

### Backend Architecture (Rust)

The backend is built with **Rust** using a workspace structure:

- **Actix-web HTTP/WebSocket server** - Real-time bidirectional communication with frontend
- **cc-sdk crate** - Custom Rust wrapper around the Claude Code CLI (`@anthropic-ai/claude-code`)
  - Spawns and manages the Node.js Claude Code CLI process
  - Handles stdin/stdout communication via JSON streaming
  - Implements `PromptGenerator` trait for async message generation
  - Provides `QueryStream` for consuming Claude responses
- **server crate** - Core business logic
  - `ChatManager`: Central coordinator managing CLI sessions and WebSocket connections
  - `ClaudeCli`: Per-session Claude CLI wrapper handling message routing
  - Session persistence and resume functionality (saves to `.local/` directory)
  - File watching with `notify` crate for real-time file change notifications
- **Message routing architecture**:
  - WebSocket messages → ChatManager → ClaudeCli → cc-sdk → Claude CLI process
  - Claude responses flow back through the same chain
  - Uses `tokio` channels for async message passing
- **Session management**:
  - Sessions cached in memory with 10-minute timeout
  - Messages persisted to JSON files for resume capability
  - HTTP API for creating/resuming sessions, WebSocket for real-time interaction

### Frontend Architecture (Vue3)

- **Vue3 with Composition API** and `<script setup lang="ts">` SFCs
- **TypeScript** throughout with strict type checking
- **Pinia** for state management
  - `chatManager` store: Manages multiple chat sessions, message history, tool results
  - `workspace` store: Current working directory, project settings
  - `claudeInfo` store: Available models, slash commands
- **PrimeVue** component library with custom Tailwind CSS v4 styling
- **TipTap editor** for rich text input with custom extensions:
  - Slash commands auto-completion
  - File reference suggestions with fuzzy search (Fuse.js)
  - Markdown copy/paste support (Turndown for HTML→MD conversion)
- **Real-time features**:
  - WebSocket-based chat communication
  - File watching with debounced updates
  - Session resume with message history replay
- **Advanced UI components**:
  - Diff viewer with syntax highlighting for file edits
  - Markdown renderer with Mermaid diagram support
  - Tool-specific message renderers (Bash, Edit, Write, Grep, etc.)
  - Permission dialog for tool use approval workflow
  - Chat export functionality (JSON/Markdown)

### Key Technical Patterns

- **Rust-to-CLI bridge**: The cc-sdk spawns the Node.js Claude Code CLI as a child process and communicates via JSON over stdin/stdout, handling control requests (can_use_tool, initialize) and SDK messages
- **Multi-session management**: ChatManager coordinates multiple CLI sessions, each potentially subscribed to by different WebSocket clients, with lag message buffering for reconnection
- **Message persistence**: All messages (user input, Claude responses, tool requests) are cached to `MessageRecord` structs with timestamps and serialized for resume
- **Session resume workflow**: Can resume from either active in-memory sessions or load from persisted `.local/sessions/` JSON files
- **Tool permission flow**:
  1. Claude requests tool use → cc-sdk control request
  2. Backend forwards to frontend via WebSocket `can_use_tool` message
  3. Frontend shows permission dialog with suggestions
  4. User approves/denies → backend → cc-sdk → Claude
- **WebSocket protocol**: Typed message protocol with `ClientMessage` and `ServerMessage` enums, chat-id-based routing
- **File watching**: Backend watches workspace for file changes and broadcasts updates to connected clients with debouncing

## File Structure

```
backend/
├── Cargo.toml           # Workspace root with shared dependencies
├── src/
│   ├── main.rs          # Actix-web server entry point
│   └── api.rs           # HTTP/WebSocket API routes
├── cc-sdk/              # Claude Code CLI wrapper
│   └── src/
│       ├── cli.rs       # QueryStream, PromptGenerator, process spawning
│       └── types.rs     # SDK types (SDKMessage, PermissionMode, etc.)
└── server/              # Core business logic
    └── src/
        ├── chat.rs      # ChatManager, session management, message routing
        ├── claude.rs    # ClaudeCli wrapper for per-session CLI instances
        ├── message.rs   # WebSocket message types (ClientMessage, ServerMessage)
        ├── resume.rs    # Session persistence and loading
        ├── work_dir.rs  # File watching and directory utilities
        └── setting.rs   # Configuration management

frontend/src/
├── components/
│   ├── message/         # Message renderers for each tool/message type
│   ├── slash-commands/  # Slash command TipTap extension
│   ├── file-reference/  # File reference TipTap extension
│   ├── tool-use/        # Tool permission UI components
│   ├── diff/            # Diff viewer component
│   ├── ChatMessage.vue  # Main message component with type-based rendering
│   ├── MessageInput.vue # TipTap editor with custom extensions
│   └── MessageList.vue  # Message list with virtualization
├── composables/
│   ├── useWebSocket.ts  # WebSocket connection management
│   ├── useMessageHandler.ts  # Message routing and processing
│   ├── useToolUseHandler.ts  # Tool permission workflow
│   └── useFileWatch.ts  # File change notifications
├── stores/
│   ├── chatManager.ts   # Multi-chat session state
│   ├── workspace.ts     # Working directory and project state
│   └── claudeInfo.ts    # Claude system info (models, commands)
├── services/
│   ├── websocket.ts     # WebSocket service with reconnection
│   ├── api.ts           # HTTP API client
│   └── fileUpdates.ts   # File change processing
├── types/
│   ├── message.ts       # WebSocket message types
│   ├── chat.ts          # Chat/session types
│   └── sdk-tools.d.ts   # Claude Code SDK tool type definitions
└── utils/
    ├── markdownRenderer.ts  # Markdown rendering with Mermaid
    ├── contentConverter.ts  # HTML/Markdown conversion
    └── chatExporter.ts      # Export functionality
```

## Development Workflow

1. **Backend development**: Work on Rust crates for WebSocket handling, session management, and CLI integration
2. **Frontend development**: Build Vue components for chat UI, tool rendering, and editor extensions
3. **Integration testing**: Test WebSocket protocol, session resume, and tool permission workflows (manual testing by human)
4. **Code quality**: Run `cargo check` for backend and `pnpm run check` for frontend after completing features

## Key Dependencies

- **Backend**: actix-web, actix-ws, tokio, serde, serde_json, notify, ignore, walkdir, chrono
- **Frontend**:
  - Core: vue@3.5.22, pinia, vue-router
  - UI: primevue@4, primeicons, tailwindcss@4
  - Editor: @tiptap/vue-3, @tiptap/starter-kit
  - Rendering: marked (markdown), mermaid (diagrams), github-markdown-css
  - Utilities: fuse.js (fuzzy search), diff-match-patch, turndown (HTML→MD), uuid
- **Claude SDK**: @anthropic-ai/claude-code (Node.js, called from Rust via child process)
