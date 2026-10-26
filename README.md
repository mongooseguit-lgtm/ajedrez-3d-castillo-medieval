# 🏰 Ajedrez Real 3D · Castillo Medieval

Juego interactivo de **Ajedrez 3D** ambientado en el Gran Salón Gótico de un Castillo Medieval (construido con **Three.js / WebGL**) junto con el script generador en Python (`bpy`) para **Blender 3.x / 4.x**.

## ✨ Características

- **Gran Salón del Castillo Medieval en 3D**: Muros de piedra, columnas góticas, ventanales nocturnos, estandartes reales heráldicos, mesa octogonal de roble tallado, candelabro de hierro forjado y antorchas con fuego dinámico y partículas de brasas.
- **32 Piezas 3D Torneadas**: Geometría por revolución (`LatheGeometry` en WebGL y `bmesh.ops.spin` en Blender) con acabados PBR en Marfil/Oro y Obsidiana/Bronce.
- **Motor Completo de Ajedrez + IA**:
  - Todas las reglas oficiales: enroque corto y largo, captura al paso (*en passant*), promoción de peón, clavadas, jaque, jaque mate, rey ahogado y tablas.
  - Modo **Jugador vs IA** (Minimax con poda Alfa-Beta y tablas posicionales en 3 niveles de dificultad) y modo **2 Jugadores locales**.
- **Integración con Blender**:
  - Ejecuta `blender_castillo_ajedrez.py` dentro de Blender para construir toda la escena 3D y exportar `castillo_ajedrez.glb`.
  - Importa cualquier archivo `.glb` directamente desde la barra superior del juego web.
