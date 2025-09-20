import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import {
  ClientMessage,
  UserInputMessage,
  createWsErrorMessage
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
        default: {
          console.log('Unknown message type:', message.type);
          const errorResponse = createWsErrorMessage(
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
      const errorResponse = createWsErrorMessage(
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
    const { content } = message;

    console.log(`Processing user input: ${content.substring(0, 100)}...`);

    // Create the async generator stream from Claude service
    const stream = await claudeService.processPrompt(content);

    // Manual iteration to properly handle both yield values and TReturn value
    let result = await stream.next();
    while (!result.done) {
      // Send each message to the client
      ws.send(JSON.stringify(result.value));
      result = await stream.next();
    }

    // Save the TReturn value (SessionResult) to .local/session-result.json
    if (result.done && result.value) {
      const localDir = path.join(process.cwd(), '.local');
      const resultPath = path.join(localDir, 'session-result.json');

      // Ensure .local directory exists
      await fs.mkdir(localDir, { recursive: true });

      // Save the result
      await fs.writeFile(resultPath, JSON.stringify(result.value, null, 2));
      console.log(`Session result saved to ${resultPath}`);
    }
  } catch (error) {
    console.error('Error handling user input:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse = createWsErrorMessage(
      errorMessage,
      message.sessionId,
      'PROCESSING_ERROR'
    );
    ws.send(JSON.stringify(errorResponse));
  }
}

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