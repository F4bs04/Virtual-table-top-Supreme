import { WebSocketServer } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

// WebSocket connection to Svelte VTT app
const wss = new WebSocketServer({ port: 4444 });
let activeWs = null;
const pendingRequests = new Map();

wss.on('connection', (ws) => {
  console.error('[MCP VTT] Client connected (VTT Frontend)');
  activeWs = ws;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.requestId && pendingRequests.has(msg.requestId)) {
        const { resolve, timeout } = pendingRequests.get(msg.requestId);
        clearTimeout(timeout);
        pendingRequests.delete(msg.requestId);
        resolve(msg);
      }
    } catch (err) {
      console.error('[MCP VTT] Error parsing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.error('[MCP VTT] Client disconnected');
    if (activeWs === ws) activeWs = null;
  });
});

// Helper to query VTT app over WebSocket
function sendToVtt(type, data = {}) {
  return new Promise((resolve, reject) => {
    if (!activeWs) {
      return reject(new Error('VTT client is not connected. Make sure the Host VTT application is open in your browser.'));
    }
    const requestId = Math.random().toString(36).substring(2, 11);
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Timeout waiting for response from VTT frontend.'));
    }, 6000);

    pendingRequests.set(requestId, { resolve, reject, timeout });
    activeWs.send(JSON.stringify({ type, requestId, ...data }));
  });
}

// Helper to scan directory for assets
function scanAssets(dir, baseDir = '') {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const relativePath = path.join(baseDir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanAssets(fullPath, relativePath));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
          results.push('/' + relativePath.replace(/\\/g, '/'));
        }
      }
    }
  } catch (e) {
    console.error(`Error reading assets directory ${dir}:`, e);
  }
  return results;
}

// MCP JSON-RPC protocol parser on standard input
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  let lineEndIndex;
  while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, lineEndIndex).trim();
    buffer = buffer.slice(lineEndIndex + 1);
    if (line) {
      handleRequest(line);
    }
  }
});

function sendResponse(id, result = null, error = null) {
  const response = { jsonrpc: '2.0', id };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

async function handleRequest(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendResponse(null, null, { code: -32700, message: 'Parse error' });
    return;
  }

  const { method, params, id } = request;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'vtt-mcp-server',
        version: '1.0.0'
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // No response required for notifications
    return;
  }

  if (method === 'tools/list') {
    sendResponse(id, {
      tools: [
        {
          name: 'get_board_state',
          description: 'Get the current VTT board state, including grid size, environments, active environment ID, and all existing pieces (characters, objects, walls, and floors).',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'list_assets',
          description: 'Lists all available asset files (tokens, models, textures) in the local /public/Model/ directory so you can assign valid textures/images to pieces.',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'add_character',
          description: 'Add a character token to the map.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the character' },
              x: { type: 'number', description: 'X coordinate' },
              z: { type: 'number', description: 'Z coordinate (height/depth index in grid)' },
              y: { type: 'number', default: 0, description: 'Y coordinate (elevation/floor level)' },
              textureUrl: { type: 'string', description: 'URL/path to character image token' },
              hp: { type: 'number', default: 100 },
              maxHp: { type: 'number', default: 100 },
              ep: { type: 'number', default: 100 },
              maxEp: { type: 'number', default: 100 },
              color: { type: 'string', default: '#3b82f6', description: 'Hex color associated with character' },
              notes: { type: 'string', default: '' }
            },
            required: ['name', 'x', 'z', 'textureUrl']
          }
        },
        {
          name: 'add_object',
          description: 'Add a static object (chest, barrel, chair, table, etc.) to the map.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the object' },
              x: { type: 'number', description: 'X position' },
              z: { type: 'number', description: 'Z position' },
              y: { type: 'number', default: 0, description: 'Y position (elevation)' },
              textureUrl: { type: 'string', description: 'URL/path to object texture image' },
              color: { type: 'string', default: '#d97706' },
              width: { type: 'number', default: 1 },
              depth: { type: 'number', default: 1 },
              height: { type: 'number', default: 1 },
              notes: { type: 'string', default: '' }
            },
            required: ['name', 'x', 'z', 'textureUrl']
          }
        },
        {
          name: 'add_wall',
          description: 'Draw a wall segment on the map from start to end coordinates.',
          inputSchema: {
            type: 'object',
            properties: {
              x1: { type: 'number', description: 'Start X coordinate' },
              z1: { type: 'number', description: 'Start Z coordinate' },
              x2: { type: 'number', description: 'End X coordinate' },
              z2: { type: 'number', description: 'End Z coordinate' },
              y: { type: 'number', default: 0, description: 'Elevation level Y' },
              color: { type: 'string', default: '#64748b' },
              textureUrl: { type: 'string', description: 'Optional texture path/URL' },
              thickness: { type: 'number', default: 0.15 },
              height: { type: 'number', default: 2.0 }
            },
            required: ['x1', 'z1', 'x2', 'z2']
          }
        },
        {
          name: 'add_floor',
          description: 'Draw a floor plane or custom polygon floor.',
          inputSchema: {
            type: 'object',
            properties: {
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    c: { type: 'number', description: 'Grid column / X' },
                    r: { type: 'number', description: 'Grid row / Z' }
                  },
                  required: ['c', 'r']
                },
                description: 'Array of points representing the polygon vertices. Required if not using rectangular properties x, z, width, depth.'
              },
              x: { type: 'number', description: 'Center X position (for rectangular floors)' },
              z: { type: 'number', description: 'Center Z position (for rectangular floors)' },
              width: { type: 'number', description: 'Width (for rectangular floors)' },
              depth: { type: 'number', description: 'Depth (for rectangular floors)' },
              y: { type: 'number', default: 0, description: 'Y height level' },
              color: { type: 'string', default: '#a855f7' },
              textureUrl: { type: 'string', description: 'Optional wood/stone floor texture path/URL' }
            }
          }
        },
        {
          name: 'add_door_or_window',
          description: 'Adds an opening (door or window) to a wall line.',
          inputSchema: {
            type: 'object',
            properties: {
              wallId: { type: 'string', description: 'The ID of the wall segment' },
              type: { type: 'string', enum: ['door', 'window'], description: 'Opening type' },
              position: { type: 'number', default: 0.5, description: 'Relative position along the wall segment (0.0 to 1.0)' },
              width: { type: 'number', default: 0.9 },
              height: { type: 'number', default: 1.8 }
            },
            required: ['wallId', 'type']
          }
        },
        {
          name: 'update_piece',
          description: 'Modify details of an existing piece (move it, rotate, change scale, color, HP, texture, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The ID of the piece to modify' },
              updates: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  z: { type: 'number' },
                  color: { type: 'string' },
                  textureUrl: { type: 'string' },
                  scale: { type: 'number' },
                  rotation: { type: 'number', description: 'Rotation in degrees' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                  depth: { type: 'number' },
                  hp: { type: 'number' },
                  maxHp: { type: 'number' },
                  notes: { type: 'string' }
                }
              }
            },
            required: ['id', 'updates']
          }
        },
        {
          name: 'delete_piece',
          description: 'Deletes a piece (character, object, wall, floor) from the map.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of the piece to delete' }
            },
            required: ['id']
          }
        },
        {
          name: 'clear_map',
          description: 'Clears the current map environment of all objects, walls, and floors, leaving only player character tokens.',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      if (name === 'list_assets') {
        const publicModelDir = path.join(process.cwd(), 'public', 'Model');
        const assets = scanAssets(publicModelDir, 'Model');
        sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(assets, null, 2) }] });
        return;
      }

      if (name === 'get_board_state') {
        const res = await sendToVtt('MCP_GET_STATE');
        sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(res.gameState, null, 2) }] });
        return;
      }

      if (name === 'clear_map') {
        const res = await sendToVtt('MCP_CLEAR');
        sendResponse(id, { content: [{ type: 'text', text: res.message || 'Map cleared successfully.' }] });
        return;
      }

      // Handle all modifications
      const res = await sendToVtt('MCP_EXECUTE_TOOL', { toolName: name, arguments: args });
      if (res.error) {
        sendResponse(id, null, { code: -32603, message: res.error });
      } else {
        sendResponse(id, { content: [{ type: 'text', text: res.message || 'Operation successful' }] });
      }
    } catch (err) {
      sendResponse(id, null, { code: -32603, message: err.message });
    }
  }
}
