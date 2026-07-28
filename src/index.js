#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerChessTools } from './chess.js';

const server = new McpServer({ name: 'chesscom', version: '1.0.0' });

registerChessTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
