/**
 * MOTOR COMPLETO DE AJEDREZ + IA (MINIMAX CON PODA ALFA-BETA)
 * Soporta todas las reglas oficiales:
 * - Movimientos legales con validación de rey en jaque / piezas clavadas
 * - Enroque corto (O-O) y largo (O-O-O)
 * - Captura al paso (En Passant)
 * - Promoción de peón (Reina, Torre, Alfil, Caballo)
 * - Detección de Jaque, Jaque Mate, Rey Ahogado y Tablas por material insuficiente / 50 movimientos
 */

class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    // Tablero 8x8: fila 0 = rango 1 (Blancas), fila 7 = rango 8 (Negras)
    // Columna 0 = columna A, columna 7 = columna H
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    this.turn = 'w'; // 'w' | 'b'
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassant = null; // { r, c } casilla objetivo de captura al paso
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.history = [];
    this.captured = { w: [], b: [] }; // w: piezas blancas capturadas, b: piezas negras capturadas
    this.setupInitialPosition();
  }

  setupInitialPosition() {
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { type: backRank[c], color: 'w', id: `w_${backRank[c]}_${c}` };
      this.board[1][c] = { type: 'P', color: 'w', id: `w_P_${c}` };
      this.board[6][c] = { type: 'P', color: 'b', id: `b_P_${c}` };
      this.board[7][c] = { type: backRank[c], color: 'b', id: `b_${backRank[c]}_${c}` };
    }
  }

  cloneState() {
    return {
      board: this.board.map(row => row.map(cell => (cell ? { ...cell } : null))),
      turn: this.turn,
      castling: { ...this.castling },
      enPassant: this.enPassant ? { ...this.enPassant } : null,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      captured: {
        w: [...this.captured.w],
        b: [...this.captured.b]
      }
    };
  }

  restoreState(state) {
    this.board = state.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    this.turn = state.turn;
    this.castling = { ...state.castling };
    this.enPassant = state.enPassant ? { ...state.enPassant } : null;
    this.halfMoveClock = state.halfMoveClock;
    this.fullMoveNumber = state.fullMoveNumber;
    this.captured = {
      w: [...state.captured.w],
      b: [...state.captured.b]
    };
  }

  inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  findKing(color, board = this.board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'K') {
          return { r, c };
        }
      }
    }
    return null;
  }

  isSquareAttacked(r, c, byColor, board = this.board) {
    // 1. Ataques de peones
    const pawnDir = byColor === 'w' ? -1 : 1; // fila desde donde ataca el peón
    const pr = r + pawnDir;
    if (this.inBounds(pr, c - 1)) {
      const p = board[pr][c - 1];
      if (p && p.color === byColor && p.type === 'P') return true;
    }
    if (this.inBounds(pr, c + 1)) {
      const p = board[pr][c + 1];
      if (p && p.color === byColor && p.type === 'P') return true;
    }

    // 2. Ataques de caballo
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightMoves) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.color === byColor && p.type === 'N') return true;
      }
    }

    // 3. Ataques de rey
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (this.inBounds(nr, nc)) {
          const p = board[nr][nc];
          if (p && p.color === byColor && p.type === 'K') return true;
        }
      }
    }

    // 4. Líneas rectas (Torre / Reina)
    const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of orthoDirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (this.inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // 5. Diagonales (Alfil / Reina)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (this.inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    return false;
  }

  inCheck(color = this.turn, board = this.board) {
    const kingPos = this.findKing(color, board);
    if (!kingPos) return false;
    const enemy = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(kingPos.r, kingPos.c, enemy, board);
  }

  getPseudoMovesForSquare(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const moves = [];
    const { type, color } = piece;
    const enemy = color === 'w' ? 'b' : 'w';

    if (type === 'P') {
      const dir = color === 'w' ? 1 : -1;
      const startRow = color === 'w' ? 1 : 6;
      const promoRow = color === 'w' ? 7 : 0;

      // Avance 1 casilla
      const nr = r + dir;
      if (this.inBounds(nr, c) && !this.board[nr][c]) {
        if (nr === promoRow) {
          ['Q', 'R', 'B', 'N'].forEach(promo => {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: c, promotion: promo });
          });
        } else {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: c });
          // Avance 2 casillas desde posición inicial
          const nr2 = r + dir * 2;
          if (r === startRow && !this.board[nr2][c]) {
            moves.push({ fromR: r, fromC: c, toR: nr2, toC: c, doublePawn: true });
          }
        }
      }

      // Capturas diagonales
      for (const dc of [-1, 1]) {
        const nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (target && target.color === enemy) {
          if (nr === promoRow) {
            ['Q', 'R', 'B', 'N'].forEach(promo => {
              moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: target, promotion: promo });
            });
          } else {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: target });
          }
        } else if (this.enPassant && this.enPassant.r === nr && this.enPassant.c === nc) {
          const epTarget = this.board[r][nc];
          if (epTarget && epTarget.color === enemy) {
            moves.push({
              fromR: r,
              fromC: c,
              toR: nr,
              toC: nc,
              enPassant: true,
              capture: epTarget,
              epCaptureR: r,
              epCaptureC: nc
            });
          }
        }
      }
    } else if (type === 'N') {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of jumps) {
        const nr = r + dr;
        const nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target) {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
        } else if (target.color === enemy) {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: target });
        }
      }
    } else if (type === 'B' || type === 'R' || type === 'Q') {
      const dirs = [];
      if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (this.inBounds(nr, nc)) {
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
          } else {
            if (target.color === enemy) {
              moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: target });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!this.inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
          } else if (target.color === enemy) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, capture: target });
          }
        }
      }

      // Enroque
      const homeRow = color === 'w' ? 0 : 7;
      if (r === homeRow && c === 4 && !this.inCheck(color)) {
        // Corto (Rey a columna 6 / G)
        const canShort = color === 'w' ? this.castling.wK : this.castling.bK;
        if (
          canShort &&
          !this.board[homeRow][5] &&
          !this.board[homeRow][6] &&
          this.board[homeRow][7] &&
          this.board[homeRow][7].type === 'R' &&
          this.board[homeRow][7].color === color &&
          !this.isSquareAttacked(homeRow, 5, enemy) &&
          !this.isSquareAttacked(homeRow, 6, enemy)
        ) {
          moves.push({
            fromR: homeRow,
            fromC: 4,
            toR: homeRow,
            toC: 6,
            castling: 'K',
            rookFromC: 7,
            rookToC: 5
          });
        }

        // Largo (Rey a columna 2 / C)
        const canLong = color === 'w' ? this.castling.wQ : this.castling.bQ;
        if (
          canLong &&
          !this.board[homeRow][3] &&
          !this.board[homeRow][2] &&
          !this.board[homeRow][1] &&
          this.board[homeRow][0] &&
          this.board[homeRow][0].type === 'R' &&
          this.board[homeRow][0].color === color &&
          !this.isSquareAttacked(homeRow, 3, enemy) &&
          !this.isSquareAttacked(homeRow, 2, enemy)
        ) {
          moves.push({
            fromR: homeRow,
            fromC: 4,
            toR: homeRow,
            toC: 2,
            castling: 'Q',
            rookFromC: 0,
            rookToC: 3
          });
        }
      }
    }

    return moves;
  }

  getLegalMovesForSquare(r, c) {
    const piece = this.board[r][c];
    if (!piece || piece.color !== this.turn) return [];
    const pseudo = this.getPseudoMovesForSquare(r, c);
    const legal = [];

    for (const move of pseudo) {
      const snapshot = this.cloneState();
      this.applyMoveInternal(move);
      const kingIllegal = this.inCheck(piece.color, this.board);
      this.restoreState(snapshot);
      if (!kingIllegal) {
        legal.push(move);
      }
    }
    return legal;
  }

  getAllLegalMoves(color = this.turn) {
    const prevTurn = this.turn;
    this.turn = color;
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          all.push(...this.getLegalMovesForSquare(r, c));
        }
      }
    }
    this.turn = prevTurn;
    return all;
  }

  applyMoveInternal(move) {
    const piece = this.board[move.fromR][move.fromC];
    this.board[move.fromR][move.fromC] = null;

    if (move.enPassant) {
      this.board[move.epCaptureR][move.epCaptureC] = null;
    }

    if (move.castling) {
      const rook = this.board[move.fromR][move.rookFromC];
      this.board[move.fromR][move.rookFromC] = null;
      this.board[move.fromR][move.rookToC] = rook;
    }

    const placedPiece = { ...piece };
    if (move.promotion) {
      placedPiece.type = move.promotion;
    }
    this.board[move.toR][move.toC] = placedPiece;

    // Actualizar permisos de enroque
    if (piece.type === 'K') {
      if (piece.color === 'w') {
        this.castling.wK = false;
        this.castling.wQ = false;
      } else {
        this.castling.bK = false;
        this.castling.bQ = false;
      }
    }
    if (piece.type === 'R') {
      if (move.fromR === 0 && move.fromC === 0) this.castling.wQ = false;
      if (move.fromR === 0 && move.fromC === 7) this.castling.wK = false;
      if (move.fromR === 7 && move.fromC === 0) this.castling.bQ = false;
      if (move.fromR === 7 && move.fromC === 7) this.castling.bK = false;
    }
    // Si una torre es capturada en su esquina
    if (move.toR === 0 && move.toC === 0) this.castling.wQ = false;
    if (move.toR === 0 && move.toC === 7) this.castling.wK = false;
    if (move.toR === 7 && move.toC === 0) this.castling.bQ = false;
    if (move.toR === 7 && move.toC === 7) this.castling.bK = false;

    // Actualizar casilla de en-passant
    if (move.doublePawn) {
      this.enPassant = {
        r: (move.fromR + move.toR) / 2,
        c: move.fromC
      };
    } else {
      this.enPassant = null;
    }

    // Reloj de 50 movimientos y capturas
    if (piece.type === 'P' || move.capture) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    if (move.capture) {
      this.captured[move.capture.color].push(move.capture);
    }

    if (this.turn === 'b') {
      this.fullMoveNumber++;
    }
    this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  makeMove(move) {
    const prevState = this.cloneState();
    const movingPiece = { ...this.board[move.fromR][move.fromC] };
    const sanBase = this.buildSANBase(move, movingPiece);

    this.applyMoveInternal(move);

    const inChk = this.inCheck(this.turn);
    const nextLegal = this.getAllLegalMoves(this.turn);
    let suffix = '';
    if (inChk) {
      suffix = nextLegal.length === 0 ? '#' : '+';
    }
    const san = sanBase + suffix;

    const record = {
      move,
      movingPiece,
      san,
      prevState,
      turnPlayed: movingPiece.color,
      moveNumber: prevState.fullMoveNumber
    };
    this.history.push(record);
    return record;
  }

  undo() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    this.restoreState(last.prevState);
    return last;
  }

  buildSANBase(move, piece) {
    if (move.castling === 'K') return 'O-O';
    if (move.castling === 'Q') return 'O-O-O';

    const files = 'abcdefgh';
    const toSq = `${files[move.toC]}${move.toR + 1}`;
    const fromFile = files[move.fromC];

    if (piece.type === 'P') {
      let str = move.capture ? `${fromFile}x${toSq}` : toSq;
      if (move.promotion) str += `=${move.promotion}`;
      return str;
    }

    const pieceLetters = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
    const letter = pieceLetters[piece.type] || piece.type;
    const cap = move.capture ? 'x' : '';
    return `${letter}${cap}${toSq}`;
  }

  getGameStatus() {
    const legalMoves = this.getAllLegalMoves(this.turn);
    const check = this.inCheck(this.turn);

    if (legalMoves.length === 0) {
      if (check) {
        return {
          over: true,
          result: this.turn === 'w' ? 'b' : 'w',
          reason: 'checkmate',
          message: this.turn === 'w'
            ? '¡Jaque Mate! Victoria del Reino Oscuro (Negras)'
            : '¡Jaque Mate! Victoria del Reino de Marfil (Blancas)'
        };
      }
      return {
        over: true,
        result: 'draw',
        reason: 'stalemate',
        message: 'Tablas por Rey Ahogado'
      };
    }

    if (this.halfMoveClock >= 100) {
      return {
        over: true,
        result: 'draw',
        reason: 'fifty-move',
        message: 'Tablas por la regla de los 50 movimientos'
      };
    }

    if (this.isInsufficientMaterial()) {
      return {
        over: true,
        result: 'draw',
        reason: 'insufficient',
        message: 'Tablas por material insuficiente'
      };
    }

    return {
      over: false,
      inCheck: check,
      turn: this.turn
    };
  }

  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]) pieces.push(this.board[r][c]);
      }
    }
    if (pieces.length === 2) return true; // Rey vs Rey
    if (pieces.length === 3) {
      const minor = pieces.find(p => p.type === 'B' || p.type === 'N');
      if (minor) return true;
    }
    return false;
  }

  // ===========================================================================
  // INTELIGENCIA ARTIFICIAL (MINIMAX + PODA ALFA-BETA + TABLAS POSICIONALES)
  // ===========================================================================

  evaluateBoard() {
    const values = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

    const pawnPST = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [0,  0,  0, 25, 25,  0,  0,  0],
      [5,  5, 10, 28, 28, 10,  5,  5],
      [10,10, 20, 32, 32, 20, 10, 10],
      [50,50, 50, 50, 50, 50, 50, 50],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    const knightPST = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-30,  5, 15, 18, 18, 15,  5,-30],
      [-30,  0, 18, 25, 25, 18,  0,-30],
      [-30,  5, 18, 25, 25, 18,  5,-30],
      [-30,  0, 15, 18, 18, 15,  0,-30],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    const centerBonus = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-10, 10, 10, 12, 12, 10, 10,-10],
      [-10,  0, 12, 18, 18, 12,  0,-10],
      [-10,  5, 12, 18, 18, 12,  5,-10],
      [-10,  0, 10, 12, 12, 10,  0,-10],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;
        const base = values[p.type] || 0;
        const rowForTable = p.color === 'w' ? r : 7 - r;
        let positional = 0;
        if (p.type === 'P') positional = pawnPST[rowForTable][c];
        else if (p.type === 'N') positional = knightPST[rowForTable][c];
        else if (p.type === 'B' || p.type === 'Q') positional = centerBonus[rowForTable][c];

        if (p.color === 'w') {
          score += base + positional;
        } else {
          score -= base + positional;
        }
      }
    }
    return score;
  }

  chooseBestMove(depth = 2) {
    const color = this.turn;
    const moves = this.getAllLegalMoves(color);
    if (moves.length === 0) return null;

    // Ordenar movimientos priorizando capturas y promociones para acelerar Alfa-Beta
    const orderMoves = list =>
      list.sort((a, b) => {
        const scoreA = (a.capture ? 10 : 0) + (a.promotion ? 8 : 0);
        const scoreB = (b.capture ? 10 : 0) + (b.promotion ? 8 : 0);
        return scoreB - scoreA;
      });

    orderMoves(moves);

    const maximizing = color === 'w';
    let bestMove = moves[0];
    let bestVal = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const snap = this.cloneState();
      this.applyMoveInternal(move);
      const val = this.minimax(depth - 1, -Infinity, Infinity, !maximizing);
      this.restoreState(snap);

      // Pequeño desempate aleatorio para variedad de aperturas
      const jitter = (Math.random() - 0.5) * 6;
      const totalVal = val + jitter;

      if (maximizing) {
        if (totalVal > bestVal) {
          bestVal = totalVal;
          bestMove = move;
        }
      } else {
        if (totalVal < bestVal) {
          bestVal = totalVal;
          bestMove = move;
        }
      }
    }

    return bestMove;
  }

  minimax(depth, alpha, beta, maximizingPlayer) {
    if (depth === 0) {
      return this.evaluateBoard();
    }

    const moves = this.getAllLegalMoves(this.turn);
    if (moves.length === 0) {
      if (this.inCheck(this.turn)) {
        return maximizingPlayer ? -99999 - depth * 100 : 99999 + depth * 100;
      }
      return 0; // Tablas por ahogado
    }

    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const m of moves) {
        const snap = this.cloneState();
        this.applyMoveInternal(m);
        const evaluation = this.minimax(depth - 1, alpha, beta, false);
        this.restoreState(snap);
        if (evaluation > maxEval) maxEval = evaluation;
        if (evaluation > alpha) alpha = evaluation;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        const snap = this.cloneState();
        this.applyMoveInternal(m);
        const evaluation = this.minimax(depth - 1, alpha, beta, true);
        this.restoreState(snap);
        if (evaluation < minEval) minEval = evaluation;
        if (evaluation < beta) beta = evaluation;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
}

window.ChessEngine = ChessEngine;
