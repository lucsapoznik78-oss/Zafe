# Lê os packs de personagem baixados e escreve um inventário em JSON.
#
# POR QUE ESTE PASSO EXISTE
#
# A montagem dos 30 personagens do cast vai ser automática: uma tabela de
# receitas (base + peças + cores) e um script que exporta um `.glb` por linha.
# Mas a tabela só pode ser escrita depois de saber COMO as peças se chamam
# dentro dos arquivos — se o torso é um objeto separado ou uma parte da malha,
# se as variantes vêm no mesmo `.glb` ou em arquivos distintos, quais materiais
# existem para recolorir. Chutar isso produz uma tabela que não casa com nada.
#
# Este script não modifica nenhum arquivo de origem: abre cada um numa cena
# vazia, anota o que encontrou e segue.
#
# USO
#
#   blender --background --python scripts/blender/inspecionar.py -- \
#       ~/Downloads/quaternius scripts/blender/inventario.json
#
# O primeiro argumento é a pasta onde os packs foram descompactados (varre as
# subpastas), o segundo é onde gravar o resultado.

import json
import os
import sys

import bpy

EXTENSOES = (".glb", ".gltf", ".fbx")


def argumentos():
    """Só o que vem depois de `--` é nosso; o resto é do próprio Blender."""
    if "--" not in sys.argv:
        raise SystemExit(
            "uso: blender --background --python inspecionar.py -- <pasta> <saida.json>"
        )
    depois = sys.argv[sys.argv.index("--") + 1 :]
    if len(depois) != 2:
        raise SystemExit("informe exatamente a pasta de origem e o arquivo de saída")
    return depois[0], depois[1]


def cena_vazia():
    """Cada arquivo é inspecionado sozinho — sem isso o inventário acumularia
    os objetos do arquivo anterior e atribuiria peças ao pack errado."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def importar(caminho):
    baixo = caminho.lower()
    if baixo.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=caminho)
    else:
        bpy.ops.import_scene.gltf(filepath=caminho)


def inspecionar(caminho):
    cena_vazia()
    importar(caminho)

    malhas = []
    esqueletos = []
    materiais = set()

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            malhas.append(
                {
                    "nome": obj.name,
                    "vertices": len(obj.data.vertices),
                    # Arredondado: o que interessa é a ordem de grandeza para
                    # saber se a peça é o corpo todo ou um acessório.
                    "tamanho": [round(v, 3) for v in obj.dimensions],
                    "materiais": [s.material.name for s in obj.material_slots if s.material],
                    # Peça modular trocável costuma vir escondida por padrão:
                    # é assim que o autor entrega "escolha uma destas".
                    "visivel": not obj.hide_get(),
                }
            )
            materiais.update(
                s.material.name for s in obj.material_slots if s.material
            )
        elif obj.type == "ARMATURE":
            esqueletos.append({"nome": obj.name, "ossos": len(obj.data.bones)})

    return {
        "malhas": sorted(malhas, key=lambda m: m["nome"]),
        "esqueletos": esqueletos,
        "materiais": sorted(materiais),
        "animacoes": sorted(a.name for a in bpy.data.actions),
    }


def main():
    raiz, saida = argumentos()
    raiz = os.path.expanduser(raiz)
    saida = os.path.expanduser(saida)

    if not os.path.isdir(raiz):
        raise SystemExit(f"pasta não encontrada: {raiz}")

    arquivos = []
    for pasta, _, nomes in os.walk(raiz):
        for nome in sorted(nomes):
            if nome.lower().endswith(EXTENSOES):
                arquivos.append(os.path.join(pasta, nome))

    if not arquivos:
        raise SystemExit(f"nenhum .glb/.gltf/.fbx em {raiz}")

    inventario = {}
    for caminho in sorted(arquivos):
        rel = os.path.relpath(caminho, raiz)
        print(f"[inspecionar] {rel}", flush=True)
        try:
            inventario[rel] = inspecionar(caminho)
        except Exception as erro:
            # Um arquivo problemático não pode derrubar o inventário inteiro —
            # o erro fica registrado na própria entrada e a varredura continua.
            inventario[rel] = {"erro": str(erro)}

    os.makedirs(os.path.dirname(saida) or ".", exist_ok=True)
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(inventario, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"[inspecionar] {len(inventario)} arquivos -> {saida}", flush=True)


main()
