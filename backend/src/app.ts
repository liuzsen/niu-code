import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { ClientMessage, ServerMessage } from './types/index.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log('Received message:', message);

      // Handle different message types
      switch (message.type) {
        case 'user_input':
          handleUserInput(ws, message);
          break;
        case 'start_session':
          handleStartSession(ws, message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      const errorMessage: ServerMessage = {
        type: 'error',
        data: { message: 'Invalid message format' }
      };
      ws.send(JSON.stringify(errorMessage));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleUserInput(ws: any, message: ClientMessage) {
  // Echo the user input for now
  const response: ServerMessage = {
    type: 'claude_message',
    data: {
      content: `Echo: ${message.data.content}`,
      timestamp: new Date().toISOString()
    }
  };

  ws.send(JSON.stringify(response));
}

function handleStartSession(ws: any, message: ClientMessage) {
  console.log('Starting new session:', message.data);

  const response: ServerMessage = {
    type: 'session_started',
    data: {
      sessionId: 'session_' + Date.now(),
      message: 'Session started successfully'
    }
  };

  ws.send(JSON.stringify(response));
}

// Basic routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Claude Code Web Backend is running' });
});

const PORT = process.env.PORT || 33333;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});