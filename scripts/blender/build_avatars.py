# Monta os personagens do cast a partir dos packs CC0 e exporta um `.glb` cada.
#
# COMO ISTO É USADO
#
#   blender --background --python scripts/blender/build_avatars.py -- [ids...]
#
# Sem argumentos, monta o cast inteiro. Com ids, só os pedidos — é assim que se
# itera num personagem sem esperar os outros 29.
#
#   blender --background --python scripts/blender/build_avatars.py -- --folha
#
# Rende a folha de contato de tudo que já foi montado, para conferir o elenco
# lado a lado.
#
# POR QUE UMA TABELA, E NÃO TRINTA ARQUIVOS MONTADOS À MÃO
#
# Cada personagem é uma linha de `RECEITAS`: de quem vem o corpo, quais peças
# são trocadas por outro personagem, que cor cada material recebe e em que pose
# ele congela. Montar na mão daria o mesmo resultado uma vez; a tabela dá o
# mesmo resultado toda vez, e um personagem novo — ou uma skin de campanha — é
# uma linha, não uma tarde de Blender.
#
# POR QUE O EXPORT É ESTÁTICO
#
# O cast não anima em lugar nenhum do app: é um boneco parado que o usuário gira
# no editor e fotografa ao salvar. Congelar a pose (aplicar a armadura e
# descartar o esqueleto) tira os pesos de skin e os 62 ossos do arquivo, e é a
# diferença entre 2,3 MB e 780 KB por personagem — vezes trinta, entre 70 MB e
# 23 MB de assets no repositório.

import json
import math
import os
import re
import sys

import bpy
from mathutils import Vector

# ---------------------------------------------------------------- CAMINHOS

PACKS = os.path.expanduser(os.environ.get("QUATERNIUS", "~/Downloads/quaternius"))
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAIDA = os.path.join(RAIZ, "public", "avatares")

HOMEM = os.path.join(PACKS, "Ultimate Modular Men- Feb 2022")
MULHER = os.path.join(PACKS, "Ultimate Modular Women - April 2022")


def pack(sexo):
    return HOMEM if sexo == "h" else MULHER


def caminho_base(sexo, nome):
    return os.path.join(pack(sexo), "Individual Characters", "glTF", f"{nome}.gltf")


# ------------------------------------------------------------------ CORES
#
# A paleta do app, para o cast não parecer importado de outro produto. Os nomes
# são os dos materiais DENTRO dos packs (`Skin`, `Hair`, `Black`…) — é por eles
# que a receita pinta, e é o que permite recolorir sem abrir nenhum arquivo.

PELE = ["#F2D3B8", "#E7BC96", "#C68B62", "#95573A", "#5C3421"]
CABELO = ["#1B1613", "#4A2F1C", "#8A5A2B", "#C9A227", "#B33A3A", "#E8E4DF"]


def hex_rgba(h):
    """Hex para RGB linear.

    O Blender guarda cor de material em espaço linear, e o hex do design está em
    sRGB. Jogar o valor cru resulta num cast visivelmente mais claro e lavado do
    que a paleta — o erro clássico, e invisível até comparar lado a lado.
    """
    h = h.lstrip("#")
    canais = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in canais
    ]
    return (*linear, 1.0)


# --------------------------------------------------------------- RECEITAS
#
# base    — (sexo, personagem) de onde vem o corpo inteiro
# pecas   — troca por peça: "Head" | "Body" | "Legs" | "Feet" -> (sexo, personagem)
# cores   — nome do material dentro do pack -> hex
# pose    — nome da animação do próprio pack; o frame é onde ela congela

# Bases disponíveis (nome do `.gltf` em Individual Characters):
#   h: Adventurer Beach Casual_2 Casual_Hoodie Farmer King Punk Spacesuit
#      Suit Swat Worker
#   m: Adventurer Casual Formal Medieval Punk SciFi Soldier Suit Witch Worker
#
# Poses (as 24 ações que já vêm dentro do próprio `.gltf`):
#   Death Gun_Shoot HitRecieve HitRecieve_2 Idle Idle_Gun Idle_Gun_Pointing
#   Idle_Gun_Shoot Idle_Neutral Idle_Sword Interact Kick_Left Kick_Right
#   Punch_Left Punch_Right Roll Run Run_Back Run_Left Run_Right Run_Shoot
#   Sword_Slash Walk Wave
#
# A pose é o que separa 30 personagens de 30 estátuas: com 21 corpos para 30
# vagas, há repetição de base inevitável, e é a silhueta que impede que duas
# receitas irmãs (astronauta/piloto, boxeador/corredor) leiam como a mesma
# figura pintada de outra cor.

RECEITAS = {
    # ----------------------------------------------------------------- comuns
    "av-boleiro-varzea": {
        # Camisa de time por cima do calção do Beach: nenhum pack traz uniforme
        # de futebol, mas camiseta + calção + chuteira é o uniforme.
        "base": ("h", "Casual_2"),
        "pecas": {"Legs": ("h", "Beach")},
        "pose": ("Kick_Right", 12),
        "cores": {
            "Skin": PELE[2],
            "Red_Dark": "#0E7C3A",
            "LightBrown": "#0E7C3A",
            "White": "#F5F5F5",
            "Hair": CABELO[1],
        },
    },
    "av-torcedor-arquibancada": {
        "base": ("h", "Casual_2"),
        "pose": ("Wave", 14),
        "cores": {
            "Skin": PELE[1],
            "Red_Dark": "#C8102E",
            "LightBrown": "#1B1B1B",
            "LightBlue": "#C8102E",
            "Hair": CABELO[0],
        },
    },
    "av-estagiario-bolao": {
        "base": ("h", "Suit"),
        "pose": ("Interact", 18),
        "cores": {
            "Skin": PELE[1],
            "Suit": "#2E3A59",
            "Tie": "#C8102E",
            "Hair": CABELO[1],
        },
    },
    "av-vovo-radio": {
        # Cabelo branco é o que faz a idade aqui; o corpo é o mesmo casual.
        "base": ("h", "Casual_2"),
        "pose": ("Interact", 22),
        "cores": {
            "Skin": PELE[1],
            "Hair": CABELO[5],
            "Eyebrows": CABELO[5],
            "Red_Dark": "#7C6A55",
            "LightBrown": "#4A4038",
        },
    },
    "av-corredor-rua": {
        "base": ("h", "Beach"),
        "pose": ("Run", 6),
        "cores": {
            "Skin": PELE[3],
            "White": "#D7F205",
            "Red_Dark": "#1F6FEB",
            "Hair": CABELO[0],
        },
    },
    "av-goleiro-reserva": {
        "base": ("h", "Casual_2"),
        "pecas": {"Legs": ("h", "Beach")},
        "pose": ("Idle_Neutral", 1),
        "cores": {
            "Skin": PELE[0],
            "Red_Dark": "#F0B429",
            "LightBrown": "#F0B429",
            "White": "#1B1B1B",
            "Hair": CABELO[3],
        },
    },
    "av-vendedor-pipoca": {
        "base": ("h", "Worker"),
        "pose": ("Walk", 10),
        "cores": {
            "Skin": PELE[2],
            "Worker_Vest": "#C8102E",
            "Worker_Yellow": "#F5F0E6",
        },
    },
    "av-menina-volei": {
        "base": ("m", "Casual"),
        "pose": ("Punch_Left", 10),
        "cores": {
            "Skin": PELE[1],
            "White": "#F5F5F5",
            "Grey": "#1F6FEB",
            "Orange": "#1F6FEB",
            "Hair_Brown": CABELO[1],
        },
    },
    "av-skatista-praca": {
        "base": ("h", "Punk"),
        "pose": ("Idle", 1),
        "cores": {
            "Skin": PELE[1],
            "Red_Dark": "#2E9E8F",
            "Red": "#2E9E8F",
            "White": "#EDEDED",
            "LightBlue": "#3A3A3A",
        },
    },
    "av-ciclista-urbano": {
        # O Swat é o único corpo com capacete e viseira. Em amarelo-neon com
        # viseira espelhada ele deixa de ser tropa de choque e vira ciclista.
        "base": ("h", "Swat"),
        "pose": ("Run", 14),
        "cores": {
            "Skin": PELE[1],
            "Swat": "#D7F205",
            "Swat_Black": "#1B1B1B",
            "Visor": "#7FD8FF",
            "Grey": "#3A3A3A",
        },
    },
    "av-zelador-estadio": {
        "base": ("h", "Worker"),
        "pose": ("Walk", 4),
        "cores": {
            "Skin": PELE[3],
            "Worker_Vest": "#2E6B4F",
            "Worker_Yellow": "#9AA3A8",
            # O Worker vem de capacete: não há material `Hair` para envelhecer.
            # O bigode é o que sobra para dar idade ao zelador.
            "Moustache": CABELO[5],
        },
    },
    "av-tiete-fantasy": {
        "base": ("m", "Casual"),
        "pose": ("Interact", 20),
        "cores": {
            "Skin": PELE[0],
            "White": "#F2B8D0",
            "Grey": "#5B2D8E",
            "Orange": "#F0B429",
            "Hair_Brown": CABELO[3],
        },
    },
    # ---------------------------------------------------------------- incomuns
    "av-tenista-clube": {
        "base": ("h", "Casual_2"),
        "pecas": {"Legs": ("h", "Beach")},
        # Sword_Slash é o arco de raquete que o pack não tem: o braço cruza o
        # corpo no mesmo caminho de um forehand.
        "pose": ("Sword_Slash", 14),
        "cores": {
            "Skin": PELE[0],
            "Red_Dark": "#FFFFFF",
            "LightBrown": "#FFFFFF",
            "White": "#FFFFFF",
            "LightBlue": "#D7F205",
            "Hair": CABELO[2],
        },
    },
    "av-surfista-fim-tarde": {
        "base": ("h", "Beach"),
        "pose": ("Idle", 1),
        "cores": {
            "Skin": PELE[2],
            "Red_Dark": "#0E9AA7",
            "White": "#F5E6C8",
            "Hair": CABELO[3],
        },
    },
    "av-nadadora-olimpica": {
        # O corpo SciFi feminino é um macacão colado sem folgas — a única peça
        # dos packs que lê como maiô de competição depois de perder o brilho.
        "base": ("m", "SciFi"),
        "pose": ("Idle_Neutral", 1),
        "cores": {
            "Skin": PELE[1],
            "Blue": "#12305C",
            "LightBlue": "#2E86DE",
            "Black": "#12305C",
            "Metal": "#9AA3A8",
            "Hair_Black": CABELO[0],
        },
    },
    "av-boxeador-aposentado": {
        "base": ("h", "Beach"),
        "pose": ("Punch_Right", 14),
        "cores": {
            "Skin": PELE[2],
            "Red_Dark": "#8E1B1B",
            "White": "#EDEDED",
            "Hair": CABELO[0],
        },
    },
    "av-jogador-sinuca": {
        "base": ("h", "Suit"),
        "pose": ("Idle_Sword", 1),
        "cores": {
            "Skin": PELE[1],
            "Suit": "#1E5E3C",
            "Tie": "#0E0E0E",
            "White": "#F5F5F5",
            "Hair": CABELO[0],
        },
    },
    "av-halterofilista": {
        "base": ("h", "Beach"),
        "pose": ("HitRecieve", 6),
        "cores": {
            "Skin": PELE[3],
            "Red_Dark": "#1B1B1B",
            "White": "#B8860B",
            "Hair": CABELO[0],
        },
    },
    "av-dj-torcida": {
        "base": ("h", "Punk"),
        "pose": ("Interact", 16),
        "cores": {
            "Skin": PELE[2],
            "Red_Dark": "#5B2D8E",
            "Red": "#D7F205",
            "Black": "#161616",
            "White": "#EDEDED",
        },
    },
    "av-reporter-campo": {
        "base": ("m", "Suit"),
        "pose": ("Interact", 22),
        "cores": {
            "Skin": PELE[1],
            "Black": "#C8102E",
            "White": "#F5F5F5",
            "Hair_Brown": CABELO[1],
        },
    },
    # ------------------------------------------------------------------ raros
    "av-arbitro-vilao": {
        "base": ("h", "Casual_2"),
        "pecas": {"Legs": ("h", "Beach")},
        # Wave levanta o braço acima da cabeça: é o cartão erguido, sem cartão.
        "pose": ("Wave", 16),
        "cores": {
            "Skin": PELE[1],
            "Red_Dark": "#141414",
            "LightBrown": "#141414",
            "White": "#F0B429",
            "Hair": CABELO[0],
        },
    },
    "av-mascote-tigre": {
        # Fantasia inteira não existe nos packs. O traje fechado do Spacesuit,
        # em laranja e preto, é o que mais perto chega de "pessoa dentro de uma
        # fantasia": corpo sem pele à mostra e cabeça grande.
        "base": ("h", "Spacesuit"),
        "pose": ("Wave", 14),
        "cores": {
            "SciFi_Main": "#F07818",
            "SciFi_MainDark": "#1B1B1B",
            "SciFi_Light": "#F5E0C0",
            "SciFi_Light_Accent": "#1B1B1B",
            "Grey": "#3A3A3A",
        },
    },
    "av-piloto-kart": {
        # Mesmo macacão do astronauta, recolorido: é o único traje fechado de
        # corpo inteiro dos packs, e de macacão vermelho com faixa ele lê como
        # piloto, não como astronauta vermelho.
        "base": ("h", "Spacesuit"),
        # Não `Idle_Gun`: sem a pistola (que sai em `limpar_aderecos`) as duas
        # mãos ficam fechadas no vazio à frente do peito, e o gesto não lê como
        # nada. Andando, o macacão fechado lê como piloto indo para o grid.
        "pose": ("Walk", 8),
        "cores": {
            "SciFi_Main": "#C8102E",
            "SciFi_MainDark": "#7A0A1C",
            "SciFi_Light": "#F2F2F2",
            "SciFi_Light_Accent": "#F0B429",
        },
    },
    "av-xadrezista-sombrio": {
        "base": ("h", "Suit"),
        "pose": ("Idle_Neutral", 1),
        "cores": {
            "Skin": PELE[0],
            "Suit": "#151515",
            "Tie": "#3A0D0D",
            "White": "#D8D8D8",
            "Hair": CABELO[0],
        },
    },
    "av-capita-nautica": {
        "base": ("m", "Suit"),
        "pose": ("Idle_Gun_Pointing", 1),
        "cores": {
            "Skin": PELE[1],
            "Black": "#16233F",
            "White": "#F5F5F5",
            "Hair_Brown": CABELO[0],
        },
    },
    "av-ginasta-fita": {
        "base": ("m", "SciFi"),
        "pose": ("Kick_Left", 12),
        "cores": {
            "Skin": PELE[0],
            "Blue": "#D6266B",
            "LightBlue": "#F0B429",
            "Black": "#8E1B5A",
            "Metal": "#F0B429",
            "Hair_Black": CABELO[1],
        },
    },
    # ----------------------------------------------------------------- épicos
    "av-ninja-dojo": {
        # Swat de novo, mas em preto absoluto e com a viseira escurecida a
        # leitura muda por completo: só a faixa dos olhos aparece.
        "base": ("h", "Swat"),
        "pose": ("Idle_Sword", 1),
        "cores": {
            "Skin": PELE[1],
            "Swat": "#14171C",
            "Swat_Black": "#0A0C10",
            "Visor": "#2A2F38",
            "Grey": "#4A0F14",
            "Black": "#0A0C10",
        },
    },
    "av-bruxa-sorte": {
        "base": ("m", "Witch"),
        "pose": ("Interact", 20),
        "cores": {"Skin": PELE[0], "Purple": "#5B2D8E", "Gold": "#D4AF37"},
    },
    "av-astronauta-perdido": {
        "base": ("h", "Spacesuit"),
        "pose": ("Idle", 1),
        "cores": {
            "SciFi_Main": "#E8EAF0",
            "SciFi_MainDark": "#B9BFCC",
            "SciFi_Light": "#FFFFFF",
            "SciFi_Light_Accent": "#D4AF37",
        },
    },
    # --------------------------------------------------------------- lendário
    "av-rei-bolao": {
        "base": ("h", "King"),
        "pose": ("Idle_Neutral", 1),
        "cores": {"Skin": PELE[1], "Blue": "#4C2A85", "Gold": "#D4AF37"},
    },
}


# ------------------------------------------------------------------ CENA


def cena_vazia():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def armadura():
    for o in bpy.data.objects:
        if o.type == "ARMATURE":
            return o
    return None


def malhas():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def remover(obj):
    bpy.data.objects.remove(obj, do_unlink=True)


def limpar_aderecos():
    """Tira as armas que vêm presas ao corpo.

    Quatro bases (`Suit` e `Swat` masculinos, `SciFi` feminino, `Medieval`)
    trazem uma pistola ou espada como malha própria, pesada na mão. Isso não é
    escolha de receita: quem pedir o terno para o Xadrezista Sombrio recebe o
    terno E a pistola, e sete dos trinta saíram armados no primeiro render.

    Numa plataforma de palpite esportivo brasileira, arma na mão de "Jogador de
    Sinuca" está errado como ilustração e errado como marca. Some por padrão."""
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.split(".")[0] in ("Pistol", "Sword"):
            remover(o)


def limpar_lixo():
    """Os `.gltf` de personagem trazem uma esfera de 2 unidades junto — sobra do
    ambiente do autor. Ela não aparece no viewport dele, mas entra no export e,
    pior, domina a caixa envolvente: o carregador do app normaliza altura pela
    caixa, então essa esfera encolheria todo personagem para caber nela."""
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.startswith(("Icosphere", "Sphere.")):
            remover(o)


# ------------------------------------------------------------------ PEÇAS


def trocar_peca(alvo_armadura, sexo, personagem, peca):
    """Substitui uma parte do corpo pela mesma parte de outro personagem.

    Funciona porque os 21 personagens dos dois packs dividem o MESMO esqueleto
    de 62 ossos, com os mesmos nomes — a peça doadora já vem pesada para ele.
    Só é preciso apontar o modificador para a armadura que fica e descartar o
    resto do doador.

    A peça vem do `.gltf` inteiro do doador, e não do FBX solto da pasta
    `Separate Skeletal Meshes`, apesar de o FBX ser o arquivo feito exatamente
    para isto. Motivo: os dois importadores não concordam na escala. A perna
    trazida do FBX entra minúscula e fora do corpo, e o resultado não é um erro
    — é um par de sapatos do tamanho de uma moeda boiando abaixo do personagem,
    que só aparece quando alguém olha o render. Importando os dois lados pelo
    mesmo caminho, a peça encaixa sem nenhuma correção de escala.
    """
    antigas = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=caminho_base(sexo, personagem))

    # Tudo por NOME, nunca por referência de objeto. `objects.remove()` invalida
    # na hora todo ponteiro Python para aquele objeto, e uma lista montada antes
    # da remoção passa a conter cadáveres: o simples `x.type` do próximo laço
    # estoura com "StructRNA of type Object has been removed".
    novas = [o.name for o in bpy.data.objects if o.name not in antigas]

    entrou = None
    for nome in novas:
        obj = bpy.data.objects.get(nome)
        if not obj:
            continue
        if obj.type == "MESH" and nome.split(".")[0].endswith(f"_{peca}"):
            entrou = nome
            obj.parent = alvo_armadura
            for m in obj.modifiers:
                if m.type == "ARMATURE":
                    m.object = alvo_armadura
        else:
            remover(obj)

    if not entrou:
        raise SystemExit(f"'{personagem}' não expõe a peça '{peca}' no glTF")

    # A peça original só sai depois da nova entrar: se saísse antes e o import
    # falhasse, o personagem exportaria sem cabeça e sem nenhum erro.
    for nome in list(antigas):
        obj = bpy.data.objects.get(nome)
        if obj and obj.type == "MESH" and nome.endswith(f"_{peca}"):
            remover(obj)


# ----------------------------------------------------------------- CORES


def nome_base_material(nome):
    """`Skin.001` -> `Skin`.

    Quando uma peça de outro personagem entra, ela traz os materiais dela. Como
    os packs reusam os mesmos nomes (`Skin`, `Hair`, `Black`), o Blender sufixa
    o duplicado. Sem normalizar, pintar `Skin` acertaria o rosto e deixaria as
    mãos na cor original — o defeito é discreto o bastante para passar batido na
    folha de contato e gritar no jogo.
    """
    raiz, _, sufixo = nome.rpartition(".")
    return raiz if raiz and sufixo.isdigit() else nome


def pintar(cores):
    for nome, hexa in cores.items():
        alvos = [m for m in bpy.data.materials if nome_base_material(m.name) == nome]
        if not alvos:
            existentes = ", ".join(
                sorted({nome_base_material(m.name) for m in bpy.data.materials})
            )
            print(f"  [aviso] material '{nome}' não existe aqui. Há: {existentes}")
            continue
        rgba = hex_rgba(hexa)
        for mat in alvos:
            mat.diffuse_color = rgba
            if mat.use_nodes:
                for no in mat.node_tree.nodes:
                    if no.type == "BSDF_PRINCIPLED":
                        no.inputs["Base Color"].default_value = rgba


# ------------------------------------------------------------------ POSE


def aplicar_pose(arm, nome_anim, frame):
    """Congela o personagem num quadro de uma das 24 animações do pack.

    O `.gltf` do personagem JÁ traz as 24 ações — não é preciso importar o
    `Animations.fbx`. E não dá para importar: o FBX cria uma segunda armadura,
    e a ação nasce presa a um *slot* com o nome dela (`OBCharacterArmature.001`).

    Do Blender 4.4 em diante uma ação é um contêiner de slots, e o slot é que
    liga os canais a um dono. Atribuir `animation_data.action` sem slot
    compatível é aceito sem erro e **não anima nada** — foi exatamente assim que
    o primeiro lote saiu inteiro em pose de descanso, sem um aviso sequer.
    Daí o slot explícito abaixo: é a diferença entre um cast de seis estátuas
    idênticas e um cast com silhuetas distintas.

    A biblioteca `Universal Animation Library` NÃO serve aqui: ela usa a
    nomenclatura da Unreal (`calf_l`, `clavicle_l`, 65 ossos) e estes
    personagens usam a do Blender (`Foot.L`, `Chest`, 62 ossos) — exatamente um
    nome de osso em comum entre as duas. Retargetar seria um projeto à parte.
    """
    acao = bpy.data.actions.get(nome_anim)
    if not acao:
        disponiveis = ", ".join(sorted(a.name for a in bpy.data.actions))
        raise SystemExit(f"pose '{nome_anim}' não existe. Há: {disponiveis}")

    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = acao
    if arm.animation_data.action_slot is None and acao.slots:
        arm.animation_data.action_slot = acao.slots[0]
    if arm.animation_data.action_slot is None:
        raise SystemExit(f"pose '{nome_anim}': nenhum slot aplicável a {arm.name}")

    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def congelar(arm):
    """Aplica a armadura em cada malha e joga o esqueleto fora.

    Depois disto o personagem é geometria pura, na pose escolhida. É o que
    permite exportar sem pesos de skin nem ossos — e o que torna o `.glb` três
    vezes menor."""
    for o in malhas():
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                bpy.ops.object.modifier_apply(modifier=m.name)
    if arm:
        remover(arm)


def juntar():
    """Uma malha só por personagem: cada malha separada é uma chamada de desenho
    a mais, e o editor já paga por sombra de contato e controles."""
    ms = malhas()
    if len(ms) < 2:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for o in ms:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    bpy.ops.object.join()


def assentar():
    """Pés em y=0 e centrado em x/z.

    O carregador do app já normaliza, mas ele normaliza o que chegar: se a pose
    deslocou o personagem para fora da origem (Run desloca), o boneco entraria
    torto no enquadramento da célula da loja."""
    ms = malhas()
    if not ms:
        return
    obj = ms[0]
    mundo = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    minimo = Vector(
        (
            min(v.x for v in mundo),
            min(v.y for v in mundo),
            min(v.z for v in mundo),
        )
    )
    maximo = Vector(
        (
            max(v.x for v in mundo),
            max(v.y for v in mundo),
            max(v.z for v in mundo),
        )
    )
    centro = (minimo + maximo) / 2
    # Z é a altura no Blender; X/Y são o plano do chão.
    obj.location -= Vector((centro.x, centro.y, minimo.z))


# ---------------------------------------------------------------- MONTAGEM


def montar(avatar_id, receita):
    print(f"[montar] {avatar_id}", flush=True)
    cena_vazia()

    sexo, personagem = receita["base"]
    bpy.ops.import_scene.gltf(filepath=caminho_base(sexo, personagem))
    limpar_lixo()
    limpar_aderecos()

    arm = armadura()
    if not arm:
        raise SystemExit(f"{avatar_id}: personagem base sem armadura")

    for peca, origem in receita.get("pecas", {}).items():
        trocar_peca(arm, origem[0], origem[1], peca)

    pintar(receita.get("cores", {}))

    pose = receita.get("pose")
    if pose:
        aplicar_pose(arm, pose[0], pose[1])

    congelar(arm)
    juntar()
    assentar()

    os.makedirs(SAIDA, exist_ok=True)
    destino = os.path.join(SAIDA, f"{avatar_id}.glb")
    bpy.ops.export_scene.gltf(
        filepath=destino,
        export_format="GLB",
        # Os materiais são cor chapada nomeada; não há textura a levar, e sem
        # esta linha o exportador embute os PNG do pack que ninguém usa.
        export_image_format="NONE",
        export_animations=False,
        export_skins=False,
        export_yup=True,
    )
    kb = round(os.path.getsize(destino) / 1024)
    verts = sum(len(o.data.vertices) for o in malhas())
    print(f"[montar] {avatar_id}: {kb} KB, {verts} vértices", flush=True)
    return {"id": avatar_id, "kb": kb, "vertices": verts}


# -------------------------------------------------------------------- RENDER


def iluminar(cena, fundo):
    """Duas luzes de sol. `fundo=None` deixa o mundo preto (para alpha).

    A de preenchimento não é enfeite: com um sol só, metade de cada personagem
    vira silhueta preta e some justamente o lado onde estaria o defeito que a
    folha existe para revelar.
    """
    sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", type="SUN"))
    sol.data.energy = 4.0
    sol.rotation_euler = (math.radians(55), 0, math.radians(35))
    cena.collection.objects.link(sol)

    preenche = bpy.data.objects.new("fill", bpy.data.lights.new("fill", type="SUN"))
    preenche.data.energy = 1.5
    preenche.rotation_euler = (math.radians(70), 0, math.radians(-130))
    cena.collection.objects.link(preenche)

    if fundo is not None:
        mundo = bpy.data.worlds.new("mundo")
        mundo.use_nodes = True
        mundo.node_tree.nodes["Background"].inputs[0].default_value = fundo
        cena.world = mundo


def motor_eevee(cena):
    """O nome do EEVEE mudou entre versões ("BLENDER_EEVEE_NEXT" no 4.2/4.3, de
    volta a "BLENDER_EEVEE" no 5.x). Escolher pelo que a build oferece evita que
    o render quebre em outra máquina com Blender diferente."""
    motores = cena.render.bl_rna.properties["engine"].enum_items.keys()
    cena.render.engine = (
        "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in motores else "BLENDER_EEVEE"
    )


# ------------------------------------------------------------ FOLHA DE CONTATO


def folha_contato(ids, largura=5):
    """Rende os personagens já montados lado a lado, numa imagem só.

    Serve para conferir o elenco como ele vai aparecer na loja: é olhando a
    fileira que se percebe que dois personagens ficaram com a mesma silhueta —
    coisa que nenhum deles denuncia sozinho.
    """
    cena_vazia()
    cena = bpy.context.scene

    prontos = [
        i for i in ids if os.path.exists(os.path.join(SAIDA, f"{i}.glb"))
    ]
    if not prontos:
        raise SystemExit("nenhum .glb montado ainda")

    linhas = (len(prontos) + largura - 1) // largura
    passo_x = 1.6
    passo_z = 2.4

    # A câmera olha na direção +Y, então a grade tem que crescer em X (colunas) e
    # em Z (fileiras). Empilhar fileiras em Y põe uma atrás da outra — a segunda
    # fileira some por trás da primeira e a folha mente dizendo que só montou 3.
    for n, avatar_id in enumerate(prontos):
        bpy.ops.import_scene.gltf(filepath=os.path.join(SAIDA, f"{avatar_id}.glb"))
        for o in malhas():
            if o.get("__posto"):
                continue
            o["__posto"] = True
            col = n % largura
            lin = n // largura
            o.location.x += (col - (largura - 1) / 2) * passo_x
            o.location.z += (linhas - 1 - lin) * passo_z
            o.rotation_euler.z = math.radians(-155)

    iluminar(cena, fundo=(0.18, 0.19, 0.22, 1))

    altura_grade = linhas * passo_z
    cam_dados = bpy.data.cameras.new("cam")
    cam_dados.type = "ORTHO"
    cam_dados.ortho_scale = max(largura * passo_x, altura_grade) * 1.08
    cam = bpy.data.objects.new("cam", cam_dados)
    cam.location = (0, -12, altura_grade / 2)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cena.collection.objects.link(cam)
    cena.camera = cam

    motor_eevee(cena)
    cena.render.film_transparent = False
    cena.render.resolution_x = largura * 300
    cena.render.resolution_y = int(largura * 300 * altura_grade / (largura * passo_x))
    cena.render.filepath = "/tmp/cast-folha.png"
    bpy.ops.render.render(write_still=True)
    print(f"[folha] {len(prontos)} personagens -> {cena.render.filepath}", flush=True)


# --------------------------------------------------------- FOLHA DE MINIATURAS


# Estes quatro números são um CONTRATO com `lib/figura/miniaturas.ts`. O card da
# loja recorta a folha por porcentagem, então ele não descobre a grade olhando a
# imagem: ele assume 5 colunas de célula retrato e calcula o deslocamento. Mudar
# COLUNAS aqui sem mudar `COLUNAS_AVATAR` lá desalinha o elenco inteiro em um
# card — e o defeito é sutil, cada personagem aparecendo com o ombro do vizinho.
COLUNAS_MINI = 5
ASPECTO_MINI = 0.75
# Fração da altura da célula ocupada pelo boneco. Não é 1: braço erguido (Wave)
# e chapéu pontudo passam do alto da cabeça, e a margem é o que evita o corte.
OCUPACAO_MINI = 0.86
CELULA_PX = 200


def ordem_do_catalogo():
    """Lê a ordem dos avatares direto de `lib/figura/avatares.ts`.

    A posição na folha é o índice no catálogo — é assim que `recorteAvatar`
    acha a célula. Se a ordem daqui divergir da de lá, cada card passa a mostrar
    o personagem do vizinho: nada quebra, nada avisa, e a loja fica inteira
    errada. Ler a fonte em vez de confiar que as duas listas continuam iguais
    transforma esse desencontro num erro de build.
    """
    caminho = os.path.join(RAIZ, "lib", "figura", "avatares.ts")
    with open(caminho, encoding="utf-8") as f:
        ids = re.findall(r'^\s{4}id:\s*"(av-[a-z0-9-]+)"', f.read(), re.MULTILINE)
    if not ids:
        raise SystemExit(f"não achei nenhum id de avatar em {caminho}")

    sem_receita = [i for i in ids if i not in RECEITAS]
    if sem_receita:
        raise SystemExit(f"sem receita para: {', '.join(sem_receita)}")
    return ids


def folha_miniaturas(ids):
    """Rende a grade de miniaturas do cast que a loja consome como sprite sheet.

    POR QUE ISTO É UM ARQUIVO E NÃO UM CANVAS

    A versão anterior montava os 30 num canvas WebGL escondido e fotografava o
    resultado ao abrir a aba. Aquilo era barato enquanto o cast era geometria
    gerada em código. Com malha esculpida cada personagem passou a ser um `.glb`
    de meio mega: montar os 30 para tirar uma foto custa ~16 MB baixados toda vez
    que alguém abre a aba, para produzir uma imagem que é sempre a mesma.

    Renderizada aqui, a folha vira um PNG versionado de algumas centenas de KB,
    servido do cache — e o navegador deixa de precisar de WebGL para mostrar a
    loja. Cada `.glb` só é baixado quando o personagem é de fato escolhido.

    O enquadramento imita o do app de propósito: cada boneco é normalizado pela
    própria altura antes de escalar, que é exatamente o que `Modelo.tsx` faz ao
    carregar. Sem isso o Rei — mais alto por causa da coroa — apareceria maior
    que o resto no card e menor que o resto no editor.
    """
    cena_vazia()
    cena = bpy.context.scene

    faltando = [i for i in ids if not os.path.exists(os.path.join(SAIDA, f"{i}.glb"))]
    if faltando:
        raise SystemExit(f"monte antes: {', '.join(faltando)}")

    linhas = (len(ids) + COLUNAS_MINI - 1) // COLUNAS_MINI

    for n, avatar_id in enumerate(ids):
        antes = {o.name for o in bpy.data.objects}
        bpy.ops.import_scene.gltf(filepath=os.path.join(SAIDA, f"{avatar_id}.glb"))
        novos = [o for o in malhas() if o.name not in antes]
        if not novos:
            raise SystemExit(f"{avatar_id}: glb sem malha")

        obj = novos[0]
        alto = max(
            (obj.matrix_world @ Vector(c)).z for c in obj.bound_box
        ) - min((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)
        obj.scale = (OCUPACAO_MINI / alto,) * 3

        col, lin = n % COLUNAS_MINI, n // COLUNAS_MINI
        obj.location = (
            (col - (COLUNAS_MINI - 1) / 2) * ASPECTO_MINI,
            0,
            (linhas - 1 - lin) + (1 - OCUPACAO_MINI) / 2,
        )
        obj.rotation_euler.z = math.radians(-155)

    iluminar(cena, fundo=None)

    cam_dados = bpy.data.cameras.new("cam")
    cam_dados.type = "ORTHO"
    # `ortho_scale` mede a MAIOR dimensão da imagem. A grade é mais alta que
    # larga, então o número é a altura em células — e a largura sai da proporção
    # da resolução, que precisa bater com `ASPECTO_MINI`.
    cam_dados.ortho_scale = linhas
    cam = bpy.data.objects.new("cam", cam_dados)
    cam.location = (0, -12, linhas / 2)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cena.collection.objects.link(cam)
    cena.camera = cam

    motor_eevee(cena)
    # Fundo transparente: o card tem cor própria e muda com o tema. Fundo opaco
    # aqui gravaria um retângulo cinza dentro de cada célula.
    cena.render.film_transparent = True
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGBA"
    cena.render.resolution_x = round(COLUNAS_MINI * CELULA_PX * ASPECTO_MINI)
    cena.render.resolution_y = linhas * CELULA_PX
    cena.render.filepath = os.path.join(SAIDA, "folha.png")
    bpy.ops.render.render(write_still=True)

    kb = round(os.path.getsize(cena.render.filepath) / 1024)
    print(
        f"[miniaturas] {len(ids)} em {COLUNAS_MINI}x{linhas}, {kb} KB"
        f" -> {cena.render.filepath}",
        flush=True,
    )


# ------------------------------------------------------------------- MAIN


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

    if "--folha" in argv:
        folha_contato(list(RECEITAS))
        return

    if "--miniaturas" in argv:
        folha_miniaturas(ordem_do_catalogo())
        return

    pedidos = argv or list(RECEITAS)
    desconhecidos = [i for i in pedidos if i not in RECEITAS]
    if desconhecidos:
        raise SystemExit(f"sem receita para: {', '.join(desconhecidos)}")

    relatorio = [montar(i, RECEITAS[i]) for i in pedidos]
    print("RELATORIO " + json.dumps(relatorio), flush=True)


main()
