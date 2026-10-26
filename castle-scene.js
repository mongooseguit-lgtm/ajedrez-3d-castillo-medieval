/**
 * ESCENA 3D DEL GRAN SALÓN DEL CASTILLO MEDIEVAL + AJEDREZ 3D (Three.js)
 * Replica en tiempo real la geometría del script de Blender (`blender_castillo_ajedrez.py`)
 * y permite importar directamente archivos `.glb` exportados desde Blender.
 */

class CastleChessScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onSquareClick = callbacks.onSquareClick || (() => {});
    this.SQUARE_SIZE = 1.05;
    this.BOARD_Y = 2.6;

    this.squareMeshes = [];      // [r][c]
    this.pieceGroups = new Map(); // id -> THREE.Group
    this.highlightMeshes = [];
    this.torchLights = [];
    this.flameMeshes = [];
    this.activeAnimations = [];
    this.torchIntensityScale = 1.0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredSquare = null;
    this.pointerDownPos = { x: 0, y: 0 };

    this.initRenderer();
    this.initCameraAndControls();
    this.initTexturesAndMaterials();
    this.buildMedievalCastleHall();
    this.buildChessboard();
    this.buildEmberParticles();
    this.bindEvents();
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090b12);
    this.scene.fog = new THREE.FogExp2(0x090b12, 0.025);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);
  }

  initCameraAndControls() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 120);
    this.camera.position.set(0, 8.8, 9.6);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, this.BOARD_Y + 0.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 22.0;
    this.controls.update();
  }

  // ===========================================================================
  // TEXTURAS PROCEDURALES (PIEDRA MEDIEVAL, MÁRMOL, MADERA Y ESTANDARTES)
  // ===========================================================================

  createStoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2d3036';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 8;
    const cols = 4;
    const bh = 512 / rows;
    const bw = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + offset;
        const y = r * bh;
        const shade = 38 + Math.floor(Math.random() * 22);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);

        // Granulado de roca
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
          ctx.fillRect(
            x + 4 + Math.random() * (bw - 8),
            y + 4 + Math.random() * (bh - 8),
            4,
            4
          );
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  createMarbleTexture(isLight) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isLight ? '#e8dcc6' : '#161920';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = isLight ? 'rgba(160, 140, 110, 0.28)' : 'rgba(180, 155, 95, 0.16)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      let x = Math.random() * 256;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < 256) {
        y += 24;
        x += (Math.random() - 0.5) * 35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }

  createBannerTexture(bgHex, accentHex, emblemType = 'crown') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 256, 512);

    // Bordes dorados/plateados
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, 228, 484);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, 204, 460);

    // Escudo central heráldico
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.moveTo(128, 150);
    ctx.lineTo(190, 180);
    ctx.lineTo(175, 290);
    ctx.lineTo(128, 345);
    ctx.lineTo(81, 290);
    ctx.lineTo(66, 180);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bgHex;
    ctx.font = 'bold 64px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emblemType === 'crown' ? '♔' : '♞', 128, 245);

    return new THREE.CanvasTexture(canvas);
  }

  initTexturesAndMaterials() {
    const stoneTex = this.createStoneTexture();
    const lightMarble = this.createMarbleTexture(true);
    const darkMarble = this.createMarbleTexture(false);

    this.mats = {
      stoneWall: new THREE.MeshStandardMaterial({
        map: stoneTex,
        roughness: 0.88,
        metalness: 0.05
      }),
      stoneDark: new THREE.MeshStandardMaterial({
        color: 0x22252b,
        roughness: 0.82,
        metalness: 0.08
      }),
      oakWood: new THREE.MeshStandardMaterial({
        color: 0x2c170b,
        roughness: 0.62,
        metalness: 0.05
      }),
      boardFrame: new THREE.MeshStandardMaterial({
        color: 0x231107,
        roughness: 0.38,
        metalness: 0.1
      }),
      goldTrim: new THREE.MeshStandardMaterial({
        color: 0xd9a436,
        roughness: 0.24,
        metalness: 0.9
      }),
      iron: new THREE.MeshStandardMaterial({
        color: 0x1d2026,
        roughness: 0.45,
        metalness: 0.85
      }),
      squareLight: new THREE.MeshPhysicalMaterial({
        map: lightMarble,
        roughness: 0.18,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15
      }),
      squareDark: new THREE.MeshPhysicalMaterial({
        map: darkMarble,
        roughness: 0.2,
        metalness: 0.1,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15
      }),
      whitePiece: new THREE.MeshPhysicalMaterial({
        color: 0xf3e7cf,
        roughness: 0.2,
        metalness: 0.08,
        clearcoat: 0.75,
        clearcoatRoughness: 0.15
      }),
      whitePieceAccent: new THREE.MeshStandardMaterial({
        color: 0xd4a238,
        roughness: 0.22,
        metalness: 0.88
      }),
      blackPiece: new THREE.MeshPhysicalMaterial({
        color: 0x1a1d24,
        roughness: 0.22,
        metalness: 0.48,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15
      }),
      blackPieceAccent: new THREE.MeshStandardMaterial({
        color: 0xb86f32,
        roughness: 0.25,
        metalness: 0.88
      }),
      bannerRed: new THREE.MeshStandardMaterial({
        map: this.createBannerTexture('#6b0f16', '#d8a63a', 'crown'),
        roughness: 0.75,
        side: THREE.DoubleSide
      }),
      bannerBlue: new THREE.MeshStandardMaterial({
        map: this.createBannerTexture('#102556', '#cfd6e6', 'knight'),
        roughness: 0.75,
        side: THREE.DoubleSide
      }),
      flame: new THREE.MeshBasicMaterial({
        color: 0xff9429
      }),
      moonGlass: new THREE.MeshBasicMaterial({
        color: 0x4876b8,
        transparent: true,
        opacity: 0.45
      })
    };
  }

  // ===========================================================================
  // ARQUITECTURA DEL GRAN SALÓN DEL CASTILLO MEDIEVAL
  // ===========================================================================

  buildMedievalCastleHall() {
    this.castleGroup = new THREE.Group();
    this.scene.add(this.castleGroup);

    // 1. Iluminación base ambiental y luz de luna gótica
    const ambient = new THREE.AmbientLight(0x2d3854, 0.55);
    this.scene.add(ambient);

    const moonLight = new THREE.DirectionalLight(0x6b92d6, 0.55);
    moonLight.position.set(-12, 16, -10);
    this.scene.add(moonLight);

    // Luz cálida principal sobre el tablero (desde el candelabro real)
    this.mainBoardLight = new THREE.SpotLight(0xffcf8c, 2.2, 24, Math.PI / 3.2, 0.45, 1.2);
    this.mainBoardLight.position.set(0, 9.2, 0);
    this.mainBoardLight.target.position.set(0, this.BOARD_Y, 0);
    this.mainBoardLight.castShadow = true;
    this.mainBoardLight.shadow.mapSize.width = 2048;
    this.mainBoardLight.shadow.mapSize.height = 2048;
    this.mainBoardLight.shadow.bias = -0.0005;
    this.scene.add(this.mainBoardLight);
    this.scene.add(this.mainBoardLight.target);

    // 2. Suelo de losas de piedra del Gran Salón
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floor = new THREE.Mesh(floorGeo, this.mats.stoneWall);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.castleGroup.add(floor);

    // Alfombra real bajo la mesa
    const rugGeo = new THREE.CylinderGeometry(6.8, 6.8, 0.04, 8);
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x4f0c12, roughness: 0.9 });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.position.set(0, 0.02, 0);
    rug.receiveShadow = true;
    this.castleGroup.add(rug);

    // Borde dorado de la alfombra
    const rugBorderGeo = new THREE.RingGeometry(6.5, 6.78, 8);
    const rugBorder = new THREE.Mesh(rugBorderGeo, this.mats.goldTrim);
    rugBorder.rotation.x = -Math.PI / 2;
    rugBorder.position.set(0, 0.042, 0);
    this.castleGroup.add(rugBorder);

    // 3. Mesa Real de Roble y Pedestal de Piedra Tallada
    const tableTopGeo = new THREE.CylinderGeometry(6.1, 5.7, 0.38, 8);
    const tableTop = new THREE.Mesh(tableTopGeo, this.mats.oakWood);
    tableTop.position.set(0, this.BOARD_Y - 0.28, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.castleGroup.add(tableTop);

    const pedestalGeo = new THREE.CylinderGeometry(1.85, 2.5, this.BOARD_Y - 0.4, 8);
    const pedestal = new THREE.Mesh(pedestalGeo, this.mats.stoneDark);
    pedestal.position.set(0, (this.BOARD_Y - 0.4) / 2, 0);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.castleGroup.add(pedestal);

    // 4. Muros del Castillo con Almenas
    const wallDist = 16.5;
    const wallH = 13.0;
    const wallConfigs = [
      { pos: [0, wallH / 2, -wallDist], scale: [34, wallH, 1.2] },
      { pos: [0, wallH / 2, wallDist], scale: [34, wallH, 1.2] },
      { pos: [-wallDist, wallH / 2, 0], scale: [1.2, wallH, 34] },
      { pos: [wallDist, wallH / 2, 0], scale: [1.2, wallH, 34] }
    ];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    wallConfigs.forEach(cfg => {
      const wall = new THREE.Mesh(boxGeo, this.mats.stoneWall);
      wall.position.set(...cfg.pos);
      wall.scale.set(...cfg.scale);
      wall.receiveShadow = true;
      this.castleGroup.add(wall);
    });

    // Ventanales Góticos en el muro Norte (frente a las Blancas)
    [-6.5, 0, 6.5].forEach(wx => {
      const archGroup = new THREE.Group();
      const winPane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.2), this.mats.moonGlass);
      winPane.position.set(wx, 7.2, -wallDist + 0.65);
      archGroup.add(winPane);

      const archTop = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16, 0, Math.PI), this.mats.moonGlass);
      archTop.position.set(wx, 9.8, -wallDist + 0.65);
      archGroup.add(archTop);
      this.castleGroup.add(archGroup);
    });

    // 5. Columnas Góticas, Antorchas con Fuego Dinámico y Estandartes
    const pillarPositions = [
      [-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5],
      [-14.5, -5.2],  [14.5, -5.2],  [-14.5, 5.2],  [14.5, 5.2],
      [-5.2, -14.5],  [5.2, -14.5],  [-5.2, 14.5],  [5.2, 14.5]
    ];

    const colGeo = new THREE.CylinderGeometry(0.82, 0.92, wallH, 12);
    const colBaseGeo = new THREE.BoxGeometry(2.2, 0.9, 2.2);

    pillarPositions.forEach(([px, pz], idx) => {
      const col = new THREE.Mesh(colGeo, this.mats.stoneDark);
      col.position.set(px, wallH / 2, pz);
      col.castShadow = true;
      col.receiveShadow = true;
      this.castleGroup.add(col);

      const base = new THREE.Mesh(colBaseGeo, this.mats.stoneWall);
      base.position.set(px, 0.45, pz);
      base.receiveShadow = true;
      this.castleGroup.add(base);

      // Antorchas en las 8 columnas principales
      if (idx < 8) {
        const dir = new THREE.Vector3(-px, 0, -pz).normalize();
        const tx = px + dir.x * 1.05;
        const tz = pz + dir.z * 1.05;
        const ty = 4.8;

        const sconce = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.7, 8),
          this.mats.iron
        );
        sconce.position.set(tx, ty, tz);
        sconce.rotation.x = Math.PI;
        this.castleGroup.add(sconce);

        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.48, 10),
          this.mats.flame
        );
        flame.position.set(tx, ty + 0.5, tz);
        this.castleGroup.add(flame);
        this.flameMeshes.push({ mesh: flame, basePos: flame.position.clone(), seed: idx * 1.7 });

        const pLight = new THREE.PointLight(0xff7b29, 1.35, 18, 1.6);
        pLight.position.set(tx + dir.x * 0.25, ty + 0.6, tz + dir.z * 0.25);
        this.castleGroup.add(pLight);
        this.torchLights.push({ light: pLight, baseIntensity: 1.35, seed: idx * 2.3 });
      }
    });

    // 6. Estandartes Reales Colgantes
    const bannerConfigs = [
      { pos: [-3.5, 7.2, -15.6], rotY: 0, mat: this.mats.bannerRed },
      { pos: [3.5, 7.2, -15.6], rotY: 0, mat: this.mats.bannerBlue },
      { pos: [-3.5, 7.2, 15.6], rotY: Math.PI, mat: this.mats.bannerBlue },
      { pos: [3.5, 7.2, 15.6], rotY: Math.PI, mat: this.mats.bannerRed },
      { pos: [-15.6, 7.2, 0], rotY: Math.PI / 2, mat: this.mats.bannerRed },
      { pos: [15.6, 7.2, 0], rotY: -Math.PI / 2, mat: this.mats.bannerBlue }
    ];
    const bannerGeo = new THREE.PlaneGeometry(2.2, 4.8);
    bannerConfigs.forEach(b => {
      const mesh = new THREE.Mesh(bannerGeo, b.mat);
      mesh.position.set(...b.pos);
      mesh.rotation.y = b.rotY;
      this.castleGroup.add(mesh);
    });

    // 7. Candelabro Medieval de Hierro Forjado sobre el Tablero
    const chandelierY = 9.0;
    const chandelier = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.1, 12, 32), this.mats.iron);
    torus.rotation.x = Math.PI / 2;
    chandelier.add(torus);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.5, 8), this.mats.iron);
    chain.position.y = 2.25;
    chandelier.add(chain);

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const cx = Math.cos(ang) * 2.5;
      const cz = Math.sin(ang) * 2.5;
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.35, 10),
        this.mats.whitePiece
      );
      candle.position.set(cx, 0.22, cz);
      chandelier.add(candle);

      const cFlame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), this.mats.flame);
      cFlame.position.set(cx, 0.46, cz);
      chandelier.add(cFlame);
      this.flameMeshes.push({ mesh: cFlame, basePos: cFlame.position.clone(), seed: 20 + i });
    }

    chandelier.position.set(0, chandelierY, 0);
    this.castleGroup.add(chandelier);
  }

  buildEmberParticles() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = 1.0 + Math.random() * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.09,
      transparent: true,
      opacity: 0.75
    });
    this.embers = new THREE.Points(geo, mat);
    this.scene.add(this.embers);
  }

  // ===========================================================================
  // CONSTRUCCIÓN DEL TABLERO 3D Y GEOMETRÍA DE LAS PIEZAS (TORNEADO LATHE)
  // ===========================================================================

  squareToWorld(r, c) {
    // r=0 (fila 1 Blancas) -> z positivo (+3.5 * SQUARE_SIZE)
    // r=7 (fila 8 Negras)  -> z negativo (-3.5 * SQUARE_SIZE)
    // c=0 (columna A)      -> x negativo (-3.5 * SQUARE_SIZE)
    const x = (c - 3.5) * this.SQUARE_SIZE;
    const z = (3.5 - r) * this.SQUARE_SIZE;
    return new THREE.Vector3(x, this.BOARD_Y, z);
  }

  buildChessboard() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const sqGeo = new THREE.BoxGeometry(this.SQUARE_SIZE * 0.985, 0.14, this.SQUARE_SIZE * 0.985);
    this.squareMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 1;
        const mesh = new THREE.Mesh(sqGeo, isLight ? this.mats.squareLight : this.mats.squareDark);
        const pos = this.squareToWorld(r, c);
        mesh.position.set(pos.x, this.BOARD_Y - 0.07, pos.z);
        mesh.receiveShadow = true;
        mesh.userData = { row: r, col: c, isSquare: true };
        this.boardGroup.add(mesh);
        this.squareMeshes[r][c] = mesh;
      }
    }

    // Marco de nogal y moldura dorada
    const span = this.SQUARE_SIZE * 8;
    const frameGeo = new THREE.BoxGeometry(span + 1.1, 0.22, span + 1.1);
    const frame = new THREE.Mesh(frameGeo, this.mats.boardFrame);
    frame.position.set(0, this.BOARD_Y - 0.14, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    const goldGeo = new THREE.BoxGeometry(span + 0.22, 0.16, span + 0.22);
    const goldFrame = new THREE.Mesh(goldGeo, this.mats.goldTrim);
    goldFrame.position.set(0, this.BOARD_Y - 0.09, 0);
    this.boardGroup.add(goldFrame);

    // Grupo contenedor para marcadores de jugadas legales
    this.highlightsGroup = new THREE.Group();
    this.scene.add(this.highlightsGroup);

    // Grupo contenedor para las 32 piezas
    this.piecesRoot = new THREE.Group();
    this.scene.add(this.piecesRoot);
  }

  createLatheGeometry(points, segments = 32) {
    const vec2s = points.map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(vec2s, segments);
  }

  createPieceMeshGroup(type, color) {
    const group = new THREE.Group();
    const mainMat = color === 'w' ? this.mats.whitePiece : this.mats.blackPiece;
    const accentMat = color === 'w' ? this.mats.whitePieceAccent : this.mats.blackPieceAccent;

    if (type === 'P') {
      const geo = this.createLatheGeometry([
        [0.00, 0.00], [0.35, 0.00], [0.35, 0.07], [0.30, 0.13],
        [0.21, 0.22], [0.14, 0.48], [0.11, 0.65], [0.21, 0.68],
        [0.21, 0.72], [0.12, 0.75], [0.22, 0.88], [0.20, 1.00],
        [0.12, 1.08], [0.00, 1.10]
      ]);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.025, 10, 24), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.70;
      group.add(ring);
    } else if (type === 'R') {
      const geo = this.createLatheGeometry([
        [0.00, 0.00], [0.39, 0.00], [0.39, 0.08], [0.34, 0.14],
        [0.25, 0.28], [0.21, 0.62], [0.19, 0.86], [0.29, 0.92],
        [0.31, 0.98], [0.31, 1.20], [0.22, 1.20], [0.22, 1.10], [0.00, 1.10]
      ]);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // 6 almenas de torre medieval
      const crenelGeo = new THREE.BoxGeometry(0.11, 0.14, 0.11);
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        const cMesh = new THREE.Mesh(crenelGeo, mainMat);
        cMesh.position.set(Math.cos(ang) * 0.26, 1.24, Math.sin(ang) * 0.26);
        cMesh.rotation.y = -ang;
        cMesh.castShadow = true;
        group.add(cMesh);
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 10, 24), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.90;
      group.add(ring);
    } else if (type === 'N') {
      const baseGeo = this.createLatheGeometry([
        [0.00, 0.00], [0.39, 0.00], [0.39, 0.08], [0.34, 0.14],
        [0.27, 0.24], [0.25, 0.36], [0.00, 0.37]
      ]);
      const baseMesh = new THREE.Mesh(baseGeo, mainMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      const horseGroup = new THREE.Group();
      const parts = [
        { pos: [0, 0.58, -0.03], rotX: -0.22, scale: [0.25, 0.45, 0.32] },
        { pos: [0, 0.88, 0.02],  rotX: -0.38, scale: [0.22, 0.40, 0.28] },
        { pos: [0, 1.10, 0.10],  rotX: 0.48,  scale: [0.21, 0.25, 0.38] },
        { pos: [0, 1.02, 0.27],  rotX: 0.72,  scale: [0.16, 0.19, 0.28] },
        { pos: [-0.07, 1.26, -0.02], rotX: -0.1, scale: [0.05, 0.16, 0.08] },
        { pos: [0.07, 1.26, -0.02],  rotX: -0.1, scale: [0.05, 0.16, 0.08] }
      ];
      const box = new THREE.BoxGeometry(1, 1, 1);
      parts.forEach(p => {
        const m = new THREE.Mesh(box, mainMat);
        m.position.set(...p.pos);
        m.rotation.x = p.rotX;
        m.scale.set(...p.scale);
        m.castShadow = true;
        horseGroup.add(m);
      });

      // Crin dorada/bronce
      const mane = new THREE.Mesh(box, accentMat);
      mane.position.set(0, 0.84, -0.14);
      mane.rotation.x = -0.2;
      mane.scale.set(0.08, 0.54, 0.14);
      horseGroup.add(mane);

      // Orientar según color (Blancas miran hacia -Z, Negras hacia +Z)
      horseGroup.rotation.y = color === 'w' ? Math.PI : 0;
      group.add(horseGroup);
    } else if (type === 'B') {
      const geo = this.createLatheGeometry([
        [0.00, 0.00], [0.38, 0.00], [0.38, 0.08], [0.33, 0.14],
        [0.24, 0.26], [0.15, 0.68], [0.13, 0.86], [0.23, 0.90],
        [0.23, 0.95], [0.15, 0.98], [0.24, 1.16], [0.22, 1.34],
        [0.12, 1.46], [0.00, 1.50]
      ]);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), accentMat);
      orb.position.y = 1.54;
      group.add(orb);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 24), accentMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.92;
      group.add(collar);
    } else if (type === 'Q') {
      const geo = this.createLatheGeometry([
        [0.00, 0.00], [0.42, 0.00], [0.42, 0.08], [0.36, 0.15],
        [0.26, 0.30], [0.17, 0.74], [0.15, 1.00], [0.26, 1.05],
        [0.26, 1.10], [0.17, 1.14], [0.24, 1.35], [0.30, 1.58],
        [0.22, 1.55], [0.12, 1.66], [0.00, 1.70]
      ]);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Corona real de 8 perlas
      const pearlGeo = new THREE.SphereGeometry(0.045, 12, 12);
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        const pearl = new THREE.Mesh(pearlGeo, accentMat);
        pearl.position.set(Math.cos(ang) * 0.28, 1.62, Math.sin(ang) * 0.28);
        group.add(pearl);
      }
    } else if (type === 'K') {
      const geo = this.createLatheGeometry([
        [0.00, 0.00], [0.44, 0.00], [0.44, 0.09], [0.38, 0.16],
        [0.28, 0.32], [0.18, 0.78], [0.16, 1.08], [0.28, 1.12],
        [0.28, 1.18], [0.18, 1.22], [0.26, 1.44], [0.30, 1.66],
        [0.18, 1.74], [0.00, 1.76]
      ]);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Cruz real en la corona del Rey
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.07), accentMat);
      crossV.position.y = 1.90;
      group.add(crossV);

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), accentMat);
      crossH.position.y = 1.94;
      group.add(crossH);
    }

    return group;
  }

  // ===========================================================================
  // SINCRONIZACIÓN DEL TABLERO Y ANIMACIONES DE MOVIMIENTO
  // ===========================================================================

  syncBoardFromEngine(engine, animateMove = null) {
    if (!animateMove) {
      // Reconstrucción limpia
      for (const [, grp] of this.pieceGroups) {
        this.piecesRoot.remove(grp);
      }
      this.pieceGroups.clear();

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = engine.board[r][c];
          if (!cell) continue;
          const grp = this.createPieceMeshGroup(cell.type, cell.color);
          const worldPos = this.squareToWorld(r, c);
          grp.position.copy(worldPos);
          grp.userData = { row: r, col: c, pieceId: cell.id, type: cell.type, color: cell.color };
          this.piecesRoot.add(grp);
          this.pieceGroups.set(cell.id, grp);
        }
      }
      return;
    }

    // Animar movimiento suave en arco parabólico
    const { move, movingPiece } = animateMove;
    const grp = this.pieceGroups.get(movingPiece.id);

    // Si hubo captura, eliminar pieza capturada
    if (move.capture) {
      const capGrp = this.pieceGroups.get(move.capture.id);
      if (capGrp) {
        this.piecesRoot.remove(capGrp);
        this.pieceGroups.delete(move.capture.id);
      }
    }

    // Si hubo enroque, animar también la torre
    if (move.castling) {
      const rookCell = engine.board[move.fromR][move.rookToC];
      if (rookCell) {
        const rookGrp = this.pieceGroups.get(rookCell.id);
        if (rookGrp) {
          this.animatePieceArc(
            rookGrp,
            this.squareToWorld(move.fromR, move.rookFromC),
            this.squareToWorld(move.fromR, move.rookToC),
            340
          );
          rookGrp.userData.row = move.fromR;
          rookGrp.userData.col = move.rookToC;
        }
      }
    }

    if (grp) {
      const fromPos = this.squareToWorld(move.fromR, move.fromC);
      const toPos = this.squareToWorld(move.toR, move.toC);

      if (move.promotion) {
        // Reemplazar malla por la pieza coronada al finalizar el salto
        this.piecesRoot.remove(grp);
        const promotedGrp = this.createPieceMeshGroup(move.promotion, movingPiece.color);
        promotedGrp.position.copy(fromPos);
        promotedGrp.userData = {
          row: move.toR,
          col: move.toC,
          pieceId: movingPiece.id,
          type: move.promotion,
          color: movingPiece.color
        };
        this.piecesRoot.add(promotedGrp);
        this.pieceGroups.set(movingPiece.id, promotedGrp);
        this.animatePieceArc(promotedGrp, fromPos, toPos, 380);
      } else {
        grp.userData.row = move.toR;
        grp.userData.col = move.toC;
        this.animatePieceArc(grp, fromPos, toPos, 360);
      }
    } else {
      this.syncBoardFromEngine(engine, null);
    }
  }

  animatePieceArc(group, startVec, endVec, durationMs = 360) {
    this.activeAnimations.push({
      group,
      startVec: startVec.clone(),
      endVec: endVec.clone(),
      startTime: performance.now(),
      durationMs
    });
  }

  // ===========================================================================
  // INDICADORES DE CASILLAS LEGALES, SELECCIÓN Y JAQUE
  // ===========================================================================

  clearHighlights() {
    while (this.highlightsGroup.children.length > 0) {
      this.highlightsGroup.remove(this.highlightsGroup.children[0]);
    }
  }

  showHighlights({ selectedSquare = null, legalMoves = [], lastMove = null, checkSquare = null }) {
    this.clearHighlights();

    const addRing = (r, c, colorHex, innerR = 0.28, outerR = 0.44, opacity = 0.85) => {
      const geo = new THREE.RingGeometry(innerR, outerR, 28);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = this.squareToWorld(r, c);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, this.BOARD_Y + 0.015, pos.z);
      this.highlightsGroup.add(mesh);
    };

    const addDisc = (r, c, colorHex, radius = 0.19, opacity = 0.8) => {
      const geo = new THREE.CircleGeometry(radius, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = this.squareToWorld(r, c);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, this.BOARD_Y + 0.016, pos.z);
      this.highlightsGroup.add(mesh);
    };

    if (lastMove) {
      addRing(lastMove.fromR, lastMove.fromC, 0xd4a238, 0.34, 0.46, 0.45);
      addRing(lastMove.toR, lastMove.toC, 0xd4a238, 0.34, 0.46, 0.65);
    }

    if (selectedSquare) {
      addRing(selectedSquare.r, selectedSquare.c, 0x52d1ff, 0.32, 0.47, 0.95);
    }

    // Evitar duplicar indicadores en casillas de promoción (4 opciones en la misma casilla)
    const seenTargets = new Set();
    legalMoves.forEach(m => {
      const key = `${m.toR}_${m.toC}`;
      if (seenTargets.has(key)) return;
      seenTargets.add(key);

      if (m.capture) {
        addRing(m.toR, m.toC, 0xff4242, 0.32, 0.47, 0.92);
      } else {
        addDisc(m.toR, m.toC, 0x45e884, 0.17, 0.85);
      }
    });

    if (checkSquare) {
      addRing(checkSquare.r, checkSquare.c, 0xff1e1e, 0.15, 0.48, 0.9);
    }
  }

  // ===========================================================================
  // CÁMARAS PREDEFINIDAS E IMPORTADOR DE MODELO BLENDER (.GLB)
  // ===========================================================================

  setCameraPreset(preset) {
    const presets = {
      white:   { pos: [0, 8.8, 9.6],   target: [0, this.BOARD_Y + 0.2, 0] },
      black:   { pos: [0, 8.8, -9.6],  target: [0, this.BOARD_Y + 0.2, 0] },
      top:     { pos: [0, 13.5, 0.01], target: [0, this.BOARD_Y, 0] },
      castle:  { pos: [11.5, 9.5, 11.5], target: [0, this.BOARD_Y + 0.4, 0] }
    };
    const cfg = presets[preset] || presets.white;
    this.cameraAnim = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(...cfg.pos),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...cfg.target),
      startTime: performance.now(),
      duration: 650
    };
  }

  setTorchIntensity(multiplier) {
    this.torchIntensityScale = multiplier;
    this.mainBoardLight.intensity = 2.2 * multiplier;
  }

  loadCustomBlenderGLB(file, onSuccess, onError) {
    if (!THREE.GLTFLoader) {
      if (onError) onError('GLTFLoader no disponible.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const loader = new THREE.GLTFLoader();
      loader.parse(
        e.target.result,
        '',
        gltf => {
          if (this.customBlenderModel) {
            this.scene.remove(this.customBlenderModel);
          }
          this.customBlenderModel = gltf.scene;
          this.customBlenderModel.position.set(0, 0, 0);
          this.scene.add(this.customBlenderModel);
          if (onSuccess) onSuccess(gltf);
        },
        err => {
          if (onError) onError(err);
        }
      );
    };
    reader.readAsArrayBuffer(file);
  }

  // ===========================================================================
  // INTERACCIÓN CON EL RATÓN Y BUCLE DE RENDERIZADO
  // ===========================================================================

  bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', e => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointerup', e => {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return; // Fue un giro de cámara con OrbitControls

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Comprobar primero clic sobre piezas o casillas
      const interactables = [
        ...this.boardGroup.children.filter(c => c.userData && c.userData.isSquare),
        ...this.piecesRoot.children
      ];

      const hits = this.raycaster.intersectObjects(interactables, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData?.isSquare && obj.userData?.row === undefined) {
          obj = obj.parent;
        }
        if (obj && obj.userData && obj.userData.row !== undefined) {
          this.onSquareClick(obj.userData.row, obj.userData.col);
        }
      }
    });

    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  startRenderLoop() {
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const now = performance.now();

      // 1. Parpadeo realista de las antorchas medievales
      this.torchLights.forEach(t => {
        const flicker =
          Math.sin(elapsed * 7.5 + t.seed) * 0.14 +
          Math.sin(elapsed * 17.0 + t.seed * 2.1) * 0.07;
        t.light.intensity = Math.max(0.2, (t.baseIntensity + flicker) * this.torchIntensityScale);
      });

      this.flameMeshes.forEach(f => {
        const s = 1.0 + Math.sin(elapsed * 11 + f.seed) * 0.12;
        f.mesh.scale.set(1, s, 1);
      });

      // 2. Ascenso de brasas / chispas en el salón
      if (this.embers) {
        const posAttr = this.embers.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          let y = posAttr.getY(i) + 0.012;
          if (y > 11.5) y = 1.0;
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }

      // 3. Animaciones de movimiento de piezas en arco
      for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
        const anim = this.activeAnimations[i];
        const t = Math.min(1, (now - anim.startTime) / anim.durationMs);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        anim.group.position.lerpVectors(anim.startVec, anim.endVec, ease);
        anim.group.position.y += Math.sin(ease * Math.PI) * 0.85;

        if (t >= 1) {
          anim.group.position.copy(anim.endVec);
          this.activeAnimations.splice(i, 1);
        }
      }

      // 4. Transición suave de cámara
      if (this.cameraAnim) {
        const t = Math.min(1, (now - this.cameraAnim.startTime) / this.cameraAnim.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        this.camera.position.lerpVectors(this.cameraAnim.startPos, this.cameraAnim.endPos, ease);
        this.controls.target.lerpVectors(this.cameraAnim.startTarget, this.cameraAnim.endTarget, ease);
        if (t >= 1) this.cameraAnim = null;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }
}

window.CastleChessScene = CastleChessScene;
