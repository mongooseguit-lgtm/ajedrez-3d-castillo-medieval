"""
================================================================================
AJEDREZ 3D EN CASTILLO MEDIEVAL - SCRIPT GENERADOR PARA BLENDER (bpy)
Compatible con Blender 3.x y 4.x
================================================================================
Cómo usar este script en Blender:
1. Abre Blender.
2. Ve a la pestaña "Scripting" (arriba en la barra de menús).
3. Haz clic en "Open" y selecciona este archivo `blender_castillo_ajedrez.py`
   (o crea un texto nuevo y pega este código).
4. Presiona el botón "Run Script" (icono de Play ▶).
5. Cambia la vista del Viewport a "Material Preview" (Z -> Material Preview) o
   "Rendered" (Z -> Rendered) para ver los materiales PBR y la iluminación de
   las antorchas medievales.

También puedes ejecutarlo desde la terminal para generar los archivos .blend y .glb:
   blender --background --python blender_castillo_ajedrez.py
================================================================================
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler

# ==============================================================================
# 1. LIMPIEZA DE ESCENA Y CONFIGURACIÓN DE COLECCIONES
# ==============================================================================

def clear_scene():
    """Elimina todos los objetos, mallas y materiales previos de la escena."""
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.lights:
        if block.users == 0:
            bpy.data.lights.remove(block)
    for block in bpy.data.cameras:
        if block.users == 0:
            bpy.data.cameras.remove(block)


def get_or_create_collection(name, parent=None):
    """Crea o recupera una colección para organizar la escena en el Outliner."""
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
    else:
        col = bpy.data.collections.new(name)
        target_parent = parent if parent else bpy.context.scene.collection
        target_parent.children.link(col)
    return col


def link_to_collection(obj, col):
    """Vincula un objeto exclusivamente a la colección indicada."""
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)


# ==============================================================================
# 2. SISTEMA DE MATERIALES PBR (COMPATIBLE BLENDER 3.x / 4.x)
# ==============================================================================

def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5, emission_color=None, emission_strength=0.0):
    """Crea un material Principled BSDF compatible tanto con Blender 3.x como 4.x."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if emission_color and emission_strength > 0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission_color
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = emission_color
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat


def create_all_materials():
    """Diccionario con todos los materiales del castillo y del juego de ajedrez."""
    mats = {}
    # Materiales de las piezas
    mats['white_piece'] = create_pbr_material(
        "Marfil_Real_Blanco", (0.93, 0.88, 0.76, 1.0), metallic=0.08, roughness=0.22
    )
    mats['black_piece'] = create_pbr_material(
        "Obsidiana_Bronce_Negro", (0.10, 0.10, 0.13, 1.0), metallic=0.45, roughness=0.25
    )
    # Materiales de las casillas
    mats['square_light'] = create_pbr_material(
        "Marmol_Crema", (0.85, 0.80, 0.70, 1.0), metallic=0.05, roughness=0.18
    )
    mats['square_dark'] = create_pbr_material(
        "Marmol_Negro_Veteado", (0.07, 0.08, 0.10, 1.0), metallic=0.15, roughness=0.18
    )
    # Marco del tablero y mobiliario
    mats['board_frame'] = create_pbr_material(
        "Madera_Nogal_Marco", (0.18, 0.09, 0.04, 1.0), metallic=0.0, roughness=0.42
    )
    mats['gold_trim'] = create_pbr_material(
        "Oro_Medieval", (0.85, 0.64, 0.18, 1.0), metallic=0.92, roughness=0.22
    )
    mats['oak_wood'] = create_pbr_material(
        "Roble_Antiguo", (0.14, 0.08, 0.04, 1.0), metallic=0.0, roughness=0.65
    )
    # Arquitectura del castillo
    mats['castle_stone'] = create_pbr_material(
        "Piedra_Castillo", (0.24, 0.25, 0.27, 1.0), metallic=0.0, roughness=0.85
    )
    mats['castle_stone_dark'] = create_pbr_material(
        "Piedra_Pilar_Oscura", (0.16, 0.17, 0.19, 1.0), metallic=0.0, roughness=0.80
    )
    mats['iron_metal'] = create_pbr_material(
        "Hierro_Forjado", (0.12, 0.12, 0.14, 1.0), metallic=0.85, roughness=0.45
    )
    mats['banner_red'] = create_pbr_material(
        "Estandarte_Carmesi", (0.52, 0.06, 0.08, 1.0), metallic=0.0, roughness=0.75
    )
    mats['banner_blue'] = create_pbr_material(
        "Estandarte_Real_Azul", (0.07, 0.16, 0.45, 1.0), metallic=0.0, roughness=0.75
    )
    mats['torch_flame'] = create_pbr_material(
        "Llama_Antorcha", (1.0, 0.45, 0.08, 1.0), metallic=0.0, roughness=0.2,
        emission_color=(1.0, 0.42, 0.05, 1.0), emission_strength=14.0
    )
    return mats


# ==============================================================================
# 3. CONSTRUCCIÓN DE PIEZAS DE AJEDREZ MEDIANTE REVOLUCIÓN (LATHE / BMESH)
# ==============================================================================

def create_lathe_mesh(name, profile_points, segments=32):
    """
    Crea una malla revolucionando una lista de puntos 2D (radio, altura_z)
    alrededor del eje Z usando bmesh.spin.
    """
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()

    verts = [bm.verts.new((r, 0.0, z)) for (r, z) in profile_points]
    for i in range(len(verts) - 1):
        bm.edges.new((verts[i], verts[i + 1]))

    geom = bm.verts[:] + bm.edges[:]
    bmesh.ops.spin(
        bm,
        geom=geom,
        cent=(0.0, 0.0, 0.0),
        axis=(0.0, 0.0, 1.0),
        dvec=(0.0, 0.0, 0.0),
        angle=2.0 * math.pi,
        steps=segments,
        use_merge=True,
    )

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    return mesh


def build_pawn_mesh():
    profile = [
        (0.00, 0.00), (0.34, 0.00), (0.34, 0.06), (0.30, 0.10),
        (0.28, 0.14), (0.20, 0.22), (0.14, 0.45), (0.11, 0.62),
        (0.20, 0.65), (0.20, 0.69), (0.11, 0.72),
        (0.18, 0.78), (0.22, 0.88), (0.19, 0.98), (0.11, 1.05), (0.00, 1.08)
    ]
    return create_lathe_mesh("Mesh_Peon", profile, segments=32)


def build_rook_mesh():
    profile = [
        (0.00, 0.00), (0.38, 0.00), (0.38, 0.07), (0.34, 0.12),
        (0.30, 0.18), (0.24, 0.28), (0.21, 0.58), (0.19, 0.82),
        (0.27, 0.88), (0.30, 0.94), (0.30, 1.18), (0.22, 1.18),
        (0.22, 1.08), (0.00, 1.08)
    ]
    mesh = create_lathe_mesh("Mesh_Torre", profile, segments=32)
    # Añadir almenas superiores
    bm = bmesh.new()
    bm.from_mesh(mesh)
    num_crenels = 6
    for i in range(num_crenels):
        angle = (2.0 * math.pi * i) / num_crenels
        cx = math.cos(angle) * 0.26
        cy = math.sin(angle) * 0.26
        bmesh.ops.create_cube(
            bm,
            size=0.10,
            matrix=Euler((0, 0, angle), 'XYZ').to_matrix().to_4x4() @
                   bpy.types.Object.bl_rna.properties if False else
                   _translation_rotation_matrix(cx, cy, 1.22, angle)
        )
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def _translation_rotation_matrix(x, y, z, rot_z=0.0, sx=1.0, sy=1.0, sz=1.0):
    from mathutils import Matrix
    mat_t = Matrix.Translation((x, y, z))
    mat_r = Matrix.Rotation(rot_z, 4, 'Z')
    mat_s = Matrix.Diagonal((sx, sy, sz, 1.0))
    return mat_t @ mat_r @ mat_s


def build_bishop_mesh():
    profile = [
        (0.00, 0.00), (0.37, 0.00), (0.37, 0.07), (0.33, 0.12),
        (0.27, 0.20), (0.19, 0.35), (0.14, 0.68), (0.12, 0.84),
        (0.22, 0.87), (0.22, 0.91), (0.14, 0.94),
        (0.23, 1.06), (0.25, 1.20), (0.20, 1.34), (0.10, 1.44),
        (0.06, 1.48), (0.08, 1.53), (0.05, 1.57), (0.00, 1.59)
    ]
    return create_lathe_mesh("Mesh_Alfil", profile, segments=32)


def build_queen_mesh():
    profile = [
        (0.00, 0.00), (0.40, 0.00), (0.40, 0.08), (0.36, 0.14),
        (0.30, 0.22), (0.22, 0.38), (0.16, 0.72), (0.14, 0.98),
        (0.25, 1.02), (0.25, 1.07), (0.16, 1.11),
        (0.22, 1.25), (0.28, 1.45), (0.31, 1.58), (0.24, 1.58),
        (0.18, 1.52), (0.10, 1.62), (0.06, 1.68), (0.00, 1.70)
    ]
    mesh = create_lathe_mesh("Mesh_Reina", profile, segments=36)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    # Perlas de la corona
    crowns = 8
    for i in range(crowns):
        ang = (2.0 * math.pi * i) / crowns
        px = math.cos(ang) * 0.29
        py = math.sin(ang) * 0.29
        bmesh.ops.create_uvsphere(
            bm, u_segments=12, v_segments=8, radius=0.04,
            matrix=_translation_rotation_matrix(px, py, 1.61)
        )
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def build_king_mesh():
    profile = [
        (0.00, 0.00), (0.42, 0.00), (0.42, 0.08), (0.38, 0.14),
        (0.32, 0.24), (0.23, 0.42), (0.17, 0.78), (0.15, 1.06),
        (0.27, 1.10), (0.27, 1.16), (0.17, 1.20),
        (0.24, 1.36), (0.29, 1.56), (0.25, 1.66), (0.14, 1.72), (0.00, 1.74)
    ]
    mesh = create_lathe_mesh("Mesh_Rey", profile, segments=36)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    # Cruz real en la cima del Rey
    bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=_translation_rotation_matrix(0, 0, 1.86, 0, 0.07, 0.07, 0.26)
    )
    bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=_translation_rotation_matrix(0, 0, 1.90, 0, 0.22, 0.07, 0.07)
    )
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def build_knight_mesh():
    """Crea el Caballo combinando pedestal torneado y cabeza esculpida."""
    base_profile = [
        (0.00, 0.00), (0.38, 0.00), (0.38, 0.07), (0.34, 0.13),
        (0.29, 0.20), (0.24, 0.30), (0.26, 0.35), (0.00, 0.36)
    ]
    mesh = create_lathe_mesh("Mesh_Caballo", base_profile, segments=32)
    bm = bmesh.new()
    bm.from_mesh(mesh)

    # Secciones del cuello, cabeza, hocico y orejas del caballo
    parts = [
        # (x, y, z, rot_y, sx, sy, sz)
        (0.0, -0.03, 0.56, 0.20, 0.24, 0.30, 0.42),   # Pecho/cuello bajo
        (0.0, -0.01, 0.85, 0.35, 0.21, 0.28, 0.38),   # Cuello alto
        (0.0,  0.08, 1.08, 0.65, 0.20, 0.36, 0.24),   # Cabeza
        (0.0,  0.24, 1.00, 0.95, 0.15, 0.28, 0.17),   # Hocico
        (0.0, -0.14, 0.78, 0.15, 0.08, 0.14, 0.52),   # Crin
        (-0.07, -0.04, 1.24, -0.15, 0.05, 0.08, 0.16), # Oreja izq
        ( 0.07, -0.04, 1.24, -0.15, 0.05, 0.08, 0.16), # Oreja der
    ]
    from mathutils import Matrix
    for (x, y, z, rx, sx, sy, sz) in parts:
        m = (
            Matrix.Translation((x, y, z))
            @ Matrix.Rotation(rx, 4, 'X')
            @ Matrix.Diagonal((sx, sy, sz, 1.0))
        )
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)

    bm.to_mesh(mesh)
    bm.free()
    return mesh


# ==============================================================================
# 4. CONSTRUCCIÓN DEL TABLERO Y LAS 32 PIEZAS
# ==============================================================================

BOARD_HEIGHT_Z = 2.50  # Altura de la superficie de la mesa del castillo
SQUARE_SIZE = 0.95     # Tamaño de cada escaque


def create_chessboard(col_board, mats):
    """Genera las 64 casillas biseladas y el marco tallado del tablero."""
    board_origin_offset = -3.5 * SQUARE_SIZE

    for row in range(8):
        for col in range(8):
            x = board_origin_offset + col * SQUARE_SIZE
            y = board_origin_offset + row * SQUARE_SIZE
            z = BOARD_HEIGHT_Z + 0.06

            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
            sq = bpy.context.active_object
            file_letter = chr(ord('A') + col)
            rank_num = row + 1
            sq.name = f"Casilla_{file_letter}{rank_num}"
            sq.scale = (SQUARE_SIZE * 0.985, SQUARE_SIZE * 0.985, 0.12)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

            # Bisel sutil para reflejos de antorchas
            bevel = sq.modifiers.new(name="Bevel", type='BEVEL')
            bevel.width = 0.015
            bevel.segments = 2

            is_light = (row + col) % 2 == 1
            sq.data.materials.append(mats['square_light'] if is_light else mats['square_dark'])
            link_to_collection(sq, col_board)

    # Base/Marco de madera noble bajo las casillas
    total_span = 8 * SQUARE_SIZE + 0.9
    bpy.ops.mesh.primitive_cube_add(
        size=1.0, location=(0.0, 0.0, BOARD_HEIGHT_Z - 0.02)
    )
    frame = bpy.context.active_object
    frame.name = "Marco_Tablero_Real"
    frame.scale = (total_span, total_span, 0.16)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = frame.modifiers.new(name="Bevel", type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 3
    frame.data.materials.append(mats['board_frame'])
    link_to_collection(frame, col_board)

    # Moldura dorada perimetral
    bpy.ops.mesh.primitive_cube_add(
        size=1.0, location=(0.0, 0.0, BOARD_HEIGHT_Z + 0.02)
    )
    trim = bpy.context.active_object
    trim.name = "Moldura_Oro_Tablero"
    trim.scale = (8 * SQUARE_SIZE + 0.18, 8 * SQUARE_SIZE + 0.18, 0.10)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    trim.data.materials.append(mats['gold_trim'])
    link_to_collection(trim, col_board)


def create_all_pieces(col_pieces, mats):
    """Genera las 32 piezas sobre el tablero en su posición inicial reglamentaria."""
    meshes = {
        'Peon': build_pawn_mesh(),
        'Torre': build_rook_mesh(),
        'Caballo': build_knight_mesh(),
        'Alfil': build_bishop_mesh(),
        'Reina': build_queen_mesh(),
        'Rey': build_king_mesh(),
    }

    back_rank = ['Torre', 'Caballo', 'Alfil', 'Reina', 'Rey', 'Alfil', 'Caballo', 'Torre']
    board_origin_offset = -3.5 * SQUARE_SIZE
    piece_z = BOARD_HEIGHT_Z + 0.12

    def spawn_piece(piece_type, col_idx, row_idx, is_white):
        side_str = "Blanco" if is_white else "Negro"
        file_letter = chr(ord('A') + col_idx)
        rank_num = row_idx + 1
        obj_name = f"{piece_type}_{side_str}_{file_letter}{rank_num}"

        obj = bpy.data.objects.new(obj_name, meshes[piece_type])
        x = board_origin_offset + col_idx * SQUARE_SIZE
        y = board_origin_offset + row_idx * SQUARE_SIZE
        obj.location = (x, y, piece_z)

        # Orientar caballos mirándose frente a frente
        if not is_white:
            obj.rotation_euler = (0.0, 0.0, math.pi)

        mat = mats['white_piece'] if is_white else mats['black_piece']
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            # Creamos copia ligera de malla para tener el material por bando
            mesh_copy = meshes[piece_type].copy()
            mesh_copy.materials.clear()
            mesh_copy.materials.append(mat)
            obj.data = mesh_copy

        link_to_collection(obj, col_pieces)

    for c in range(8):
        # Blancas (filas 1 y 2 -> índices 0 y 1)
        spawn_piece(back_rank[c], c, 0, True)
        spawn_piece('Peon', c, 1, True)
        # Negras (filas 7 y 8 -> índices 6 y 7)
        spawn_piece('Peon', c, 6, False)
        spawn_piece(back_rank[c], c, 7, False)


# ==============================================================================
# 5. ARQUITECTURA DEL GRAN SALÓN DEL CASTILLO MEDIEVAL
# ==============================================================================

def create_medieval_castle(col_castle, mats):
    """Construye la mesa real, columnas góticas, muros de piedra, almenas, estandartes y antorchas."""
    # 1. Suelo del Gran Salón de Piedra
    bpy.ops.mesh.primitive_plane_add(size=36.0, location=(0.0, 0.0, 0.0))
    floor = bpy.context.active_object
    floor.name = "Suelo_Gran_Salon"
    floor.data.materials.append(mats['castle_stone_dark'])
    link_to_collection(floor, col_castle)

    # 2. Mesa Medieval de Roble y Piedra (bajo el tablero)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=5.6, depth=0.35, location=(0.0, 0.0, BOARD_HEIGHT_Z - 0.25)
    )
    table_top = bpy.context.active_object
    table_top.name = "Mesa_Real_Tablero"
    table_top.data.materials.append(mats['oak_wood'])
    link_to_collection(table_top, col_castle)

    # Pedestal central octogonal de la mesa
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=1.9, depth=BOARD_HEIGHT_Z - 0.35,
        location=(0.0, 0.0, (BOARD_HEIGHT_Z - 0.35) / 2.0)
    )
    pedestal = bpy.context.active_object
    pedestal.name = "Pedestal_Mesa_Piedra"
    pedestal.data.materials.append(mats['castle_stone'])
    link_to_collection(pedestal, col_castle)

    # 3. Muros perimetrales del castillo
    wall_dist = 15.0
    wall_height = 12.0
    wall_configs = [
        ("Muro_Norte", (0.0, wall_dist, wall_height / 2), (31.0, 1.2, wall_height)),
        ("Muro_Sur",   (0.0, -wall_dist, wall_height / 2), (31.0, 1.2, wall_height)),
        ("Muro_Este",  (wall_dist, 0.0, wall_height / 2), (1.2, 31.0, wall_height)),
        ("Muro_Oeste", (-wall_dist, 0.0, wall_height / 2), (1.2, 31.0, wall_height)),
    ]
    for w_name, loc, scl in wall_configs:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
        w = bpy.context.active_object
        w.name = w_name
        w.scale = scl
        w.data.materials.append(mats['castle_stone'])
        link_to_collection(w, col_castle)

    # 4. Columnas Góticas y Antorchas de Muro
    pillar_coords = [
        (-10.0, -10.0), (10.0, -10.0), (-10.0, 10.0), (10.0, 10.0),
        (-13.5, -5.0),  (13.5, -5.0),  (-13.5, 5.0),  (13.5, 5.0),
        (-5.0, 13.5),   (5.0, 13.5),   (-5.0, -13.5), (5.0, -13.5),
    ]
    for idx, (px, py) in enumerate(pillar_coords):
        # Columna
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12, radius=0.85, depth=wall_height, location=(px, py, wall_height / 2)
        )
        pil = bpy.context.active_object
        pil.name = f"Columna_Gotica_{idx+1}"
        pil.data.materials.append(mats['castle_stone_dark'])
        link_to_collection(pil, col_castle)

        # Base de la columna
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, py, 0.45))
        base = bpy.context.active_object
        base.name = f"Base_Columna_{idx+1}"
        base.scale = (2.1, 2.1, 0.9)
        base.data.materials.append(mats['castle_stone'])
        link_to_collection(base, col_castle)

        # Antorcha orientada hacia el centro del salón
        dir_vec = Vector((-px, -py, 0.0)).normalized()
        tx = px + dir_vec.x * 1.05
        ty = py + dir_vec.y * 1.05
        tz = 4.5

        bpy.ops.mesh.primitive_cone_add(
            vertices=8, radius1=0.06, radius2=0.18, depth=0.65, location=(tx, ty, tz)
        )
        sconce = bpy.context.active_object
        sconce.name = f"Soporte_Antorcha_{idx+1}"
        sconce.data.materials.append(mats['iron_metal'])
        link_to_collection(sconce, col_castle)

        # Llama emisiva
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=12, ring_count=8, radius=0.16, location=(tx, ty, tz + 0.42)
        )
        flame = bpy.context.active_object
        flame.name = f"Llama_Antorcha_{idx+1}"
        flame.scale = (1.0, 1.0, 1.6)
        flame.data.materials.append(mats['torch_flame'])
        link_to_collection(flame, col_castle)

        # Luz puntual cálida de la antorcha
        light_data = bpy.data.lights.new(name=f"Luz_Antorcha_{idx+1}", type='POINT')
        light_data.energy = 320.0
        light_data.color = (1.0, 0.58, 0.22)
        light_data.shadow_soft_size = 0.35
        light_obj = bpy.data.objects.new(name=f"Luz_Antorcha_{idx+1}", object_data=light_data)
        light_obj.location = (tx + dir_vec.x * 0.2, ty + dir_vec.y * 0.2, tz + 0.55)
        link_to_collection(light_obj, col_castle)

    # 5. Estandartes Reales en los muros
    banner_positions = [
        (0.0, 14.2, 6.8, (2.2, 0.08, 5.5), mats['banner_red']),
        (-7.5, 14.2, 6.8, (1.8, 0.08, 4.8), mats['banner_blue']),
        (7.5, 14.2, 6.8, (1.8, 0.08, 4.8), mats['banner_blue']),
        (14.2, 0.0, 6.8, (0.08, 2.2, 5.5), mats['banner_red']),
        (-14.2, 0.0, 6.8, (0.08, 2.2, 5.5), mats['banner_red']),
    ]
    for b_idx, (bx, by, bz, bscl, bmat) in enumerate(banner_positions):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, by, bz))
        ban = bpy.context.active_object
        ban.name = f"Estandarte_Real_{b_idx+1}"
        ban.scale = bscl
        ban.data.materials.append(bmat)
        link_to_collection(ban, col_castle)

    # 6. Candelabro de Hierro Forjado sobre la Mesa de Ajedrez
    chandelier_z = 8.2
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.4, minor_radius=0.10, location=(0.0, 0.0, chandelier_z)
    )
    ring = bpy.context.active_object
    ring.name = "Candelabro_Real_Aro"
    ring.data.materials.append(mats['iron_metal'])
    link_to_collection(ring, col_castle)

    # Luz principal cenital cálida sobre el tablero
    spot_data = bpy.data.lights.new(name="Luz_Cenital_Tablero", type='AREA')
    spot_data.energy = 650.0
    spot_data.color = (1.0, 0.86, 0.68)
    spot_data.size = 4.5
    spot_obj = bpy.data.objects.new(name="Luz_Cenital_Tablero", object_data=spot_data)
    spot_obj.location = (0.0, 0.0, chandelier_z - 0.5)
    link_to_collection(spot_obj, col_castle)


# ==============================================================================
# 6. CÁMARA Y ENTORNO DE RENDERIZADO
# ==============================================================================

def setup_camera_and_world(col_castle):
    """Configura la cámara principal apuntando al tablero y la atmósfera nocturna medieval."""
    cam_data = bpy.data.cameras.new(name="Camara_Real_Ajedrez")
    cam_data.lens = 35.0
    cam_obj = bpy.data.objects.new("Camara_Real_Ajedrez", cam_data)
    cam_obj.location = (0.0, -9.2, 7.6)
    cam_obj.rotation_euler = (math.radians(52.0), 0.0, 0.0)
    link_to_collection(cam_obj, col_castle)
    bpy.context.scene.camera = cam_obj

    # Mundo oscuro azulado (noche medieval)
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("Mundo_Castillo_Nocturno")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs[0].default_value = (0.02, 0.025, 0.045, 1.0)
        bg_node.inputs[1].default_value = 0.6


# ==============================================================================
# 7. EJECUCIÓN PRINCIPAL Y EXPORTACIÓN OPCIONAL A .GLB
# ==============================================================================

def main():
    print("Iniciando generación de Ajedrez 3D en Castillo Medieval...")
    clear_scene()

    col_root = get_or_create_collection("Ajedrez_Castillo_Medieval")
    col_castle = get_or_create_collection("01_Castillo_Medieval", col_root)
    col_board = get_or_create_collection("02_Tablero", col_root)
    col_pieces = get_or_create_collection("03_Piezas_Ajedrez", col_root)

    mats = create_all_materials()
    create_chessboard(col_board, mats)
    create_all_pieces(col_pieces, mats)
    create_medieval_castle(col_castle, mats)
    setup_camera_and_world(col_castle)

    # Si se ejecuta por línea de comandos o el usuario desea el .glb listo:
    out_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
    glb_path = os.path.join(out_dir, "castillo_ajedrez.glb")
    try:
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
        print(f"Modelo 3D exportado exitosamente en: {glb_path}")
    except Exception as exc:
        print(f"Escena creada en Blender (exportación GLB omitida: {exc})")

    print("¡Escena de Ajedrez 3D en Castillo Medieval completada con éxito!")


if __name__ == "__main__":
    main()
