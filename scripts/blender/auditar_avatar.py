# Mede o estado real de um avatar antes de mexer nele.
#
# POR QUE ISTO EXISTE
#
# As duas perguntas que decidem todo o trabalho de aparência do cast — "quantas
# cabeças de altura?" e "as normais são por face ou por vértice?" — não têm
# resposta olhando o render. Proporção errada não parece defeito: ninguém olha e
# pensa "sete cabeças e meia", olha e pensa "não parece um personagem de jogo".
# E facetamento tem duas causas com o mesmo sintoma (face marcada flat vs.
# vértice duplicado por face), que exigem correções diferentes e em lugares
# diferentes — uma no runtime, outra só no Blender.
#
# Medir antes é o que impede de gastar a tarde na correção errada.
#
# Uso:
#   blender --background --python scripts/blender/auditar_avatar.py -- <arquivo>
#
# Sem argumento, audita o `.gltf` de origem do boleiro: o que interessa medir é
# a MATÉRIA-PRIMA (com ossos), não o `.glb` exportado — este sai sem armadura,
# então não há osso `Head` de onde tirar a razão de cabeças.

import os
import sys

import bpy
from mathutils import Vector

PACKS = os.path.expanduser(os.environ.get("QUATERNIUS", "~/Downloads/quaternius"))
PADRAO = os.path.join(
    PACKS,
    "Ultimate Modular Men- Feb 2022",
    "Individual Characters",
    "glTF",
    "Casual_2.gltf",
)


def malhas():
    # Mesmo descarte de `build_avatars.limpar_lixo`: os `.gltf` do pack trazem
    # uma esfera de 2 m de sobra do ambiente do autor. Medir com ela dentro dá
    # 2,81 m de "altura" e uma razão de 10,55 cabeças — número que não descreve
    # personagem nenhum, e que sem este filtro a auditoria reportaria como se
    # descrevesse.
    return [
        o
        for o in bpy.data.objects
        if o.type == "MESH" and not o.name.startswith(("Icosphere", "Sphere."))
    ]


def triangulos(me):
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def razao_cabecas(arm, ms):
    """Quantas cabeças de altura o personagem tem.

    A base da cabeça é a cabeça do OSSO `Head` (em Blender, `bone.head` é a
    ponta de origem do osso, nada a ver com o crânio). Do topo da caixa até ali
    é a altura da cabeça; a razão é a altura total dividida por isso.
    """
    if not arm:
        return None
    osso = arm.pose.bones.get("Head") or arm.pose.bones.get("mixamorig:Head")
    if not osso:
        return None
    zs = [(o.matrix_world @ Vector(c)).z for o in ms for c in o.bound_box]
    total = max(zs) - min(zs)
    base = (arm.matrix_world @ osso.head).z
    alto_cabeca = max(zs) - base
    return total, alto_cabeca, (total / alto_cabeca if alto_cabeca else None)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    caminho = argv[0] if argv else PADRAO
    if not os.path.exists(caminho):
        raise SystemExit(f"não existe: {caminho}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if caminho.endswith((".gltf", ".glb")):
        bpy.ops.import_scene.gltf(filepath=caminho)
    else:
        bpy.ops.import_scene.fbx(filepath=caminho)

    print("\n" + "=" * 66)
    print(f"AUDITORIA  {os.path.basename(caminho)}")
    print("=" * 66)

    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    ms = malhas()

    print("\n--- OBJETOS ---")
    for o in bpy.data.objects:
        esc = tuple(round(s, 3) for s in o.scale)
        rot = tuple(round(r, 3) for r in o.rotation_euler)
        print(f"{o.type:9} {o.name:28} escala={esc} rot={rot}")

    print("\n--- OSSOS ---")
    if arm:
        nomes = [b.name for b in arm.pose.bones]
        print(f"{len(nomes)} ossos: {', '.join(nomes)}")
    else:
        print("SEM ARMADURA")

    print("\n--- MALHAS ---")
    tot_tris = 0
    for o in ms:
        me = o.data
        tris = triangulos(me)
        tot_tris += tris
        suaves = sum(1 for p in me.polygons if p.use_smooth)
        # A pergunta que decide se o facetamento tem conserto no runtime: se há
        # muito mais loops que vértices, os vértices estão partidos por face e
        # `computeVertexNormals()` no Three não resolve — só soldar no Blender.
        print(
            f"{o.name:26} tris={tris:6} faces={len(me.polygons):5} "
            f"verts={len(me.vertices):5} loops={len(me.loops):5} "
            f"suaves={suaves}/{len(me.polygons)} "
            f"uv={len(me.uv_layers)} cor={len(me.color_attributes)}"
        )
    print(f"TOTAL triângulos: {tot_tris}")

    print("\n--- MATERIAIS ---")
    print(f"{len(bpy.data.materials)}: {', '.join(sorted(m.name for m in bpy.data.materials))}")

    print("\n--- PROPORÇÃO ---")
    r = razao_cabecas(arm, ms)
    if r:
        total, cabeca, razao = r
        print(f"altura total {total:.3f} m | cabeça {cabeca:.3f} m")
        print(f"RAZÃO DE CABEÇAS: {razao:.2f}   (alvo do documento: 3,2 a 3,8)")
    else:
        print("não deu para medir (sem armadura ou sem osso Head)")

    print("\n--- ANIMAÇÕES ---")
    print(f"{len(bpy.data.actions)}: {', '.join(sorted(a.name for a in bpy.data.actions))}")
    print("=" * 66 + "\n")


main()
