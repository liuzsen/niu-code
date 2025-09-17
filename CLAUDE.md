# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vue3 + Node.js web application that provides a web UI for Claude Code, offering better interaction experience than command line. The project consists of a Vue3 frontend with Express backend, integrated with the @anthropic-ai/claude-code SDK.

## Development Commands

### Backend (Node.js + Express + TypeScript)

```bash
cd backend
pnpm install
pnpm run check        # Type check + lint
pnpm run lint         # ESLint check
```

### Frontend (Vue3 + Vite + TypeScript)

```bash
cd frontend
pnpm install
pnpm run check        # Type check + lint
pnpm run lint         # ESLint check
```

### Project Setup

- Uses pnpm as package manager (pnpm@10.15.1)
- Backend runs on port 33333 (configurable via PORT env var)
- Frontend development server typically runs on port 5173

## Claude Usage Rules

- **Claude is prohibited from starting development servers** using commands like `pnpm run dev` or similar. Development servers must be started manually by humans.

## Architecture

### Backend Architecture

- **Express server** with WebSocket support using 'ws' library
- **@anthropic-ai/claude-code SDK integration** for Claude interactions
- **TypeScript + ESM** (type: "module" in package.json)
- **Claude Session Management** using async generators and message queues
- **WebSocket messaging** for real-time communication with frontend
- **Tool Permission System** for secure Claude tool execution

### Frontend Architecture

- **Vue3 with Composition API** and `<script lang='ts' setup>` SFCs
- **TypeScript** throughout
- **Vite** for build tooling
- **WebSocket client** for real-time backend communication
- **Planned components**: ChatPanel, ToolPermission, SlashCommands, FileReference

### Key Technical Patterns

- **Multi-turn conversation management** via async generators
- **Message queue system** for handling user input during Claude processing
- **Tool permission workflow** with real-time UI confirmation
- **WebSocket message protocol** with typed interfaces for client/server communication

### Current Implementation Status

- Basic Express + WebSocket server setup complete
- Vue3 frontend bootstrapped with basic components
- Claude Code SDK dependency added but integration pending
- Architecture documented in `architecture.md` with detailed implementation plans

## File Structure

```
backend/src/
├── app.ts              # Main Express + WebSocket server
└── types/              # TypeScript type definitions

frontend/src/
├── App.vue             # Main Vue application component
├── components/         # Vue components
├── main.ts            # Vue app entry point
└── style.css          # Global styles
```

## Development Workflow

1. **Backend development**: Focus on Claude SDK integration and WebSocket message handling
2. **Frontend development**: Build chat interface and tool permission components
3. **Integration testing**: Test WebSocket communication and Claude interactions by human
4. **Check code quality**: Always run `pnpm run check` after requirement finished

## Key Dependencies

- **Backend**: @anthropic-ai/claude-code, express, ws, cors, dotenv
- **Frontend**: vue@3.5.18, vite, vue-tsc
- **Development**: TypeScript, ESLint, nodemon, tsx

