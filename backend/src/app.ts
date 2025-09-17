import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import {
  ClientMessage,
  UserInputMessage,
  StartSessionMessage,
  createSessionStartedWrapper,
  createErrorMessageWrapper
} from './types/index.js';
import { ClaudeService } from './services/claude.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Claude service
const claudeService = new ClaudeService({
  cwd: process.cwd(),
  permissionMode: 'default',
  maxTurns: 100,
  env: {
    ...process.env,
    DEBUG: 'true',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456',
    ANTHROPIC_AUTH_TOKEN: 'your-secret-key',
  },
  debug: true
});

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log('Received message:', message);

      // Handle different message types
      switch (message.type) {
        case 'user_input':
          await handleUserInput(ws, message as UserInputMessage);
          break;
        case 'start_session':
          await handleStartSession(ws, message as StartSessionMessage);
          break;
        default: {
          console.log('Unknown message type:', message.type);
          const errorResponse = createErrorMessageWrapper(
            `Unknown message type: ${message.type}`,
            undefined,
            'UNKNOWN_MESSAGE_TYPE'
          );
          ws.send(JSON.stringify(errorResponse));
          break;
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid message format';
      const errorResponse = createErrorMessageWrapper(
        errorMessage,
        undefined,
        'PARSE_ERROR'
      );
      ws.send(JSON.stringify(errorResponse));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

async function handleUserInput(ws: WebSocket, message: UserInputMessage) {
  try {
    const { content, sessionId } = message.data;

    console.log(`Processing user input: ${content.substring(0, 100)}...`);

    // Create the async generator stream from Claude service
    const stream = await claudeService.processPrompt(content, sessionId);

    // Stream each message back to the client
    for await (const serverMessage of stream) {
      ws.send(JSON.stringify(serverMessage));
    }

  } catch (error) {
    console.error('Error handling user input:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse = createErrorMessageWrapper(
      errorMessage,
      message.data.sessionId,
      'PROCESSING_ERROR'
    );
    ws.send(JSON.stringify(errorResponse));
  }
}

async function handleStartSession(ws: WebSocket, message: StartSessionMessage) {
  try {
    const { sessionId } = message.data;

    console.log('Starting new session:', sessionId || 'new session');

    // Create a new session through Claude service
    const newSessionId = sessionId || undefined;

    // Send session started response
    const response = createSessionStartedWrapper(
      newSessionId || claudeService.getSessionStats().totalSessions.toString(),
      'Session started successfully'
    );

    ws.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error starting session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse = createErrorMessageWrapper(
      errorMessage,
      message.data.sessionId,
      'SESSION_START_ERROR'
    );
    ws.send(JSON.stringify(errorResponse));
  }
}

// Routes for session management
app.get('/sessions', (_req, res) => {
  try {
    const sessions = claudeService.getAllSessions();
    const stats = claudeService.getSessionStats();
    res.json({
      sessions,
      stats,
      message: 'Sessions retrieved successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: errorMessage,
      message: 'Failed to retrieve sessions'
    });
  }
});

app.get('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = claudeService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${sessionId} does not exist`
      });
    }

    res.json({
      session,
      message: 'Session retrieved successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: errorMessage,
      message: 'Failed to retrieve session'
    });
  }
});

app.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = claudeService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${sessionId} does not exist`
      });
    }

    claudeService.deleteSession(sessionId);
    res.json({
      message: 'Session deleted successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: errorMessage,
      message: 'Failed to delete session'
    });
  }
});

app.delete('/sessions', (_req, res) => {
  try {
    claudeService.clearAllSessions();
    res.json({
      message: 'All sessions cleared successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: errorMessage,
      message: 'Failed to clear sessions'
    });
  }
});

// Basic health check
app.get('/health', (_req, res) => {
  const stats = claudeService.getSessionStats();
  res.json({
    status: 'ok',
    message: 'Claude Code Web Backend is running',
    stats: {
      sessions: stats,
      uptime: process.uptime()
    }
  });
});

const PORT = process.env.PORT || 33333;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Claude service initialized with options:`, {
    cwd: process.cwd(),
    permissionMode: 'default',
    maxTurns: 100,
    debug: true
  });
});