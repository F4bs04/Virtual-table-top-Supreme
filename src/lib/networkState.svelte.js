import { Peer } from 'peerjs';
import { getHexDistance } from './hexGeometry.js';

export const networkState = $state({
  // PeerJS references
  peer: null,
  peerId: '',
  roomId: '',
  role: 'disconnected', // 'host' | 'client' | 'disconnected'
  error: '',
  logs: [],
  selectedPieceId: null,
  currentViewLevel: 1, // 1 = Ground Floor, 2 = Second Floor, etc.
  drawingMode: false, // drawing active state for GM
  drawingStartHex: null, // { c, r } start corner of footprint drawing
  floorDrawingPoints: [], // Array of { c, r } points for polygon floors
  activeTool: 'hand', // 'hand' | 'move' | 'scale' | 'draw-wall' | 'draw-floor'
  obstructedStructureIds: new Set(), // Set of structure IDs currently obstructing view of characters
  draggedPieceId: null, // ID of the piece currently being dragged by pointer
  draggedPieceStartHex: null, // { c, r } start hex of the piece before drag for move range validations

  // Authoritative board state
  gameState: {
    buildMode: false,
    gridSize: 24,
    theme: 'soul-society',
    backgroundImage: '',
    basicPlaneSize: 'medium', // 'small' | 'medium' | 'large'
    activePopupImage: '', // Fullscreen shared image URL
    recentRolls: [], // List of recent dice rolls
    activeParticles: [], // List of active particle burst events
    pieces: {
      'p-1': { id: 'p-1', name: 'Ichigo Kurosaki', class: 'personagem', x: 2, y: 0, z: 2, color: '#ff3e00', textureUrl: '/soldier.png', hp: 100, maxHp: 100, notes: '', photos: [] },
      'p-2': { id: 'p-2', name: 'Rukia Kuchiki', class: 'personagem', x: 5, y: 0, z: 3, color: '#00aaff', textureUrl: '/soldier.png', hp: 100, maxHp: 100, notes: '', photos: [] },
      'o-1': { id: 'o-1', name: 'Senkaimon Gate', class: 'objeto', x: 4, y: 0, z: 5, color: '#ffaa00', textureUrl: '', hp: null, maxHp: null, notes: '', photos: [] },
      'o-2': { id: 'o-2', name: 'Reishi Barrier', class: 'objeto', x: 3, y: 0, z: 3, color: '#888888', textureUrl: '', hp: null, maxHp: null, notes: '', photos: [] }
    }
  },

  // Connection management
  connections: [],
  hostConnection: null,

  // Real-time Event Logger
  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    networkState.logs = [`[${timestamp}] ${message}`, ...networkState.logs.slice(0, 49)];
  },

  // GM: Host room setup
  createRoom(customId = '') {
    networkState.disconnect();
    networkState.role = 'host';
    networkState.error = '';
    
    networkState.peer = customId ? new Peer(customId) : new Peer();

    networkState.peer.on('open', (id) => {
      networkState.peerId = id;
      networkState.roomId = id;
      networkState.addLog(`Room created successfully! Room Code: ${id}`);
      
      // Update URL query parameter
      if (typeof window !== 'undefined') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', id);
        window.history.pushState({ path: newUrl.href }, '', newUrl.href);
      }
    });

    networkState.peer.on('connection', (conn) => {
      networkState.addLog(`Incoming connection request from player: ${conn.peer}`);
      networkState._setupHostConnection(conn);
    });

    networkState.peer.on('error', (err) => {
      networkState.error = `Host PeerJS Error: ${err.type} - ${err.message}`;
      networkState.addLog(`Error: ${networkState.error}`);
      networkState.role = 'disconnected';
    });
  },

  _setupHostConnection(conn) {
    conn.on('open', () => {
      networkState.connections = [...networkState.connections, conn];
      networkState.addLog(`Player connected: ${conn.peer} (Total players: ${networkState.connections.length})`);
      
      // Send initial state to newly joined client
      conn.send({
        type: 'STATE_INIT',
        gameState: $state.snapshot(networkState.gameState)
      });
    });

    conn.on('data', (data) => {
      networkState._handleDataFromClient(conn, data);
    });

    conn.on('close', () => {
      networkState.connections = networkState.connections.filter(c => c.peer !== conn.peer);
      networkState.addLog(`Player disconnected: ${conn.peer} (Active players: ${networkState.connections.length})`);
    });

    conn.on('error', (err) => {
      networkState.addLog(`Connection error with player ${conn.peer}: ${err.message}`);
    });
  },

  // PLAYER: Join room setup
  joinRoom(targetRoomId) {
    if (!targetRoomId) {
      networkState.error = 'Room code is empty.';
      return;
    }
    
    networkState.disconnect();
    networkState.role = 'client';
    networkState.roomId = targetRoomId;
    networkState.error = '';

    networkState.peer = new Peer();

    networkState.peer.on('open', (id) => {
      networkState.peerId = id;
      networkState.addLog(`Connecting to Host Room: ${targetRoomId}...`);
      
      const conn = networkState.peer.connect(targetRoomId);
      networkState.hostConnection = conn;
      networkState._setupClientConnection(conn);
    });

    networkState.peer.on('error', (err) => {
      networkState.error = `Client PeerJS Error: ${err.type} - ${err.message}`;
      networkState.addLog(`Error: ${networkState.error}`);
      networkState.role = 'disconnected';
    });
  },

  _setupClientConnection(conn) {
    conn.on('open', () => {
      networkState.addLog(`Successfully connected to Host VTT Server!`);
      
      // Update URL query parameter
      if (typeof window !== 'undefined') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', networkState.roomId);
        window.history.pushState({ path: newUrl.href }, '', newUrl.href);
      }
    });

    conn.on('data', (data) => {
      networkState._handleDataFromHost(data);
    });

    conn.on('close', () => {
      networkState.addLog('Connection to Host closed. Returning to lobby.');
      networkState.disconnect();
    });

    conn.on('error', (err) => {
      networkState.error = `Connection error: ${err.message}`;
      networkState.addLog(`Error: ${networkState.error}`);
    });
  },

  // Client -> Host message handler
  _handleDataFromClient(conn, data) {
    if (data.type === 'INTENT_UPDATE_SHEET') {
      // Client can update HP and notes on their own character
      const { pieceId, hp, notes } = data;
      const piece = networkState.gameState.pieces[pieceId];
      if (!piece || piece.class !== 'personagem') return;
      // Detect HP delta to auto-trigger visual effect
      if (typeof hp === 'number') {
        const prevHp = piece.hp ?? 0;
        const newHp = Math.max(0, Math.min(piece.maxHp ?? hp, hp));
        if (newHp !== prevHp) {
          piece.animationEffect = {
            type: newHp < prevHp ? 'damage' : 'heal',
            timestamp: Date.now()
          };
        }
        piece.hp = newHp;
      }
      if (typeof notes === 'string') piece.notes = notes;
      networkState.addLog(`Client ${conn.peer} updated sheet for ${piece.name}`);
      networkState.broadcastGameState();
      return;
    }

    if (data.type === 'INTENT_MOVE') {
      const { pieceId, x, y, z } = data;
      const piece = networkState.gameState.pieces[pieceId];

      if (!piece) {
        networkState.addLog(`Ignored move: Piece ${pieceId} not found.`);
        return;
      }

      // Role check authority
      if (piece.class === 'personagem') {
        if (networkState.gameState.buildMode) {
          networkState.addLog(`BLOCKED: Client ${conn.peer} tried to move character ${piece.name} while Build Mode is active.`);
          conn.send({
            type: 'STATE_UPDATE',
            gameState: $state.snapshot(networkState.gameState)
          });
          return;
        }
        const dist = getHexDistance(piece.x, piece.z, x, z);
        if (dist > 1) {
          networkState.addLog(`BLOCKED: Client ${conn.peer} tried to move ${piece.name} by ${dist} hexes (limit is 1).`);
          conn.send({
            type: 'STATE_UPDATE',
            gameState: $state.snapshot(networkState.gameState)
          });
          return;
        }
        
        // Wall Collision Block check
        if (networkState.isCellBlocked(x, z)) {
          networkState.addLog(`BLOCKED: Client ${conn.peer} tried to move ${piece.name} into a wall at (${x}, ${z}).`);
          conn.send({
            type: 'STATE_UPDATE',
            gameState: $state.snapshot(networkState.gameState)
          });
          return;
        }

        networkState.gameState.pieces[pieceId].x = x;
        networkState.gameState.pieces[pieceId].y = y;
        networkState.gameState.pieces[pieceId].z = z;
        networkState.addLog(`Client ${conn.peer} moved character ${piece.name} to (${x}, ${y}, ${z})`);
        networkState.broadcastGameState();
      } else if (piece.class === 'objeto') {
        networkState.addLog(`BLOCKED: Client ${conn.peer} tried to move object ${piece.name} without authority!`);
        conn.send({
          type: 'STATE_UPDATE',
          gameState: $state.snapshot(networkState.gameState)
        });
      }
    } else if (data.type === 'INTENT_TOGGLE_DOOR') {
      const { wallId, openingId } = data;
      networkState.toggleWallOpening(wallId, openingId);
    } else if (data.type === 'INTENT_SET_HOUSE_FLOOR') {
      const house = networkState.gameState.pieces[data.houseId];
      if (!house || house.structureType !== 'house') return;

      const safeFloor = Math.max(1, Math.min(house.floors || 1, Math.round(data.floor || 1)));
      house.activeFloor = safeFloor;
      networkState.addLog(`Client ${conn.peer} accessed ${house.name} floor ${safeFloor}`);
      networkState.broadcastGameState();
    } else if (data.type === 'INTENT_ROLL') {
      const { roll } = data;
      networkState.gameState.recentRolls = [roll, ...networkState.gameState.recentRolls.slice(0, 9)];
      networkState.addLog(`${roll.name} rolled ${roll.die}: [ ${roll.result} ]`);
      networkState.broadcastGameState();
    } else if (data.type === 'INTENT_PIECE_EFFECT') {
      const { pieceId, effectType } = data;
      const piece = networkState.gameState.pieces[pieceId];
      if (piece) {
        piece.animationEffect = {
          type: effectType,
          timestamp: Date.now()
        };
        networkState.addLog(`Client ${conn.peer} triggered visual effect '${effectType}' on ${piece.name}`);
        networkState.broadcastGameState();
      }
    }
  },

  // Host -> Client message handler
  _handleDataFromHost(data) {
    if (data.type === 'STATE_INIT' || data.type === 'STATE_UPDATE') {
      networkState.gameState = data.gameState;
      networkState.addLog(`Received Board State Update from Host.`);
    }
  },

  // Broadcast game state to all clients
  broadcastGameState() {
    if (networkState.role !== 'host') return;
    
    const snap = $state.snapshot(networkState.gameState);
    networkState.connections.forEach(conn => {
      if (conn.open) {
        conn.send({
          type: 'STATE_UPDATE',
          gameState: snap
        });
      }
    });
  },

  // Move request execution
  requestMove(pieceId, x, y, z) {
    const piece = networkState.gameState.pieces[pieceId];
    if (!piece) return;

    const buildMode = networkState.gameState.buildMode;

    if (networkState.role === 'host') {
      if (piece.class === 'objeto' && !buildMode) {
        networkState.addLog(`BLOCKED: Host cannot move object ${piece.name} because Build Mode is OFF.`);
        return;
      }
      if (piece.class === 'personagem' && buildMode) {
        networkState.addLog(`BLOCKED: Host cannot move character ${piece.name} while Build Mode is active.`);
        return;
      }
      
      networkState.gameState.pieces[pieceId].x = x;
      networkState.gameState.pieces[pieceId].y = y;
      networkState.gameState.pieces[pieceId].z = z;
      networkState.addLog(`Host moved ${piece.name} to (${x}, ${y}, ${z})`);
      networkState.broadcastGameState();
    } else if (networkState.role === 'client') {
      if (piece.class === 'objeto') {
        networkState.addLog(`BLOCKED: Clients cannot move object pieces.`);
        return;
      }
      if (buildMode) {
        networkState.addLog(`BLOCKED: Cannot move characters while Build Mode is active.`);
        return;
      }
      
      const dist = getHexDistance(piece.x, piece.z, x, z);
      if (dist > 1) {
        networkState.addLog(`BLOCKED: Players can only move 1 space at a time! (Tried: ${dist} spaces)`);
        return;
      }

      // Wall Collision Block check
      if (networkState.isCellBlocked(x, z)) {
        networkState.addLog(`BLOCKED: Cannot move into walls!`);
        return;
      }
      
      networkState.addLog(`Sending movement intent for ${piece.name} to (${x}, ${y}, ${z})...`);
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_MOVE',
          pieceId,
          x,
          y,
          z
        });
      }
    }
  },

  // Toggle buildMode
  toggleBuildMode() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host (Master) can toggle Build Mode.');
      return;
    }
    
    networkState.gameState.buildMode = !networkState.gameState.buildMode;
    networkState.addLog(`Build Mode toggled to: ${networkState.gameState.buildMode ? 'ON (Master can move objects)' : 'OFF'}`);
    networkState.broadcastGameState();
  },

  // Update piece texture
  updatePieceTexture(pieceId, url) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change piece textures.');
      return;
    }
    if (networkState.gameState.pieces[pieceId]) {
      networkState.gameState.pieces[pieceId].textureUrl = url;
      networkState.addLog(`Updated texture for piece: ${networkState.gameState.pieces[pieceId].name}`);
      networkState.broadcastGameState();
    }
  },

  // Update piece metadata from the inspector panel
  updatePieceDetails(pieceId, updates) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can edit piece details.');
      return;
    }

    const piece = networkState.gameState.pieces[pieceId];
    if (!piece) return;

    if (typeof updates.name === 'string' && updates.name.trim()) {
      piece.name = updates.name.trim();
    }
    if (updates.class === 'personagem' || updates.class === 'objeto') {
      piece.class = updates.class;
    }
    if (typeof updates.color === 'string' && updates.color) {
      piece.color = updates.color;
    }
    if (typeof updates.y === 'number') {
      piece.y = updates.y;
    }
    if (typeof updates.height === 'number') {
      piece.height = updates.height;
    }
    if (typeof updates.width === 'number') {
      piece.width = updates.width;
    }
    if (typeof updates.depth === 'number') {
      piece.depth = updates.depth;
    }
    if (typeof updates.thickness === 'number') {
      piece.thickness = updates.thickness;
    }
    if (typeof updates.textureUrl === 'string') {
      piece.textureUrl = updates.textureUrl;
    }
    if (typeof updates.scale === 'number') {
      piece.scale = updates.scale;
    }

    networkState.addLog(`Updated asset details: ${piece.name}`);
    networkState.broadcastGameState();
  },

  // Add drawn structure (SketchUp style)
  addDrawnStructure(x, z, width, depth, structureType = 'house') {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add structures.');
      return;
    }
    const id = `drawn-${Date.now()}`;
    
    // Auto-stack height: check if there's an existing structure underneath, set base Y on top of it
    let baseHeight = 0;
    Object.values(networkState.gameState.pieces).forEach(p => {
      if (p.structureType && Math.abs(p.x - x) < (p.width || 1) && Math.abs(p.z - z) < (p.depth || 1)) {
        const height = p.height || (p.floors ? p.floors * 2.0 : 2.0);
        const topY = p.y + height;
        if (topY > baseHeight) {
          baseHeight = topY;
        }
      }
    });

    networkState.gameState.pieces[id] = {
      id,
      name: structureType === 'floor-plane' ? 'Floor Plane' : 'Extruded Wall',
      class: 'objeto',
      structureType, // 'house' | 'floor-plane'
      shape: 'box',
      width,
      depth,
      floors: 1,
      height: structureType === 'floor-plane' ? 0.05 : 2.0, // Initial extrusion height
      x,
      y: baseHeight, // snap to stack
      z,
      color: '#a855f7',
      textureUrl: '',
      hp: null,
      maxHp: null,
      notes: '',
      photos: []
    };
    networkState.addLog(`Drawn ${structureType} at hex (${x}, ${z}) with size ${width}x${depth} snapped to Y=${baseHeight}`);
    networkState.broadcastGameState();
  },

  isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].c, yi = polygon[i].r;
      const xj = polygon[j].c, yj = polygon[j].r;
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  isFloorUnderHex(c, r, yVal) {
    return Object.values(networkState.gameState.pieces).some(p => {
      if (p.structureType !== 'floor-plane') return false;
      if (Math.abs(p.y - yVal) > 0.1) return false;

      if (p.points && p.points.length >= 3) {
        const isVertex = p.points.some(pt => Math.abs(pt.c - c) < 0.2 && Math.abs(pt.r - r) < 0.2);
        if (isVertex) return true;
        if (networkState.isPointInPolygon(c, r, p.points)) return true;
        for (let i = 0; i < p.points.length; i++) {
          const p1 = p.points[i];
          const p2 = p.points[(i + 1) % p.points.length];
          const dx = p2.c - p1.c;
          const dz = p2.r - p1.r;
          const lenSq = dx * dx + dz * dz;
          let t = lenSq > 0 ? ((c - p1.c) * dx + (r - p1.r) * dz) / lenSq : 0;
          t = Math.max(0, Math.min(1, t));
          const nearC = p1.c + t * dx;
          const nearR = p1.r + t * dz;
          const dist = Math.sqrt((c - nearC) ** 2 + (r - nearR) ** 2);
          if (dist < 0.6) return true;
        }
        return false;
      }

      const halfW = p.width / 2;
      const halfD = p.depth / 2;
      const minC = p.x - halfW;
      const maxC = p.x + halfW;
      const minR = p.z - halfD;
      const maxR = p.z + halfD;

      return c >= minC && c <= maxC && r >= minR && r <= maxR;
    });
  },

  addDrawnFloorPolygon(points) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add structures.');
      return;
    }
    if (!points || points.length < 3) return;
    const id = `drawn-floor-${Date.now()}`;
    const baseHeight = (networkState.currentViewLevel - 1) * 2.0;

    networkState.gameState.pieces[id] = {
      id,
      name: 'Custom Floor Polygon',
      class: 'objeto',
      structureType: 'floor-plane',
      points: points,
      y: baseHeight,
      color: '#a855f7',
      textureUrl: '',
      hp: null,
      maxHp: null,
      notes: '',
      photos: []
    };
    networkState.addLog(`Created custom floor polygon with ${points.length} vertices at Y=${baseHeight}`);
    networkState.broadcastGameState();
  },

  // Add drawn wall line (Sims style)
  addDrawnWallLine(x1, z1, x2, z2) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add structures.');
      return;
    }
    if (x1 === x2 && z1 === z2) {
      networkState.addLog('Ignored wall segment: start and end coordinates are the same.');
      return;
    }
    const id = `drawn-wall-${Date.now()}`;
    const baseHeight = (networkState.currentViewLevel - 1) * 2.0;
    const type = networkState.drawingStructureType || 'wall-line';

    const actualType = (type === 'door' || type === 'window') ? 'wall-line' : type;

    // Enforce upper floor wall placement requires floor platform underneath
    if (actualType === 'wall-line' && baseHeight > 0) {
      const hasStartFloor = networkState.isFloorUnderHex(x1, z1, baseHeight);
      const hasEndFloor = networkState.isFloorUnderHex(x2, z2, baseHeight);
      if (!hasStartFloor || !hasEndFloor) {
        networkState.addLog('BLOCKED: Walls on upper floors can only be built on top of existing floor platforms.');
        return;
      }
    }

    networkState.gameState.pieces[id] = {
      id,
      name: actualType === 'stair' ? 'Stairs' : 'Wall Line',
      class: 'objeto',
      structureType: actualType,
      x: x1,
      z: z1,
      x2: x2,
      z2: z2,
      height: 2.0,
      thickness: 0.15,
      y: baseHeight,
      y2: actualType === 'stair' ? baseHeight + 2.0 : undefined,
      color: actualType === 'stair' ? '#fbbf24' : '#64748b',
      openings: [],
      textureUrl: '',
      hp: null,
      maxHp: null,
      notes: '',
      photos: []
    };
    networkState.addLog(`Drawn ${actualType} from (${x1}, ${z1}) to (${x2}, ${z2}) at level Y=${baseHeight}`);
    networkState.broadcastGameState();
  },

  addWallOpening(wallId, type) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can modify wall openings.');
      return;
    }
    const wall = networkState.gameState.pieces[wallId];
    if (!wall || wall.structureType !== 'wall-line') return;

    if (!wall.openings) wall.openings = [];

    const openingId = `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newOpening = {
      id: openingId,
      type, // 'door' | 'window'
      position: 0.5,
      width: type === 'door' ? 0.9 : 0.8,
      height: type === 'door' ? 1.8 : 1.0,
      yOffset: type === 'door' ? 0.0 : 0.6,
      isOpen: false
    };

    wall.openings.push(newOpening);
    networkState.addLog(`Added ${type} opening to wall ${wall.name}`);
    networkState.broadcastGameState();
  },

  removeWallOpening(wallId, openingId) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can modify wall openings.');
      return;
    }
    const wall = networkState.gameState.pieces[wallId];
    if (!wall || !wall.openings) return;

    wall.openings = wall.openings.filter(op => op.id !== openingId);
    networkState.addLog(`Removed opening from wall ${wall.name}`);
    networkState.broadcastGameState();
  },

  updateWallOpening(wallId, openingId, updates) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can modify wall openings.');
      return;
    }
    const wall = networkState.gameState.pieces[wallId];
    if (!wall || !wall.openings) return;

    const op = wall.openings.find(o => o.id === openingId);
    if (!op) return;

    if (typeof updates.position === 'number') op.position = Math.max(0.0, Math.min(1.0, updates.position));
    if (typeof updates.width === 'number') op.width = Math.max(0.1, updates.width);
    if (typeof updates.height === 'number') op.height = Math.max(0.1, updates.height);
    if (typeof updates.yOffset === 'number') op.yOffset = Math.max(0.0, updates.yOffset);

    networkState.broadcastGameState();
  },

  toggleWallOpening(wallId, openingId) {
    // Both Host and Client can trigger this, but Host executes authority
    if (networkState.role !== 'host') {
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_TOGGLE_DOOR',
          wallId,
          openingId
        });
      }
      return;
    }

    const wall = networkState.gameState.pieces[wallId];
    if (!wall || !wall.openings) return;

    const op = wall.openings.find(o => o.id === openingId);
    if (!op) return;

    op.isOpen = !op.isOpen;
    networkState.addLog(`Toggled door: ${op.isOpen ? 'Opened' : 'Closed'}`);
    networkState.broadcastGameState();
  },

  // Update Grid Size
  updateGridSize(size) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change grid size.');
      return;
    }
    const validSize = Math.max(8, Math.min(128, Math.round(size / 4) * 4));
    networkState.gameState.gridSize = validSize;
    networkState.addLog(`Grid size updated to: ${validSize}x${validSize}`);
    networkState.broadcastGameState();
  },

  // Update Basic Plane Size
  updateBasicPlaneSize(size) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change the basic plane size.');
      return;
    }
    if (['small', 'medium', 'large'].includes(size)) {
      networkState.gameState.basicPlaneSize = size;
      networkState.addLog(`Basic plane size updated to: ${size.toUpperCase()}`);
      networkState.broadcastGameState();
    }
  },

  // Update Background Image
  updateBackgroundImage(url) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change the background image.');
      return;
    }
    networkState.gameState.backgroundImage = url;
    networkState.addLog('Background map image updated.');
    networkState.broadcastGameState();
  },

  // Update Theme
  updateTheme(theme) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change the theme.');
      return;
    }
    networkState.gameState.theme = theme;
    networkState.addLog(`Visual theme updated to: ${theme.toUpperCase()}`);
    networkState.broadcastGameState();
  },

  // Add Piece
  addPiece(name, pieceClass, color) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add pieces.');
      return;
    }
    const id = `p-custom-${Date.now()}`;
    const midPoint = Math.floor((networkState.gameState.gridSize || 24) / 2);
    networkState.gameState.pieces[id] = {
      id,
      name,
      class: pieceClass,
      x: midPoint,
      y: 0,
      z: midPoint,
      color,
      textureUrl: pieceClass === 'personagem' ? '/soldier.png' : '',
      hp: pieceClass === 'personagem' ? 100 : null,
      maxHp: pieceClass === 'personagem' ? 100 : null,
      notes: '',
      photos: []
    };
    networkState.addLog(`Added new piece: ${name} (${pieceClass})`);
    networkState.broadcastGameState();
  },

  // Update piece character sheet (HP, notes) — available to GM and clients for own chars
  updatePieceSheet(pieceId, updates) {
    const piece = networkState.gameState.pieces[pieceId];
    if (!piece) return;

    if (networkState.role === 'host') {
      // Auto-trigger visual effect when HP changes
      if (typeof updates.hp === 'number') {
        const prevHp = piece.hp ?? 0;
        const newHp = Math.max(0, updates.hp);
        if (newHp !== prevHp) {
          piece.animationEffect = {
            type: newHp < prevHp ? 'damage' : 'heal',
            timestamp: Date.now()
          };
        }
        piece.hp = newHp;
      }
      if (typeof updates.maxHp === 'number') piece.maxHp = Math.max(1, updates.maxHp);
      if (typeof updates.notes === 'string') piece.notes = updates.notes;
      if (Array.isArray(updates.photos)) piece.photos = updates.photos;
      networkState.addLog(`Updated sheet: ${piece.name}`);
      networkState.broadcastGameState();
    } else if (networkState.role === 'client') {
      // Optimistic local update + send intent to host
      if (typeof updates.hp === 'number') {
        const prevHp = piece.hp ?? 0;
        const newHp = Math.max(0, updates.hp);
        // Apply local visual effect immediately (client-side preview)
        if (newHp !== prevHp) {
          piece.animationEffect = {
            type: newHp < prevHp ? 'damage' : 'heal',
            timestamp: Date.now()
          };
        }
        piece.hp = newHp;
      }
      if (typeof updates.notes === 'string') piece.notes = updates.notes;
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_UPDATE_SHEET',
          pieceId,
          hp: piece.hp,
          notes: piece.notes
        });
      }
    }
  },

  // Add a ready-to-use structure while Build Mode is active
  addStructure(name, color) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add structures.');
      return;
    }
    if (!networkState.gameState.buildMode) {
      networkState.addLog('BLOCKED: Enable Build Mode before placing structures.');
      return;
    }

    networkState.addPiece(name, 'objeto', color);
  },

  // Add a configurable house/building footprint to the scene
  addHouse({ name, shape, width, depth, floors, color }) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can build houses.');
      return;
    }
    if (!networkState.gameState.buildMode) {
      networkState.addLog('BLOCKED: Enable Build Mode before building houses.');
      return;
    }

    const gridSize = networkState.gameState.gridSize || 24;
    const safeWidth = Math.max(2, Math.min(12, Math.round(width || 4)));
    const safeDepth = Math.max(2, Math.min(12, Math.round(depth || safeWidth)));
    const safeFloors = Math.max(1, Math.min(8, Math.round(floors || 1)));
    const id = `house-${Date.now()}`;
    const midPoint = Math.floor(gridSize / 2);

    networkState.gameState.pieces[id] = {
      id,
      name: name?.trim() || 'New House',
      class: 'objeto',
      structureType: 'house',
      shape: shape === 'gable' ? 'gable' : 'box',
      width: safeWidth,
      depth: safeDepth,
      floors: safeFloors,
      activeFloor: 1,
      x: Math.max(0, Math.min(gridSize - 1, midPoint)),
      y: 0,
      z: Math.max(0, Math.min(gridSize - 1, midPoint)),
      color: color || '#64748b',
      textureUrl: ''
    };

    networkState.addLog(`Built house: ${networkState.gameState.pieces[id].name} (${safeWidth}x${safeDepth}, ${safeFloors} floors)`);
    networkState.broadcastGameState();
  },

  updateHouseFloor(houseId, floor) {
    const house = networkState.gameState.pieces[houseId];
    if (!house || house.structureType !== 'house') return;

    const safeFloor = Math.max(1, Math.min(house.floors || 1, Math.round(floor || 1)));

    if (networkState.role === 'host') {
      house.activeFloor = safeFloor;
      networkState.addLog(`House floor changed: ${house.name} -> floor ${safeFloor}`);
      networkState.broadcastGameState();
      return;
    }

    if (networkState.hostConnection && networkState.hostConnection.open) {
      networkState.hostConnection.send({
        type: 'INTENT_SET_HOUSE_FLOOR',
        houseId,
        floor: safeFloor
      });
      networkState.addLog(`Requesting access to ${house.name} floor ${safeFloor}...`);
    }
  },

  getHouseContainingPiece(pieceId) {
    const piece = networkState.gameState.pieces[pieceId];
    if (!piece || piece.class !== 'personagem') return null;

    return Object.values(networkState.gameState.pieces).find((candidate) => {
      if (candidate.structureType !== 'house') return false;
      const halfWidth = (candidate.width || 1) / 2;
      const halfDepth = (candidate.depth || candidate.width || 1) / 2;
      return Math.abs(piece.x - candidate.x) <= halfWidth && Math.abs(piece.z - candidate.z) <= halfDepth;
    }) ?? null;
  },

  snapToWall(c, r) {
    let closestC = c;
    let closestR = r;
    let minDistance = 1.0; // snap threshold in hex distance
    const activeY = (networkState.currentViewLevel - 1) * 2.0;

    Object.values(networkState.gameState.pieces).forEach(p => {
      // Only snap to structures on the current level
      if (Math.abs((p.y || 0) - activeY) > 0.1) return;

      if (p.structureType === 'wall-line') {
        // Check start point
        const distStart = Math.sqrt((p.x - c) ** 2 + (p.z - r) ** 2);
        if (distStart < minDistance) {
          minDistance = distStart;
          closestC = p.x;
          closestR = p.z;
        }
        // Check end point
        if (p.x2 !== undefined) {
          const distEnd = Math.sqrt((p.x2 - c) ** 2 + (p.z2 - r) ** 2);
          if (distEnd < minDistance) {
            minDistance = distEnd;
            closestC = p.x2;
            closestR = p.z2;
          }
        }
      } else if (p.structureType === 'house') {
        // Snap to corners or center
        const halfWidth = (p.width - 1) / 2;
        const halfDepth = (p.depth - 1) / 2;
        const corners = [
          { c: p.x - halfWidth, r: p.z - halfDepth },
          { c: p.x + halfWidth, r: p.z - halfDepth },
          { c: p.x - halfWidth, r: p.z + halfDepth },
          { c: p.x + halfWidth, r: p.z + halfDepth },
          { c: p.x, r: p.z }
        ];
        corners.forEach(corner => {
          const dist = Math.sqrt((corner.c - c) ** 2 + (corner.r - r) ** 2);
          if (dist < minDistance) {
            minDistance = dist;
            closestC = Math.round(corner.c);
            closestR = Math.round(corner.r);
          }
        });
      }
    });

    return { c: closestC, r: closestR };
  },

  getPieceRenderHeight(piece) {
    // Check if there is a stair structure that contains this piece's coordinate
    let stairHeight = null;
    Object.values(networkState.gameState.pieces).forEach(p => {
      if (p.structureType === 'stair' && p.x2 !== undefined) {
        // Compute distance from piece (px, pz) to stair line segment in hex coords
        const ax = p.x, az = p.z, bx = p.x2, bz = p.z2;
        const dx = bx - ax, dz = bz - az;
        const lenSq = dx * dx + dz * dz;
        let t = lenSq > 0 ? ((piece.x - ax) * dx + (piece.z - az) * dz) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const nearX = ax + t * dx;
        const nearZ = az + t * dz;
        const dist = Math.sqrt((piece.x - nearX) ** 2 + (piece.z - nearZ) ** 2);
        
        if (dist < 0.65) {
          const y1 = p.y;
          const y2 = p.y2 ?? (p.y + 2.0);
          stairHeight = y1 + t * (y2 - y1);
        }
      }
    });

    if (stairHeight !== null) return stairHeight;
    return piece.y ?? 0;
  },

  saveSession() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can save the session.');
      return;
    }
    const dataStr = JSON.stringify($state.snapshot(networkState.gameState), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `bleach-vtt-session-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    networkState.addLog(`Session exported successfully! Filename: ${exportFileDefaultName}`);
  },

  loadSession(jsonString) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can load a session.');
      return;
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object' && parsed.pieces) {
        networkState.gameState = parsed;
        networkState.addLog('Session loaded successfully!');
        networkState.broadcastGameState();
      } else {
        networkState.addLog('FAILED: Invalid session file structure.');
      }
    } catch (err) {
      networkState.addLog(`FAILED to load session: ${err.message}`);
    }
  },

  isCellBlocked(c, r) {
    return Object.values(networkState.gameState.pieces).some(p => {
      if (p.structureType === 'house') {
        const minC = p.x - (p.width - 1) / 2;
        const maxC = p.x + (p.width - 1) / 2;
        const minR = p.z - (p.depth - 1) / 2;
        const maxR = p.z + (p.depth - 1) / 2;
        return c >= minC && c <= maxC && r >= minR && r <= maxR;
      }
      if (p.structureType === 'wall-line' && p.x2 !== undefined) {
        // Point-to-segment distance in hex grid coordinates
        const ax = p.x, az = p.z, bx = p.x2, bz = p.z2;
        const dx = bx - ax, dz = bz - az;
        const lenSq = dx * dx + dz * dz;
        let t = lenSq > 0 ? ((c - ax) * dx + (r - az) * dz) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const nearX = ax + t * dx;
        const nearZ = az + t * dz;
        const dist = Math.sqrt((c - nearX) ** 2 + (r - nearZ) ** 2);
        return dist < 0.6; // block hex whose center is within 0.6 units of wall
      }
      return false;
    });
  },


  // Delete Piece
  deletePiece(pieceId) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can delete pieces.');
      return;
    }
    const piece = networkState.gameState.pieces[pieceId];
    if (piece) {
      delete networkState.gameState.pieces[pieceId];
      if (networkState.selectedPieceId === pieceId) {
        networkState.selectedPieceId = null;
      }
      networkState.addLog(`Deleted piece: ${piece.name}`);
      networkState.broadcastGameState();
    }
  },

  // Trigger a dice roll
  rollDice(dieType) {
    const rollerName = networkState.role === 'host' ? 'GM (Mestre)' : `Player (${networkState.peerId.slice(0, 4)})`;
    const min = 1;
    const max = Number(dieType.replace('D', '')) || 20;
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    
    const roll = {
      id: `roll-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: rollerName,
      die: dieType,
      result,
      timestamp: new Date().toLocaleTimeString()
    };

    if (networkState.role === 'host') {
      networkState.gameState.recentRolls = [roll, ...networkState.gameState.recentRolls.slice(0, 9)];
      networkState.addLog(`${rollerName} rolled ${dieType}: [ ${result} ]`);
      networkState.broadcastGameState();
    } else {
      // Send intent to host to broadcast the roll
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_ROLL',
          roll
        });
      }
    }
  },

  // Share fullscreen image popup
  sharePopupImage(url) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can share fullscreen images.');
      return;
    }
    networkState.gameState.activePopupImage = url;
    networkState.addLog(`Shared fullscreen image: ${url}`);
    networkState.broadcastGameState();
  },

  // Clear popup image
  clearPopupImage() {
    if (networkState.role !== 'host') return;
    networkState.gameState.activePopupImage = '';
    networkState.broadcastGameState();
  },

  // Trigger a GM spiritual burst/particles
  triggerParticles(x, z) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can trigger particles.');
      return;
    }
    const burst = {
      id: `burst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x,
      z,
      timestamp: Date.now()
    };
    networkState.gameState.activeParticles = [burst, ...networkState.gameState.activeParticles.slice(0, 4)];
    networkState.addLog(`GM triggered a Spiritual Reiatsu Burst at (${x}, ${z})!`);
    networkState.broadcastGameState();
  },

  // Trigger a damage or heal overlay + bounce effect on a piece
  triggerPieceEffect(pieceId, effectType) {
    if (networkState.role === 'host') {
      const piece = networkState.gameState.pieces[pieceId];
      if (piece) {
        piece.animationEffect = {
          type: effectType,
          timestamp: Date.now()
        };
        networkState.addLog(`GM triggered visual effect '${effectType}' on ${piece.name}!`);
        networkState.broadcastGameState();
      }
    } else if (networkState.role === 'client') {
      networkState.addLog(`Requesting visual effect '${effectType}' on piece...`);
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_PIECE_EFFECT',
          pieceId,
          effectType
        });
      }
    }
  },

  startOfflineMode() {
    networkState.disconnect();
    networkState.role = 'host';
    networkState.roomId = 'LOCAL-OFFLINE';
    networkState.peerId = 'GM-OFFLINE';
    networkState.peer = null;
    networkState.error = '';
    networkState.addLog("Offline Solo/Local GM mode active. signaling server connection skipped.");
  },

  // Reset and disconnect WebRTC session
  disconnect() {
    if (networkState.peer) {
      networkState.peer.destroy();
      networkState.peer = null;
    }
    
    networkState.connections = [];
    networkState.hostConnection = null;
    networkState.peerId = '';
    networkState.roomId = '';
    networkState.role = 'disconnected';
    networkState.selectedPieceId = null;
    
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('room');
      window.history.pushState({ path: newUrl.href }, '', newUrl.href);
    }
  }
});

// Auto-join from URL parameter on initial load
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    setTimeout(() => {
      networkState.joinRoom(roomParam);
    }, 500);
  }
}
