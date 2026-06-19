import { Peer } from 'peerjs';
import { getHexDistance } from './hexGeometry.js';

let broadcastTimeout = null;
export const networkState = $state({
  // PeerJS references
  peer: null,
  peerId: '',
  roomId: '',
  role: 'disconnected', // 'host' | 'client' | 'disconnected'
  error: '',
  logs: [],
  selectedPieceId: null,
  suppressNextGroundDeselect: false,
  currentViewLevel: 1, // 1 = Ground Floor, 2 = Second Floor, etc.
  drawingMode: false, // drawing active state for GM
  drawingStartHex: null, // { c, r } start corner of footprint drawing
  floorDrawingPoints: [], // Array of { c, r } points for polygon floors
  activeTool: 'hand', // 'hand' | 'move' | 'select' | 'draw-wall' | 'draw-floor'
  activeParticleType: 'burst', // 'burst' | 'falling' | 'bubbles' | 'lightning' | 'light'
  obstructedStructureIds: new Set(), // Set of structure IDs currently obstructing view of characters
  draggedPieceId: null, // ID of the piece currently being dragged by pointer
  draggedPieceStartHex: null, // { c, r } start hex of the piece before drag for move range validations
  dashMode: false, // true when the player has activated the dash ability and is picking a destination
  moveLockPieceId: null, // GM Move tool: piece ID that is "grabbed" and follows the mouse
  undoStack: [],
  lastAuthoritativeState: null,
  recentTextures: [],

  loadRecentTextures() {
    try {
      const stored = localStorage.getItem('vtt_recent_textures');
      if (stored) {
        networkState.recentTextures = JSON.parse(stored);
      } else {
        // default textures on first load
        networkState.recentTextures = [
          { name: 'Black Brick', path: '/Model/textures/Black_brick.png' },
          { name: 'Brick Texture', path: '/Model/textures/Bricktexture.png' },
          { name: 'Gray Brick', path: '/Model/textures/Bricktexture_gray.png' },
          { name: 'Concrete', path: '/Model/textures/concrete.png' },
          { name: 'Wood Floor', path: '/Model/textures/wood_floor.png' }
        ];
      }
    } catch (e) {
      console.error('Failed to load recent textures:', e);
    }
  },

  addRecentTexture(name, path) {
    // Avoid duplicates, move to front
    networkState.recentTextures = networkState.recentTextures.filter(t => t.path !== path);
    networkState.recentTextures.unshift({ name, path });
    if (networkState.recentTextures.length > 20) {
      networkState.recentTextures.pop();
    }
    try {
      localStorage.setItem('vtt_recent_textures', JSON.stringify(networkState.recentTextures));
    } catch (e) {
      console.error('Failed to save recent textures:', e);
    }
  },

  getPiece(pieceId) {
    if (!networkState.gameState) return null;
    const envs = networkState.gameState.environments || {};
    const currentEnvId = networkState.gameState.currentEnvironmentId || 'env-1';
    if (envs[currentEnvId]?.pieces?.[pieceId]) {
      return envs[currentEnvId].pieces[pieceId];
    }
    if (networkState.gameState.pieces && networkState.gameState.pieces[pieceId]) {
      return networkState.gameState.pieces[pieceId];
    }
    for (const envId of Object.keys(envs)) {
      if (envs[envId].pieces && envs[envId].pieces[pieceId]) {
        return envs[envId].pieces[pieceId];
      }
    }
    return null;
  },

  setPiece(id, piece) {
    if (piece.class === 'personagem') {
      networkState.gameState.pieces[id] = piece;
    } else {
      const envId = piece.environmentId || networkState.gameState.currentEnvironmentId || 'env-1';
      if (!networkState.gameState.environments) {
        networkState.gameState.environments = {};
      }
      if (!networkState.gameState.environments[envId]) {
        networkState.gameState.environments[envId] = {
          id: envId,
          name: envId === 'env-1' ? 'Gotei 13 (Soul Society)' : envId === 'env-2' ? 'Karakura Town' : 'Hueco Mundo',
          theme: 'soul-society',
          backgroundImage: '',
          backgroundImageOpacity: 1.0,
          pieces: {}
        };
      }
      if (!networkState.gameState.environments[envId].pieces) {
        networkState.gameState.environments[envId].pieces = {};
      }
      networkState.gameState.environments[envId].pieces[id] = piece;
    }
  },

  deletePiece(id) {
    delete networkState.gameState.pieces[id];
    const envs = networkState.gameState.environments || {};
    Object.keys(envs).forEach(envId => {
      if (envs[envId].pieces) {
        delete envs[envId].pieces[id];
      }
    });
  },

  // Authoritative board state
  gameState: {
    buildMode: false,
    gridSize: 24,
    theme: 'soul-society',
    backgroundImage: '/mapa.jpeg',
    backgroundImageOpacity: 1.0,
    basicPlaneSize: 'medium', // 'small' | 'medium' | 'large'
    activePopupImage: '', // Fullscreen shared image URL
    recentRolls: [], // List of recent dice rolls
    turnOrder: [], // Array of { pieceId, name, textureUrl, color, initiative }
    currentTurnIndex: 0,
    turnPhase: 'idle', // 'idle' | 'active'
    activeParticles: [], // List of active particle burst events
    currentEnvironmentId: 'env-1',
    environments: {
      'env-1': {
        id: 'env-1',
        name: 'Gotei 13 (Soul Society)',
        theme: 'soul-society',
        backgroundImage: '/mapa.jpeg',
        backgroundImageOpacity: 1.0,
        pieces: {
          'o-1': { id: 'o-1', name: 'Barril', class: 'objeto', x: 4, y: 0, z: 5, color: '#d97706', textureUrl: '/barril.png', hp: null, maxHp: null, notes: 'Barril de madeira contendo suprimentos', photos: [] },
          'o-2': { id: 'o-2', name: 'Baú', class: 'objeto', x: 3, y: 0, z: 3, color: '#f59e0b', textureUrl: '/bau.png', hp: null, maxHp: null, notes: 'Baú de tesouro trancado', photos: [] }
        }
      },
      'env-2': {
        id: 'env-2',
        name: 'Karakura Town',
        theme: 'karakura-town',
        backgroundImage: '',
        backgroundImageOpacity: 1.0,
        pieces: {}
      },
      'env-3': {
        id: 'env-3',
        name: 'Hueco Mundo',
        theme: 'hueco-mundo',
        backgroundImage: '',
        backgroundImageOpacity: 1.0,
        pieces: {}
      }
    },
    pieces: {
      'p-1': { id: 'p-1', name: 'Ichigo Kurosaki', class: 'personagem', x: 2, y: 0, z: 2, color: '#ff3e00', textureUrl: '/soldier.png', hp: 100, maxHp: 100, ep: 100, maxEp: 100, dashRange: 3, dashEpCost: 20, notes: 'Ceifador de Almas Substituto', photos: [] },
      'p-2': { id: 'p-2', name: 'Rukia Kuchiki', class: 'personagem', x: 5, y: 0, z: 3, color: '#00aaff', textureUrl: '/feiticeiro.png', hp: 100, maxHp: 100, ep: 100, maxEp: 100, dashRange: 3, dashEpCost: 20, notes: 'Tenente da 13ª Divisão', photos: [] },
      'p-3': { id: 'p-3', name: 'Guarda', class: 'personagem', x: 4, y: 0, z: 1, color: '#10b981', textureUrl: '/guarda.png', hp: 80, maxHp: 80, ep: 80, maxEp: 80, dashRange: 2, dashEpCost: 15, notes: 'Guarda do Seireitei', photos: [] },
      'p-4': { id: 'p-4', name: 'Monstro', class: 'personagem', x: 7, y: 0, z: 4, color: '#ef4444', textureUrl: '/monstro.png', hp: 120, maxHp: 120, ep: 60, maxEp: 60, dashRange: 4, dashEpCost: 25, notes: 'Hollow selvagem', photos: [] },
      'o-1': { id: 'o-1', name: 'Barril', class: 'objeto', x: 4, y: 0, z: 5, color: '#d97706', textureUrl: '/barril.png', hp: null, maxHp: null, notes: 'Barril de madeira contendo suprimentos', photos: [] },
      'o-2': { id: 'o-2', name: 'Baú', class: 'objeto', x: 3, y: 0, z: 3, color: '#f59e0b', textureUrl: '/bau.png', hp: null, maxHp: null, notes: 'Baú de tesouro trancado', photos: [] }
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
    networkState.activeTool = 'hand';
    networkState.drawingMode = false;
    networkState.drawingStartHex = null;
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
      // Client can update HP/EP, notes and states on their own character
      const { pieceId, hp, ep, notes, dead, stunned } = data;
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
      if (typeof ep === 'number') piece.ep = Math.max(0, Math.min(piece.maxEp ?? ep, ep));
      if (typeof notes === 'string') piece.notes = notes;
      if (typeof dead === 'boolean') piece.dead = dead;
      if (typeof stunned === 'boolean') piece.stunned = stunned;
      networkState.addLog(`Client ${conn.peer} updated sheet/states for ${piece.name}`);
      networkState.broadcastGameState();
      return;
    }

    if (data.type === 'INTENT_DASH') {
      const { pieceId, x, z } = data;
      const piece = networkState.gameState.pieces[pieceId];
      if (!piece || piece.class !== 'personagem') return;
      const dist = getHexDistance(piece.x, piece.z, x, z);
      const dashRange = piece.dashRange ?? 3;
      const dashEpCost = piece.dashEpCost ?? 20;
      const currentEp = piece.ep ?? 0;
      if (dist > dashRange) {
        networkState.addLog(`BLOCKED: Dash range exceeded (${dist}/${dashRange} hexes).`);
        conn.send({ type: 'STATE_UPDATE', gameState: $state.snapshot(networkState.gameState) });
        return;
      }
      if (currentEp < dashEpCost) {
        networkState.addLog(`BLOCKED: Not enough EP for dash (${currentEp}/${dashEpCost}).`);
        conn.send({ type: 'STATE_UPDATE', gameState: $state.snapshot(networkState.gameState) });
        return;
      }
      if (networkState.isCellBlocked(x, z)) {
        networkState.addLog(`BLOCKED: Dash destination is blocked by a wall.`);
        conn.send({ type: 'STATE_UPDATE', gameState: $state.snapshot(networkState.gameState) });
        return;
      }
      piece.ep = Math.max(0, currentEp - dashEpCost);
      piece.x = x;
      piece.z = z;
      piece.animationEffect = { type: 'dash', timestamp: Date.now() };
      networkState.addLog(`${piece.name} usou Dash para (${x}, ${z})! EP restante: ${piece.ep}`);
      networkState.broadcastGameState();
      return;
    }

    if (data.type === 'INTENT_MOVE') {
      const { pieceId, x, y, z } = data;
      const piece = networkState.getPiece(pieceId);

      if (!piece) {
        networkState.addLog(`Ignored move: Piece ${pieceId} not found.`);
        return;
      }

      // Role check authority
      if (piece.class === 'personagem') {
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

        piece.x = x;
        piece.y = y;
        piece.z = z;
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

  // Undo GM action
  undo() {
    if (networkState.role !== 'host') return;
    if (networkState.undoStack.length === 0) {
      networkState.addLog('Nada para desfazer (Ctrl+Z).');
      return;
    }
    const prevState = networkState.undoStack.pop();
    networkState.gameState = prevState;
    networkState.lastAuthoritativeState = $state.snapshot(prevState);
    networkState.broadcastGameState();
    networkState.addLog('Ação desfeita (Ctrl+Z).');
  },

  // Broadcast game state to all clients
  broadcastGameState() {
    if (networkState.role !== 'host') return;
    
    clearTimeout(broadcastTimeout);
    broadcastTimeout = setTimeout(() => {
      const snap = $state.snapshot(networkState.gameState);
      
      // Check if we need to initialize lastAuthoritativeState
      if (!networkState.lastAuthoritativeState) {
        networkState.lastAuthoritativeState = snap;
      } else {
        const snapStr = JSON.stringify(snap);
        const lastStr = JSON.stringify(networkState.lastAuthoritativeState);
        if (snapStr !== lastStr) {
          networkState.undoStack.push(networkState.lastAuthoritativeState);
          if (networkState.undoStack.length > 50) {
            networkState.undoStack.shift();
          }
          networkState.lastAuthoritativeState = snap;
        }
      }

      networkState.connections.forEach(conn => {
        if (conn.open) {
          conn.send({
            type: 'STATE_UPDATE',
            gameState: snap
          });
        }
      });
    }, 50);
  },

  // Move request execution
  requestMove(pieceId, x, y, z) {
    const piece = networkState.getPiece(pieceId);
    if (!piece) return;

    const buildMode = networkState.gameState.buildMode;

    if (networkState.role === 'host') {
      const isOverride = (pieceId === networkState.draggedPieceId || pieceId === networkState.moveLockPieceId || networkState.activeTool === 'move');
      if (!isOverride) {
        if (piece.class === 'objeto' && !buildMode) {
          networkState.addLog(`BLOCKED: Host cannot move object ${piece.name} because Build Mode is OFF.`);
          return;
        }
        if (piece.class === 'personagem' && buildMode) {
          networkState.addLog(`BLOCKED: Host cannot move character ${piece.name} while Build Mode is active.`);
          return;
        }
      }
      
      piece.x = x;
      piece.y = y;
      piece.z = z;
      networkState.addLog(`Host moved ${piece.name} to (${x}, ${y}, ${z})`);
      networkState.broadcastGameState();
    } else if (networkState.role === 'client') {
      console.log('[DEBUG] requestMove client path', 'pieceId:', pieceId, 'target:', x, y, z, 'hostConnection:', !!networkState.hostConnection, 'open:', networkState.hostConnection?.open);
      if (piece.class === 'objeto') {
        networkState.addLog(`BLOCKED: Clients cannot move object pieces.`);
        return;
      }
      
      const dist = getHexDistance(piece.x, piece.z, x, z);
      console.log('[DEBUG] requestMove dist:', dist);
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
        console.log('[DEBUG] requestMove sending INTENT_MOVE...');
        networkState.hostConnection.send({
          type: 'INTENT_MOVE',
          pieceId,
          x,
          y,
          z
        });
      } else {
        console.log('[DEBUG] requestMove FAILED: no hostConnection or not open');
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
    const piece = networkState.getPiece(pieceId);
    if (piece) {
      piece.textureUrl = url;
      networkState.addLog(`Updated texture for piece: ${piece.name}`);
      networkState.broadcastGameState();
    }
  },



  async tokenImageFileToDataUrl(file, { maxSize = 768, quality = 0.82 } = {}) {
    if (!file || !file.type?.startsWith('image/')) return '';

    const originalDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = originalDataUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
    if (scale >= 1 && (preserveAlpha || file.size < 650000)) return originalDataUrl;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return preserveAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
  },

  // Update piece metadata from the inspector panel
  updatePieceDetails(pieceId, updates) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can edit piece details.');
      return;
    }

    const piece = networkState.getPiece(pieceId);
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
    if (typeof updates.x === 'number') {
      piece.x = updates.x;
    }
    if (typeof updates.y === 'number') {
      piece.y = updates.y;
    }
    if (typeof updates.z === 'number') {
      piece.z = updates.z;
    }
    if (typeof updates.rotation === 'number') {
      piece.rotation = updates.rotation;
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
    if (typeof updates.textureRepeat === 'number') {
      piece.textureRepeat = updates.textureRepeat;
    }
    if (typeof updates.scale === 'number') {
      piece.scale = updates.scale;
    }
    if (typeof updates.flipX === 'boolean') {
      piece.flipX = updates.flipX;
    }
    if (typeof updates.group === 'string') {
      piece.group = updates.group;
    }
    if (typeof updates.visibleOnMap === 'boolean') {
      piece.visibleOnMap = updates.visibleOnMap;
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
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';
    
    // Auto-stack height: check if there's an existing structure underneath, set base Y on top of it
    let baseHeight = 0;
    const envPieces = networkState.gameState.environments?.[envId]?.pieces || {};
    const allPieces = [...Object.values(networkState.gameState.pieces), ...Object.values(envPieces)];

    allPieces.forEach(p => {
      if (p.structureType && Math.abs(p.x - x) < (p.width || 1) && Math.abs(p.z - z) < (p.depth || 1)) {
        const height = p.height || (p.floors ? p.floors * 2.0 : 2.0);
        const topY = p.y + height;
        if (topY > baseHeight) {
          baseHeight = topY;
        }
      }
    });

    const newStructure = {
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
      photos: [],
      environmentId: envId
    };
    networkState.setPiece(id, newStructure);
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
    return networkState.getAllCurrentPieces().some(p => {
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
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';

    const newFloor = {
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
      photos: [],
      environmentId: envId
    };
    networkState.setPiece(id, newFloor);
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
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';

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

    const newWall = {
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
      photos: [],
      environmentId: envId
    };
    networkState.setPiece(id, newWall);
    networkState.addLog(`Drawn ${actualType} from (${x1}, ${z1}) to (${x2}, ${z2}) at level Y=${baseHeight}`);
    networkState.broadcastGameState();
  },

  addWallOpening(wallId, type) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can modify wall openings.');
      return;
    }
    const wall = networkState.getPiece(wallId);
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
    const wall = networkState.getPiece(wallId);
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
    const wall = networkState.getPiece(wallId);
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

    const wall = networkState.getPiece(wallId);
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

  updateBackgroundImageOpacity(opacity) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change background opacity.');
      return;
    }
    networkState.gameState.backgroundImageOpacity = Math.max(0.0, Math.min(1.0, opacity));
    
    // Also save in current environment config if present
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';
    if (networkState.gameState.environments && networkState.gameState.environments[envId]) {
      networkState.gameState.environments[envId].backgroundImageOpacity = networkState.gameState.backgroundImageOpacity;
    }

    networkState.broadcastGameState();
  },

  changeEnvironment(envId) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can change the environment.');
      return;
    }
    const currentEnvId = networkState.gameState.currentEnvironmentId || 'env-1';
    if (currentEnvId === envId) return;

    // 1. Initialize environments map if not present
    if (!networkState.gameState.environments) {
      networkState.gameState.environments = {};
    }
    if (!networkState.gameState.environments[currentEnvId]) {
      networkState.gameState.environments[currentEnvId] = {
        id: currentEnvId,
        name: currentEnvId === 'env-1' ? 'Gotei 13 (Soul Society)' : currentEnvId === 'env-2' ? 'Karakura Town' : 'Hueco Mundo',
        theme: networkState.gameState.theme || 'soul-society',
        backgroundImage: networkState.gameState.backgroundImage || '',
        backgroundImageOpacity: networkState.gameState.backgroundImageOpacity ?? 1.0,
        pieces: {}
      };
    }

    // 2. Save current active objects (class === 'objeto')
    const currentObjs = {};
    Object.keys(networkState.gameState.pieces).forEach(pId => {
      const piece = networkState.gameState.pieces[pId];
      if (piece && piece.class === 'objeto') {
        currentObjs[pId] = $state.snapshot(piece);
        delete networkState.gameState.pieces[pId];
      }
    });
    networkState.gameState.environments[currentEnvId].pieces = currentObjs;
    // Also save current background settings in the environment config
    networkState.gameState.environments[currentEnvId].theme = networkState.gameState.theme;
    networkState.gameState.environments[currentEnvId].backgroundImage = networkState.gameState.backgroundImage;
    networkState.gameState.environments[currentEnvId].backgroundImageOpacity = networkState.gameState.backgroundImageOpacity ?? 1.0;

    // 3. Ensure new environment exists in list
    const newEnv = networkState.gameState.environments[envId];
    if (!newEnv) {
      networkState.addLog(`Error: Environment ${envId} not found.`);
      return;
    }

    // 4. Load new environment's objects
    const newPieces = newEnv.pieces || {};
    Object.keys(newPieces).forEach(pId => {
      networkState.gameState.pieces[pId] = $state.snapshot(newPieces[pId]);
    });

    // 5. Update background / theme
    networkState.gameState.theme = newEnv.theme || 'soul-society';
    networkState.gameState.backgroundImage = newEnv.backgroundImage || '';
    networkState.gameState.backgroundImageOpacity = newEnv.backgroundImageOpacity ?? 1.0;
    networkState.gameState.currentEnvironmentId = envId;

    networkState.addLog(`Environment switched to: ${newEnv.name}`);
    networkState.broadcastGameState();
  },

  addEnvironment(name, theme = 'soul-society') {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can add environments.');
      return;
    }
    if (!networkState.gameState.environments) {
      networkState.gameState.environments = {};
    }
    
    // Auto-save current environment before adding and switching to the new one
    const currentEnvId = networkState.gameState.currentEnvironmentId || 'env-1';
    if (!networkState.gameState.environments[currentEnvId]) {
      networkState.gameState.environments[currentEnvId] = {
        id: currentEnvId,
        name: currentEnvId === 'env-1' ? 'Gotei 13 (Soul Society)' : currentEnvId === 'env-2' ? 'Karakura Town' : 'Hueco Mundo',
        theme: networkState.gameState.theme || 'soul-society',
        backgroundImage: networkState.gameState.backgroundImage || '',
        backgroundImageOpacity: networkState.gameState.backgroundImageOpacity ?? 1.0,
        pieces: {}
      };
    }
    const currentObjs = {};
    Object.keys(networkState.gameState.pieces).forEach(pId => {
      const piece = networkState.gameState.pieces[pId];
      if (piece && piece.class === 'objeto') {
        currentObjs[pId] = $state.snapshot(piece);
      }
    });
    networkState.gameState.environments[currentEnvId].pieces = currentObjs;
    networkState.gameState.environments[currentEnvId].theme = networkState.gameState.theme;
    networkState.gameState.environments[currentEnvId].backgroundImage = networkState.gameState.backgroundImage;
    networkState.gameState.environments[currentEnvId].backgroundImageOpacity = networkState.gameState.backgroundImageOpacity ?? 1.0;

    const envId = `env-custom-${Date.now()}`;
    const defaultName = `Ambiente ${Object.keys(networkState.gameState.environments).length + 1}`;
    networkState.gameState.environments[envId] = {
      id: envId,
      name: name?.trim() || defaultName,
      theme,
      backgroundImage: '',
      backgroundImageOpacity: 1.0,
      pieces: {}
    };

    networkState.addLog(`Created new environment: ${networkState.gameState.environments[envId].name}`);
    
    // Switch to the newly created environment
    // 1. Clear current active objects
    Object.keys(networkState.gameState.pieces).forEach(pId => {
      const piece = networkState.gameState.pieces[pId];
      if (piece && piece.class === 'objeto') {
        delete networkState.gameState.pieces[pId];
      }
    });
    // 2. Apply new environment values
    networkState.gameState.theme = theme;
    networkState.gameState.backgroundImage = '';
    networkState.gameState.backgroundImageOpacity = 1.0;
    networkState.gameState.currentEnvironmentId = envId;

    networkState.broadcastGameState();
  },

  deleteEnvironment(envId) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can delete environments.');
      return;
    }
    if (!networkState.gameState.environments || !networkState.gameState.environments[envId]) return;
    const keys = Object.keys(networkState.gameState.environments);
    if (keys.length <= 1) {
      networkState.addLog('BLOCKED: Cannot delete the last remaining environment.');
      return;
    }

    const envName = networkState.gameState.environments[envId].name;

    // If deleting the current environment, switch to another first
    if (networkState.gameState.currentEnvironmentId === envId) {
      const otherKey = keys.find(k => k !== envId);
      networkState.changeEnvironment(otherKey);
    }

    delete networkState.gameState.environments[envId];
    networkState.addLog(`Deleted environment: ${envName}`);
    networkState.broadcastGameState();
  },

  renameEnvironment(envId, newName) {
    if (networkState.role !== 'host') return;
    if (networkState.gameState.environments && networkState.gameState.environments[envId] && newName.trim()) {
      const oldName = networkState.gameState.environments[envId].name;
      networkState.gameState.environments[envId].name = newName.trim();
      networkState.addLog(`Renamed environment from "${oldName}" to "${newName.trim()}"`);
      networkState.broadcastGameState();
    }
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
    const idPrefix = pieceClass === 'personagem' ? 'p' : 'o';
    const id = `${idPrefix}-custom-${Date.now()}`;
    const midPoint = Math.floor((networkState.gameState.gridSize || 24) / 2);
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';
    const newPiece = {
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
      ep: pieceClass === 'personagem' ? 100 : null,
      maxEp: pieceClass === 'personagem' ? 100 : null,
      dashRange: pieceClass === 'personagem' ? 3 : null,
      dashEpCost: pieceClass === 'personagem' ? 20 : null,
      notes: '',
      photos: [],
      environmentId: envId
    };
    networkState.setPiece(id, newPiece);
    networkState.selectedPieceId = id;
    networkState.addLog(`Added new piece: ${name} (${pieceClass})`);
    networkState.broadcastGameState();
  },

  // Update piece character sheet (HP, notes) — available to GM and clients for own chars
  updatePieceSheet(pieceId, updates) {
    const piece = networkState.getPiece(pieceId);
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
      if (typeof updates.ep === 'number') piece.ep = Math.max(0, Math.min(piece.maxEp ?? 9999, updates.ep));
      if (typeof updates.maxEp === 'number') piece.maxEp = Math.max(1, updates.maxEp);
      if (typeof updates.dashRange === 'number') piece.dashRange = Math.max(1, Math.min(10, updates.dashRange));
      if (typeof updates.dashEpCost === 'number') piece.dashEpCost = Math.max(0, Math.min(200, updates.dashEpCost));
      if (typeof updates.notes === 'string') piece.notes = updates.notes;
      if (Array.isArray(updates.photos)) piece.photos = updates.photos;
      if (typeof updates.dead === 'boolean') piece.dead = updates.dead;
      if (typeof updates.stunned === 'boolean') piece.stunned = updates.stunned;
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
      if (typeof updates.ep === 'number') piece.ep = Math.max(0, Math.min(piece.maxEp ?? 9999, updates.ep));
      if (typeof updates.notes === 'string') piece.notes = updates.notes;
      if (typeof updates.dead === 'boolean') piece.dead = updates.dead;
      if (typeof updates.stunned === 'boolean') piece.stunned = updates.stunned;
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({
          type: 'INTENT_UPDATE_SHEET',
          pieceId,
          hp: piece.hp,
          ep: piece.ep,
          notes: piece.notes,
          dead: piece.dead,
          stunned: piece.stunned
        });
      }
    }
  },

  // Execute a dash move (validates EP cost and range)
  requestDash(pieceId, targetX, targetZ) {
    const piece = networkState.gameState.pieces[pieceId];
    if (!piece || piece.class !== 'personagem') return;
    const dashRange = piece.dashRange ?? 3;
    const dashEpCost = piece.dashEpCost ?? 20;
    const currentEp = piece.ep ?? 0;
    const dist = getHexDistance(piece.x, piece.z, targetX, targetZ);

    if (dist > dashRange) {
      networkState.addLog(`BLOCKED: Dash range exceeded (${dist}/${dashRange} hexes).`);
      return;
    }
    if (currentEp < dashEpCost) {
      networkState.addLog(`BLOCKED: EP insuficiente para Dash (${currentEp}/${dashEpCost}).`);
      return;
    }

    if (networkState.role === 'host') {
      if (networkState.isCellBlocked(targetX, targetZ)) {
        networkState.addLog(`BLOCKED: Destino do Dash bloqueado por parede.`);
        return;
      }
      piece.ep = Math.max(0, currentEp - dashEpCost);
      piece.x = targetX;
      piece.z = targetZ;
      piece.animationEffect = { type: 'dash', timestamp: Date.now() };
      networkState.addLog(`${piece.name} usou Dash para (${targetX}, ${targetZ})! EP restante: ${piece.ep}`);
      networkState.broadcastGameState();
    } else if (networkState.role === 'client') {
      // Optimistic local EP deduction
      piece.ep = Math.max(0, currentEp - dashEpCost);
      piece.animationEffect = { type: 'dash', timestamp: Date.now() };
      if (networkState.hostConnection && networkState.hostConnection.open) {
        networkState.hostConnection.send({ type: 'INTENT_DASH', pieceId, x: targetX, z: targetZ });
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

  getAllCurrentPieces() {
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';
    const envPieces = networkState.gameState.environments?.[envId]?.pieces || {};
    const globalPieces = Object.values(networkState.gameState.pieces || {}).filter(p => (p.environmentId || 'env-1') === envId);
    return [...globalPieces, ...Object.values(envPieces)];
  },

  getHouseContainingPiece(pieceId) {
    const piece = networkState.gameState.pieces[pieceId];
    if (!piece || piece.class !== 'personagem') return null;

    return networkState.getAllCurrentPieces().find((candidate) => {
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

    networkState.getAllCurrentPieces().forEach(p => {
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
    networkState.getAllCurrentPieces().forEach(p => {
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
    return networkState.getAllCurrentPieces().some(p => {
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
    const piece = networkState.getPiece(pieceId);
    if (piece) {
      delete networkState.gameState.pieces[pieceId];
      const envs = networkState.gameState.environments || {};
      Object.keys(envs).forEach(envId => {
        if (envs[envId].pieces) {
          delete envs[envId].pieces[pieceId];
        }
      });
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

  // ── Turn System ──────────────────────────────────────────────────
  rollInitiative() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can roll initiative.');
      return;
    }

    const characters = Object.values(networkState.gameState.pieces)
      .filter(p => p.class === 'personagem');

    if (characters.length === 0) {
      networkState.addLog('No characters found to roll initiative.');
      return;
    }

    const entries = characters.map(p => ({
      pieceId: p.id,
      name: p.name,
      textureUrl: p.textureUrl || '',
      color: p.color || '#a855f7',
      initiative: Math.floor(Math.random() * 20) + 1
    }));

    entries.sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));

    networkState.gameState.turnOrder = entries;
    networkState.gameState.currentTurnIndex = 0;
    networkState.gameState.turnPhase = 'active';

    const logDetails = entries.map((e, i) => `${i + 1}. ${e.name} (${e.initiative})`).join(' | ');
    networkState.addLog(`Initiative rolled! Order: ${logDetails}`);
    networkState.addLog(`>> Turn 1: ${entries[0]?.name || '?'}`);
    networkState.broadcastGameState();
  },

  nextTurn() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can advance turns.');
      return;
    }
    const order = networkState.gameState.turnOrder;
    if (!order || order.length === 0) return;

    const next = (networkState.gameState.currentTurnIndex + 1) % order.length;
    networkState.gameState.currentTurnIndex = next;
    networkState.addLog(`>> Turn ${next + 1}: ${order[next]?.name || '?'}`);
    networkState.broadcastGameState();
  },

  prevTurn() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can go back turns.');
      return;
    }
    const order = networkState.gameState.turnOrder;
    if (!order || order.length === 0) return;

    const prev = (networkState.gameState.currentTurnIndex - 1 + order.length) % order.length;
    networkState.gameState.currentTurnIndex = prev;
    networkState.addLog(`<< Turn ${prev + 1}: ${order[prev]?.name || '?'}`);
    networkState.broadcastGameState();
  },

  setTurnOrder(newOrder) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can reorder turns.');
      return;
    }
    if (!Array.isArray(newOrder)) return;
    networkState.gameState.turnOrder = newOrder;
    networkState.addLog('Turn order updated by GM.');
    networkState.broadcastGameState();
  },

  moveTurnItem(fromIndex, toIndex) {
    if (networkState.role !== 'host') return;
    const order = [...networkState.gameState.turnOrder];
    if (fromIndex < 0 || fromIndex >= order.length) return;
    if (toIndex < 0 || toIndex >= order.length) return;
    if (fromIndex === toIndex) return;

    const [item] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, item);

    // Adjust currentTurnIndex if needed
    let cur = networkState.gameState.currentTurnIndex;
    if (fromIndex === cur) {
      cur = toIndex;
    } else {
      if (fromIndex < cur && toIndex >= cur) cur--;
      else if (fromIndex > cur && toIndex <= cur) cur++;
    }

    networkState.gameState.turnOrder = order;
    networkState.gameState.currentTurnIndex = Math.max(0, Math.min(order.length - 1, cur));
    networkState.addLog('Turn order reordered by GM.');
    networkState.broadcastGameState();
  },

  resetTurns() {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can reset turns.');
      return;
    }
    networkState.gameState.turnOrder = [];
    networkState.gameState.currentTurnIndex = 0;
    networkState.gameState.turnPhase = 'idle';
    networkState.addLog('Turn order cleared.');
    networkState.broadcastGameState();
  },

  // Trigger a GM spiritual burst/particles
  triggerParticles(x, z, effectType = 'burst') {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can trigger particles.');
      return;
    }
    const burst = {
      id: `burst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x,
      z,
      effectType,
      timestamp: Date.now()
    };
    networkState.gameState.activeParticles = [burst, ...networkState.gameState.activeParticles.slice(0, 4)];
    networkState.addLog(`GM triggered a ${effectType} particle effect at (${x}, ${z})!`);
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

  // 3D Shape Creator
  add3DShape(name, shapeType, color, size = 1) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can create 3D shapes.');
      return;
    }
    const id = `shape-${Date.now()}`;
    const midPoint = Math.floor((networkState.gameState.gridSize || 24) / 2);
    const envId = networkState.gameState.currentEnvironmentId || 'env-1';

    const newShape = {
      id,
      name,
      class: 'objeto',
      structureType: '3d-shape',
      shapeType,
      x: midPoint,
      y: 0,
      z: midPoint,
      color,
      width: size,
      depth: size,
      height: size,
      textureUrl: '',
      modelUrl: '',
      hp: null,
      maxHp: null,
      notes: '',
      photos: [],
      environmentId: envId
    };
    networkState.setPiece(id, newShape);
    networkState.addLog(`Added 3D shape: ${name} (${shapeType}, size: ${size})`);
    networkState.broadcastGameState();
  },

  async importModel(file) {
    if (networkState.role !== 'host') {
      networkState.addLog('BLOCKED: Only the Host can import 3D models.');
      return;
    }
    if (!file || !file.name.match(/\.(glb|gltf)$/i)) {
      networkState.addLog('BLOCKED: Please select a .glb or .gltf file.');
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      networkState.addLog(`BLOCKED: File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 5MB.`);
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const id = `shape-${Date.now()}`;
      const midPoint = Math.floor((networkState.gameState.gridSize || 24) / 2);
      const envId = networkState.gameState.currentEnvironmentId || 'env-1';

      const newShape = {
        id,
        name: file.name.replace(/\.[^/.]+$/, ''),
        class: 'objeto',
        structureType: '3d-shape',
        shapeType: 'imported',
        x: midPoint,
        y: 0,
        z: midPoint,
        color: '#ffffff',
        modelUrl: dataUrl,
        width: undefined,
        depth: undefined,
        height: undefined,
        radius: undefined,
        hp: null,
        maxHp: null,
        notes: '',
        photos: [],
        environmentId: envId
      };
      networkState.setPiece(id, newShape);
      networkState.addLog(`Imported 3D model: ${file.name} (${(dataUrl.length / 1024 / 1024).toFixed(1)}MB)`);
      networkState.broadcastGameState();
    } catch (err) {
      networkState.addLog(`FAILED to import model: ${err.message}`);
    }
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

networkState.loadRecentTextures();
