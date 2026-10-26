/**
 * CONTROLADOR PRINCIPAL DE LA APLICACIÓN (UI, AUDIO MEDIEVAL, IA Y FLUJO DE TURNOS)
 */

class MedievalSoundFX {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playMove() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.09);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playCapture() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Sonido metálico de espada / piedra
    [280, 420, 190].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 1 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.18);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    });
  }

  playCheck() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [440, 554.37].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.22, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  playVictory() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.24, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.56);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const viewportEl = document.getElementById('castle-viewport');
  const engine = new ChessEngine();
  const sfx = new MedievalSoundFX();

  let gameMode = 'ai';       // 'ai' | 'pvp'
  let playerColor = 'w';     // 'w' | 'b' cuando se juega contra IA
  let aiDepth = 2;           // 1 = Escudero, 2 = Caballero, 3 = Gran Maestre
  let autoRotateCam = false;
  let selectedSquare = null;
  let currentLegalMoves = [];
  let pendingPromotionMoves = null;
  let aiThinking = false;

  const scene3D = new CastleChessScene(viewportEl, {
    onSquareClick: handleSquareClick
  });

  scene3D.syncBoardFromEngine(engine, null);
  scene3D.startRenderLoop();
  updateHUD();

  // ===========================================================================
  // MANEJO DE CLICS EN EL TABLERO 3D
  // ===========================================================================

  function handleSquareClick(r, c) {
    if (aiThinking || pendingPromotionMoves) return;
    const status = engine.getGameStatus();
    if (status.over) return;

    // Si es turno de la IA, ignorar clics del jugador
    if (gameMode === 'ai' && engine.turn !== playerColor) return;

    // ¿Se hizo clic en una casilla destino válida para la pieza seleccionada?
    if (selectedSquare) {
      const matchingMoves = currentLegalMoves.filter(m => m.toR === r && m.toC === c);
      if (matchingMoves.length > 0) {
        if (matchingMoves.length > 1 && matchingMoves[0].promotion) {
          // Mostrar modal de coronación de peón
          pendingPromotionMoves = matchingMoves;
          openPromotionModal(engine.turn);
          return;
        }
        executeMove(matchingMoves[0]);
        return;
      }
    }

    // Seleccionar pieza propia
    const clickedPiece = engine.board[r][c];
    if (clickedPiece && clickedPiece.color === engine.turn) {
      selectedSquare = { r, c };
      currentLegalMoves = engine.getLegalMovesForSquare(r, c);
      refreshBoardHighlights();
    } else {
      selectedSquare = null;
      currentLegalMoves = [];
      refreshBoardHighlights();
    }
  }

  function executeMove(move) {
    selectedSquare = null;
    currentLegalMoves = [];

    const record = engine.makeMove(move);
    scene3D.syncBoardFromEngine(engine, record);

    const status = engine.getGameStatus();
    if (status.over && status.reason === 'checkmate') {
      sfx.playVictory();
    } else if (status.inCheck) {
      sfx.playCheck();
    } else if (move.capture) {
      sfx.playCapture();
    } else {
      sfx.playMove();
    }

    refreshBoardHighlights();
    updateHUD();

    if (!status.over) {
      if (gameMode === 'pvp' && autoRotateCam) {
        scene3D.setCameraPreset(engine.turn === 'w' ? 'white' : 'black');
      } else if (gameMode === 'ai' && engine.turn !== playerColor) {
        triggerAIMove();
      }
    }
  }

  function triggerAIMove() {
    aiThinking = true;
    updateHUD();

    setTimeout(() => {
      const aiMove = engine.chooseBestMove(aiDepth);
      aiThinking = false;
      if (aiMove) {
        executeMove(aiMove);
      } else {
        updateHUD();
      }
    }, 420);
  }

  function refreshBoardHighlights() {
    const lastRec = engine.history[engine.history.length - 1];
    const lastMove = lastRec ? lastRec.move : null;
    const checkKing = engine.inCheck(engine.turn) ? engine.findKing(engine.turn) : null;

    scene3D.showHighlights({
      selectedSquare,
      legalMoves: currentLegalMoves,
      lastMove,
      checkSquare: checkKing
    });
  }

  // ===========================================================================
  // MODAL DE PROMOCIÓN DE PEÓN
  // ===========================================================================

  const promoModal = document.getElementById('promotion-modal');
  function openPromotionModal(color) {
    promoModal.classList.remove('hidden');
    const symbols = color === 'w'
      ? { Q: '♕', R: '♖', B: '♗', N: '♘' }
      : { Q: '♛', R: '♜', B: '♝', N: '♞' };

    document.querySelectorAll('.promo-btn').forEach(btn => {
      const pType = btn.dataset.piece;
      btn.querySelector('.promo-icon').textContent = symbols[pType];
    });
  }

  document.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!pendingPromotionMoves) return;
      const chosenType = btn.dataset.piece;
      const chosenMove =
        pendingPromotionMoves.find(m => m.promotion === chosenType) || pendingPromotionMoves[0];
      pendingPromotionMoves = null;
      promoModal.classList.add('hidden');
      executeMove(chosenMove);
    });
  });

  // ===========================================================================
  // ACTUALIZACIÓN DEL HUD MEDIEVAL
  // ===========================================================================

  function updateHUD() {
    const status = engine.getGameStatus();
    const turnBadge = document.getElementById('turn-badge');
    const statusBanner = document.getElementById('status-banner');

    if (status.over) {
      turnBadge.textContent = 'Partida Finalizada';
      turnBadge.className = 'turn-badge game-over';
      statusBanner.textContent = status.message;
      statusBanner.classList.remove('hidden');
    } else {
      const isWhite = engine.turn === 'w';
      const turnText = isWhite ? 'Turno: Reino de Marfil (Blancas)' : 'Turno: Reino de Obsidiana (Negras)';
      turnBadge.textContent = aiThinking ? 'El Gran Maestre está pensando...' : turnText;
      turnBadge.className = `turn-badge ${isWhite ? 'white-turn' : 'black-turn'}`;

      if (status.inCheck) {
        statusBanner.textContent = '¡JAQUE AL REY!';
        statusBanner.classList.remove('hidden');
      } else {
        statusBanner.classList.add('hidden');
      }
    }

    // Piezas capturadas
    const whiteIcons = { P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' };
    const blackIcons = { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' };

    // Capturadas por Blancas = piezas negras fuera del tablero
    document.getElementById('captured-by-white').textContent =
      engine.captured.b.map(p => blackIcons[p.type]).join(' ') || '—';
    // Capturadas por Negras = piezas blancas fuera del tablero
    document.getElementById('captured-by-black').textContent =
      engine.captured.w.map(p => whiteIcons[p.type]).join(' ') || '—';

    // Historial algebraico de jugadas
    const movesList = document.getElementById('moves-list');
    movesList.innerHTML = '';
    for (let i = 0; i < engine.history.length; i += 2) {
      const wRec = engine.history[i];
      const bRec = engine.history[i + 1];
      const row = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = `
        <span class="move-num">${Math.floor(i / 2) + 1}.</span>
        <span class="move-san">${wRec ? wRec.san : ''}</span>
        <span class="move-san">${bRec ? bRec.san : ''}</span>
      `;
      movesList.appendChild(row);
    }
    movesList.scrollTop = movesList.scrollHeight;
  }

  // ===========================================================================
  // CONTROLES Y BOTONES DE LA INTERFAZ
  // ===========================================================================

  function startNewGame() {
    aiThinking = false;
    pendingPromotionMoves = null;
    selectedSquare = null;
    currentLegalMoves = [];
    engine.reset();
    scene3D.syncBoardFromEngine(engine, null);
    refreshBoardHighlights();
    updateHUD();

    if (gameMode === 'ai' && playerColor === 'b') {
      scene3D.setCameraPreset('black');
      triggerAIMove();
    } else {
      scene3D.setCameraPreset('white');
    }
  }

  document.getElementById('btn-new-game').addEventListener('click', startNewGame);

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (aiThinking || engine.history.length === 0) return;
    engine.undo();
    if (gameMode === 'ai' && engine.turn !== playerColor && engine.history.length > 0) {
      engine.undo();
    }
    selectedSquare = null;
    currentLegalMoves = [];
    scene3D.syncBoardFromEngine(engine, null);
    refreshBoardHighlights();
    updateHUD();
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    if (aiThinking || engine.getGameStatus().over) return;
    const best = engine.chooseBestMove(2);
    if (best) {
      selectedSquare = { r: best.fromR, c: best.fromC };
      currentLegalMoves = [best];
      refreshBoardHighlights();
    }
  });

  document.getElementById('select-mode').addEventListener('change', e => {
    gameMode = e.target.value;
    document.getElementById('ai-options-group').style.display = gameMode === 'ai' ? 'flex' : 'none';
    document.getElementById('pvp-options-group').style.display = gameMode === 'pvp' ? 'flex' : 'none';
    startNewGame();
  });

  document.getElementById('select-side').addEventListener('change', e => {
    playerColor = e.target.value;
    startNewGame();
  });

  document.getElementById('select-difficulty').addEventListener('change', e => {
    aiDepth = parseInt(e.target.value, 10) || 2;
  });

  document.getElementById('chk-autorotate').addEventListener('change', e => {
    autoRotateCam = e.target.checked;
  });

  // Vistas de cámara
  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => {
      scene3D.setCameraPreset(btn.dataset.cam);
    });
  });

  // Intensidad de antorchas
  document.getElementById('slider-torches').addEventListener('input', e => {
    scene3D.setTorchIntensity(parseFloat(e.target.value));
  });

  // Audio
  const btnSound = document.getElementById('btn-sound');
  btnSound.addEventListener('click', () => {
    sfx.enabled = !sfx.enabled;
    btnSound.textContent = sfx.enabled ? '🔊 Sonido: Activo' : '🔇 Sonido: Silencio';
  });

  // Importador de .GLB de Blender
  const glbInput = document.getElementById('input-glb');
  document.getElementById('btn-import-glb').addEventListener('click', () => {
    glbInput.click();
  });
  glbInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    scene3D.loadCustomBlenderGLB(
      file,
      () => alert(`Modelo 3D de Blender "${file.name}" cargado en el Salón Medieval.`),
      err => alert(`No se pudo cargar el archivo .glb: ${err}`)
    );
  });

  // Modal con instrucciones del script de Blender
  const blenderModal = document.getElementById('blender-modal');
  document.getElementById('btn-blender-info').addEventListener('click', () => {
    blenderModal.classList.remove('hidden');
  });
  document.getElementById('btn-close-blender-modal').addEventListener('click', () => {
    blenderModal.classList.add('hidden');
  });
});
