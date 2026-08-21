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

import collections
import json
import math
import os
import re
import sys
import tempfile

import addon_utils
import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

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
# base       — (sexo, personagem) de onde vem o corpo inteiro
# pecas      — troca por peça: "Head" | "Body" | "Legs" | "Feet" -> (sexo, personagem)
# cores      — nome do material dentro do pack -> hex
# acabamento — material -> preset de `MATERIAL_PRESETS`, só onde o padrão erra
# pose       — nome da animação do próprio pack; o frame é onde ela congela
#
# Regra de cor, e ela é dura: UMA dominante dessaturada mais UMA de acento
# saturada. Duas saturadas competindo lêem como fantasia de festa, e três cores
# iguais em peças vizinhas apagam a silhueta — foi o que aconteceu com o tenista
# todo branco.

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
        "rosto": "concentrado",
        "aderecos": [
            # A bola À FRENTE do pé, não em cima dele: o encaixe é o tornozelo,
            # e uma esfera de 11,5 cm de raio a 24 cm da frente do tornozelo
            # ainda pega a chuteira inteira. É chute, então ela sai na direção
            # do pé.
            {"peca": "bola-futebol", "onde": "pe.R", "pos": (0, 0.02, 0.38)},
        ],
        "pecas": {"Legs": ("h", "Beach")},
        # Quadro 4 e não 12: no 12 o pé de chute aponta para a câmera e a perna
        # inteira colapsa em encurtamento — vira uma sola de tênis flutuando na
        # frente do peito. No 4 o peso já está numa perna só e a outra vem de
        # trás, então a silhueta lê como jogada mesmo em 64px.
        "pose": ("Kick_Right", 4),
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
        "rosto": "bravo",
        # `Wave` levanta a mão ESQUERDA — medido, não suposto. A bandeira vai
        # nela; o cachecol fica no pescoço e é o que separa este corpo casual do
        # corpo casual do boleiro em 64px.
        "aderecos": [
            # +0.09 e não +0.30: o osso do peito fica em z≈1.23 e o pescoço em
            # ≈1.32 (medido com ZAFE_ENCAIXES). Trinta centímetros acima do
            # peito é o MEIO DA CARA — a gola enlaçava a cabeça e as pontas
            # desciam por cima do nariz.
            {"peca": "cachecol", "onde": "peito", "pos": (0, 0.09, 0.02),
             "cor": "#C8102E", "cor2": "#F5F5F5"},
            # Na mão BAIXA. Na mão erguida do `Wave` o mastro cortava o rosto
            # dele na diagonal e o pano tapava metade da cabeça — e o topo
            # passava de 2,2 m, fora da régua do cast.
            # 122° e não 58°: inclinada para o mesmo lado do corpo, a bandeira
            # subia rente ao rosto e o pano cobria meia cabeça. Girar para o
            # outro lado não é trocar o sinal (isso deita o mastro no chão) — é
            # passar do ângulo agudo para o obtuso, que joga o pano para FORA
            # da silhueta.
            {"peca": "bandeira", "onde": "mao.R", "aprumar": True,
             "giro": (0, 0, 122), "pos": (-0.03, 0, 0.06),
             "cor": "#C8102E", "cor2": "#F5F5F5"},
        ],
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
        "rosto": "concentrado",
        # `Interact` estende a mão DIREITA à frente do peito: é exatamente o
        # gesto de quem segura uma prancheta e confere a tabela.
        "aderecos": [
            # Descida até a altura do peito e um pouco maior: colada na mão
            # crua ela ficava rente ao queixo e, do tamanho original, lia como
            # celular — não como a prancheta que define o personagem.
            {"peca": "prancheta", "onde": "mao.R", "aprumar": True,
            #
            # 25° e não 70°: a prancheta é uma placa fina de face voltada para a
            # frente, e deitá-la 70° entrega ao card exatamente a espessura de
            # 12 mm. Inclinada de leve ela mostra o papel, que é o que se
            # reconhece.
             "pos": (0, -0.05, 0.07), "giro": (25, 0, 0), "escala": 1.2},
        ],
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
        "rosto": "alegre",
        "aderecos": [
            {"peca": "boina", "onde": "cabeca", "cor": "#4A4038"},
            {"peca": "radinho", "onde": "mao.R", "aprumar": True,
             "pos": (0, 0.02, 0.04)},
        ],
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
        "rosto": "cansado",
        "aderecos": [
            {"peca": "faixa-cabeca", "onde": "cabeca", "cor": "#D7F205"},
            # O `peito` nasce na COLUNA, não na superfície do peito: sem empurrar
            # em +Z o número fica dentro do tórax e não aparece em lugar nenhum.
            {"peca": "numero-peito", "onde": "peito", "pos": (0, 0.09, 0.13),
             "cor": "#F5F5F2", "tinta_cor": "#1B1B1B"},
        ],
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
        "rosto": "concentrado",
        "pecas": {"Legs": ("h", "Beach")},
        # As duas luvas: uma luva só lê como mão enfaixada.
        #
        # Azul, e não o dourado do uniforme: com o MESMO hex da camisa a luva
        # sumia — de longe as mãos viravam continuação da manga e sobrava um
        # goleiro sem luva nenhuma. Luva de goleiro é peça de contraste na vida
        # real pelo mesmo motivo.
        "aderecos": [
            {"peca": "luva-goleiro", "onde": "mao.L", "cor": "#1F6FEB"},
            {"peca": "luva-goleiro", "onde": "mao.R", "cor": "#1F6FEB"},
        ],
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
        "rosto": "alegre",
        # A bandeja pendurada no pescoço é o personagem inteiro: sem ela o
        # Worker é um operário, com ela é o cara que sobe a arquibancada.
        "aderecos": [
            # +0.12 em Z: a bandeja é desenhada a 10 cm do osso do peito, e a
            # camisa está a ~12 — o caixote ficava enfiado na barriga com a
            # pipoca dentro do tronco. Empurrada para fora ela passa a ser uma
            # bandeja pendurada, que é o personagem.
            {"peca": "bandeja-pipoca", "onde": "peito", "pos": (0, 0.12, 0.12)},
        ],
        "pose": ("Walk", 10),
        "cores": {
            "Skin": PELE[2],
            "Worker_Vest": "#C8102E",
            "Worker_Yellow": "#F5F0E6",
        },
    },
    "av-menina-volei": {
        "base": ("m", "Casual"),
        "rosto": "concentrado",
        "aderecos": [
            {"peca": "bola-volei", "onde": "mao.L", "pos": (0, 0.10, 0),
             "cor": "#F7F7F2", "cor2": "#1F6FEB"},
        ],
        # `Punch_Left` deixava os dois punhos fechados na altura do queixo:
        # guarda de boxe, dentro do contorno do tronco, ilegível em miniatura e
        # do esporte errado. `Wave` no 10 tem o braço estendido para cima com a
        # mão aberta — o gesto mais próximo de uma cortada que os packs têm.
        "pose": ("Wave", 10),
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
        "rosto": "confiante",
        # O shape em pé, apoiado no rabo ao lado do pé, e não deitado embaixo
        # dele: `assentar` desce o conjunto até o ponto mais baixo, então um
        # deck no chão faria o boneco afundar meio centímetro nele.
        # −0.26 e não +0.17: o X do referencial do pé é `cima × frente`, e com o
        # personagem olhando para −Y isso dá o +X do MUNDO — que é a ESQUERDA
        # dele. O `pe.R` fica em x≈−0.11, então mandar o shape 17 cm para +X era
        # mandá-lo para dentro da outra perna, e era isso que aparecia no render:
        # o deck cortando a canela. Fora do pé direito é −X.
        "aderecos": [
            {"peca": "skate", "onde": "pe.R", "pos": (-0.26, 0, 0.02),
             "giro": (0, 0, 14), "deck": "#2E9E8F", "roda": "#F0B429"},
        ],
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
        "aderecos": [
            {"peca": "mochila-entrega", "onde": "costas", "pos": (0, 0.10, 0.06),
             "escala": 0.85, "cor": "#1F6FEB"},
        ],
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
        "aderecos": [
            {"peca": "vassoura", "onde": "mao.R", "aprumar": True,
             "giro": (0, 0, 64)},
        ],
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
        "rosto": "surpreso",
        "aderecos": [
            {"peca": "celular", "onde": "mao.R", "aprumar": True,
             "pos": (0, 0.02, 0.03), "giro": (60, 0, 0), "tela": "#F2B8D0"},
        ],
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
        "rosto": "concentrado",
        "pecas": {"Legs": ("h", "Beach")},
        # A raquete é desenhada em linha com o eixo do punho, então o arco do
        # `Sword_Slash` a carrega junto sem giro nenhum.
        "aderecos": [
            {"peca": "raquete", "onde": "mao.R", "aro": "#D7F205"},
        ],
        # Sword_Slash é o arco de raquete que o pack não tem: o braço cruza o
        # corpo no mesmo caminho de um forehand. Quadro 8, o alto do arco — no
        # 14 o golpe já desceu e os dois braços voltaram para junto do tronco,
        # que é o mesmo contorno de alguém parado.
        "pose": ("Sword_Slash", 8),
        # Camisa, tênis e sola eram os três #FFFFFF, e o resultado era um borrão
        # branco do ombro ao chão com o calção de acento sozinho lá no meio. Duas
        # correções: branco quebrado em vez de puro (o #FFFFFF estoura no ACES e
        # perde a forma da dobra) e a MESMA lima do calção na sola, que devolve o
        # pé ao contorno sem inventar uma segunda cor saturada.
        "cores": {
            "Skin": PELE[0],
            "Red_Dark": "#F5F5F2",
            "LightBrown": "#F2F2EF",
            "White": "#D7F205",
            "LightBlue": "#D7F205",
            "Hair": CABELO[2],
        },
    },
    "av-surfista-fim-tarde": {
        "base": ("h", "Beach"),
        "rosto": "alegre",
        "aderecos": [
            # Mesmo sinal invertido do skatista, do outro lado: +X é a esquerda
            # do personagem, então a prancha do `pe.L` sai em +X. Com −0.22 ela
            # entrava pela perna direita, e é o que se via — a prancha rasgando
            # o corpo em vez de estar de pé ao lado dele.
            {"peca": "prancha-surfe", "onde": "pe.L", "pos": (0.40, 0, 0.02),
             "giro": (0, 0, -9), "cor": "#F5E6C8", "faixa": "#0E9AA7"},
        ],
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
        "aderecos": [
            {"peca": "touca", "onde": "cabeca", "cor": "#12305C"},
            {"peca": "oculos-natacao", "onde": "cabeca", "cor": "#7FD8FF",
             "aro": "#12305C"},
        ],
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
        "rosto": "bravo",
        "aderecos": [
            {"peca": "luva-boxe", "onde": "mao.L", "cor": "#8E1B1B"},
            {"peca": "luva-boxe", "onde": "mao.R", "cor": "#8E1B1B"},
        ],
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
        "rosto": "confiante",
        # `Idle_Sword` já deixa a mão fechada na altura da cintura, empunhando
        # nada. O taco é o que aquela mão estava esperando.
        "aderecos": [
            # 48° e não 74°: a 74 o taco fica quase de pé e some — de frente ele
            # é um traço de 1,7 cm subindo pela vertical, colado na silhueta e
            # passando por cima da cabeça. Deitado para 48 ele cruza o corpo na
            # diagonal, que é a única inclinação em que uma vara fina ainda tem
            # comprimento visível em 64 px. O `pos` tira a ponta grossa do
            # quadril.
            {"peca": "taco", "onde": "mao.R", "aprumar": True,
             "giro": (0, 0, 48), "pos": (-0.02, -0.06, 0.14)},
        ],
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
        "rosto": "bravo",
        "aderecos": [
            # Anilha vermelha: o preto original ficava contra o rosto moreno e
            # o fundo escuro da cena e o halter virava um borrão sem forma.
            # Aprumado: a barra é desenhada ao longo do X local, e no referencial
            # cru do punho esse X é a direção do ANTEBRAÇO. Com o `Punch_Right`
            # estendido para a frente, a barra saía pelo eixo do braço e o disco
            # de trás atravessava o rosto — de frente via-se uma anilha vermelha
            # colada na cara. Aprumada, ela fica na horizontal do MUNDO, que é a
            # única orientação em que um halter lê como halter em 64 px: as duas
            # anilhas visíveis, uma de cada lado do punho.
            # O `pos` para a frente é o que a mantém fora do tronco, e a escala
            # 1,15 saiu: com a barra atravessada, 48 cm de halter na mão de um
            # boneco chibi viravam uma barra olímpica.
            {"peca": "halter", "onde": "mao.R", "aprumar": True,
             "pos": (0, -0.02, 0.02), "disco": "#C8102E"},
        ],
        # `HitRecieve` é a animação de LEVAR um golpe: o corpo recua encolhido e
        # o personagem lê como quem apanhou, não como quem treina — e encolhido
        # ele ainda era o mais baixo do cast (1,75 m contra 1,85 de régua).
        # `Punch_Right` no 6 abre o braço para fora do tronco com o peso numa
        # perna, que é a silhueta que se quer.
        "pose": ("Punch_Right", 6),
        "cores": {
            "Skin": PELE[3],
            "Red_Dark": "#1B1B1B",
            "White": "#B8860B",
            "Hair": CABELO[0],
        },
    },
    "av-dj-torcida": {
        "base": ("h", "Punk"),
        "rosto": "alegre",
        "aderecos": [
            # `coroar` mira o alto do CRÂNIO, e o crânio deste aqui termina na
            # ponta do moicano: sem descer, o fone paira 20 cm acima do cabelo.
            {"peca": "fone-ouvido", "onde": "cabeca", "pos": (0, -0.26, 0),
             "cor": "#161616", "almofada": "#D7F205"},
        ],
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
        "rosto": "surpreso",
        "aderecos": [
            {"peca": "microfone", "onde": "mao.R", "aprumar": True,
             "giro": (0, 0, 68), "marca": "#C8102E"},
        ],
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
        "rosto": "bravo",
        "pecas": {"Legs": ("h", "Beach")},
        # Wave levanta o braço esquerdo acima da cabeça: agora com o cartão.
        "aderecos": [
            {"peca": "cartao", "onde": "mao.L", "aprumar": True,
             "pos": (0, 0.05, 0), "cor": "#C8102E"},
            # Sem subir nada: a peça já é desenhada com a alça indo até o
            # pescoço (+0.16) e o apito caído no peito. Empurrada mais 0.18 para
            # cima ela laçava o queixo. O +Z é só para o cordão sair da camisa.
            # `afastar` liga aqui e em quase nenhum outro lugar: o que sobra
            # depois de encolher a alça é o laço tocando o ombro esquerdo, três
            # vértices a 1,6 cm, porque o `Wave` levanta esse braço e inclina o
            # tronco. Um empurrão de milímetros para a frente resolve sem que
            # nada mude de lugar aos olhos.
            {"peca": "apito", "onde": "peito", "pos": (0, -0.01, 0.03),
             "afastar": True},
        ],
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
        # Orelhas e rabo são o que faz o macacão laranja virar fantasia. Sem
        # eles é só um astronauta pintado de laranja.
        "aderecos": [
            {"peca": "orelhas-tigre", "onde": "cabeca", "cor": "#F07818",
             "dentro": "#F5E0C0"},
            # A cauda é desenhada para a FRENTE (+Z); a meia-volta em Y é o que
            # a joga para trás do quadril, onde uma cauda fica.
            {"peca": "cauda", "onde": "quadril", "pos": (0, 0.16, -0.10),
             "giro": (0, 180, 0), "cor": "#F07818", "listra": "#1B1B1B"},
        ],
        "pose": ("Wave", 14),
        # `SciFi_MainDark` cobre metade do traje, não é detalhe: em preto o
        # mascote saía cinza-escuro com três riscos laranja e ninguém enxergava
        # o tigre. O preto foi para os acentos, onde listra de tigre mora.
        "cores": {
            "SciFi_Main": "#F07818",
            "SciFi_MainDark": "#C2560F",
            "SciFi_Light": "#F5E0C0",
            "SciFi_Light_Accent": "#1B1B1B",
            "Grey": "#1B1B1B",
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
        "aderecos": [
            {"peca": "capacete-integral", "onde": "cabeca", "cor": "#C8102E",
             "faixa": "#F2F2F2"},
        ],
        "pose": ("Walk", 8),
        "cores": {
            "SciFi_Main": "#C8102E",
            "SciFi_MainDark": "#7A0A1C",
            "SciFi_Light": "#F2F2F2",
            "SciFi_Light_Accent": "#F0B429",
        },
        # Macacão de piloto é tecido técnico, não camiseta: com a rugosidade de
        # pano ele lê como pijama vermelho.
        "acabamento": {"SciFi_Main": "couro", "SciFi_MainDark": "couro"},
    },
    "av-xadrezista-sombrio": {
        "base": ("h", "Suit"),
        "rosto": "confiante",
        "aderecos": [
            # A peça é desenhada da base para CIMA (0 a 0,26) e o encaixe da mão
            # é o punho, que no `Idle_Neutral` fica na altura do quadril: presa
            # ali e aprumada, ela crescia 26 cm para dentro do tronco e o topo
            # aparecia saindo do peito — o defeito que o dono descreveu primeiro.
            # −0,14 em Y centra a peça na mão em vez de empilhá-la sobre ela, e o
            # Z manda para a FRENTE da coxa, não para dentro dela.
            {"peca": "peca-xadrez", "onde": "mao.R", "aprumar": True,
             "pos": (-0.03, -0.14, 0.10), "cor": "#D8D8D8"},
        ],
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
        "rosto": "confiante",
        # A pistola sai em `limpar_aderecos`, e `Idle_Gun_Pointing` sem pistola
        # é uma mulher apontando o dedo para o nada, com os dois braços à frente
        # do peito. `Idle_Neutral` é parada e ereta — menos interessante, mas
        # uma capitã de pé é uma leitura; apontar para o vazio não é nenhuma.
        # O quepe é o que transforma o terno azul-marinho em farda.
        "aderecos": [
            {"peca": "quepe", "onde": "cabeca", "cor": "#16233F",
             "aba": "#0C1526", "brasao": "#D4AF37"},
        ],
        "pose": ("Idle_Neutral", 1),
        "cores": {
            "Skin": PELE[1],
            "Black": "#16233F",
            "White": "#F5F5F5",
            "Hair_Brown": CABELO[0],
        },
    },
    "av-ginasta-fita": {
        "base": ("m", "SciFi"),
        "rosto": "alegre",
        "aderecos": [
            {"peca": "fita", "onde": "mao.R", "cor": "#D6266B",
             "bastao": "#F0B429"},
        ],
        # Quadro 16: braço estendido na horizontal e perna levantada, os dois
        # fora do contorno do tronco. É a única pose do cast que lembra ginástica
        # — no 12 o chute ainda está subindo e ela parece só desequilibrada.
        "pose": ("Kick_Left", 16),
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
        "aderecos": [
            # Empunhada como o punho fechado do `Idle_Sword` pede, a lâmina sai
            # para trás e some — preta sobre preto, atrás do corpo. Aprumada e
            # inclinada ela cruza a silhueta, que é o único jeito de a katana
            # existir num personagem todo preto.
            # O giro em X é o que faz a katana existir: a lâmina é uma fita
            # plana, e sem ele o plano da fita fica deitado — de frente vê-se só
            # a espessura, um fio de 3 mm. Deitada em pé ela mostra a largura.
            # O `pos` só empurra a lâmina para a FRENTE do corpo. A câmera da
            # loja olha de frente, então a diagonal que o dono aprovou é
            # exatamente a mesma; o que muda é que ela passa na frente do quadril
            # em vez de atravessá-lo.
            {"peca": "katana", "onde": "mao.R", "aprumar": True,
             "giro": (90, 0, 50), "escala": 1.15, "pos": (0, 0, 0.12),
             "lamina": "#DCE3EA", "guarda": "#4A0F14"},
        ],
        "pose": ("Idle_Sword", 1),
        "cores": {
            "Skin": PELE[1],
            "Swat": "#14171C",
            "Swat_Black": "#0A0C10",
            "Visor": "#2A2F38",
            "Grey": "#4A0F14",
            "Black": "#0A0C10",
        },
        # Preto sobre preto sobre preto: sem um acabamento que reflita, a
        # silhueta inteira vira um recorte chapado e as peças somem umas nas
        # outras. O couro é o que separa colete de manga aqui.
        "acabamento": {"Swat": "couro", "Swat_Black": "couro"},
    },
    "av-bruxa-sorte": {
        "base": ("m", "Witch"),
        "rosto": "confiante",
        # Aprumado e girado 90° em Z: o cabo é desenhado ao longo do +X, e o
        # giro o põe na vertical, plantado ao lado dela como um cajado.
        "aderecos": [
            {"peca": "cajado", "onde": "mao.L", "aprumar": True,
             "giro": (0, 0, 90), "pos": (0, -0.28, 0), "orbe": "#D4AF37",
             "enfeite": "#5B2D8E"},
        ],
        "pose": ("Interact", 20),
        "cores": {"Skin": PELE[0], "Purple": "#5B2D8E", "Gold": "#D4AF37"},
    },
    "av-astronauta-perdido": {
        "base": ("h", "Spacesuit"),
        "aderecos": [
            {"peca": "capacete-domo", "onde": "cabeca", "cor": "#BFD8E8",
             "aro": "#D4AF37"},
        ],
        "pose": ("Idle", 1),
        "cores": {
            "SciFi_Main": "#E8EAF0",
            "SciFi_MainDark": "#B9BFCC",
            # Não #FFFFFF: no ACES o branco puro satura e o traje perde a dobra.
            "SciFi_Light": "#F7F8FB",
            "SciFi_Light_Accent": "#D4AF37",
        },
    },
    # --------------------------------------------------------------- lendário
    "av-rei-bolao": {
        "base": ("h", "King"),
        "rosto": "confiante",
        "aderecos": [
            # Maior que o desenho base: o rei já tem ombreira e coroa douradas,
            # e um troféu no tamanho natural some dentro do próprio dourado dele.
            # Mesmo problema da peça de xadrez, pior porque a escala 1,3 faz o
            # troféu ter 36 cm: crescendo do punho para cima ele terminava dentro
            # da barriga. Centrado na mão e à frente da coxa, o rei passa a
            # SEGURAR o troféu em vez de tê-lo cravado no corpo.
            {"peca": "trofeu", "onde": "mao.L", "aprumar": True,
             "pos": (0.02, -0.05, 0.05), "escala": 1.3, "ouro": "#D4AF37"},
        ],
        # `Wave` (mão esquerda erguida) e não `Idle_Neutral`. Tirar o troféu de
        # dentro da barriga resolvia o furo e criava outro problema: no braço
        # caído do `Idle_Neutral` ele ficava pendurado na altura do quadril e lia
        # como balde, não como taça. Este é o personagem mais caro do cast — a
        # pose tem de ser a de quem levantou o troféu.
        "pose": ("Wave", 14),
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


# ----------------------------------------------------- ACABAMENTO DE MATERIAL
#
# O pack exporta os onze materiais do personagem com a MESMA rugosidade. Cor
# chapada já é pouca informação; quando pele, jeans e tênis também refletem
# igual, o olho conclui que tudo ali é feito da mesma peça de plástico — que é
# metade da sensação de brinquedo barato. Rugosidade por peça é a diferença
# entre "boneco pintado" e "figura de jogo", e não custa um byte de textura.
#
# SOBREVIVE À FUSÃO DOS MATERIAIS
#
# `comprimir-avatares.mjs` funde os onze materiais num só para o personagem
# custar UMA chamada de desenho. Isso não conflita com variar rugosidade: o
# `palette` do gltf-transform assa metálico e rugosidade num atlas próprio,
# amostrado em NEAREST, exatamente como faz com a cor base — desde que existam
# pelo menos cinco pares (metálico, rugosidade) distintos no arquivo. Abaixo
# disso ele desiste do atlas, e aí a rugosidade volta a ser propriedade de
# material: os materiais deixam de ser iguais, não fundem, e o personagem passa
# a custar uma chamada por acabamento. É o único preço a vigiar aqui.
#
# `envMapIntensity` DO DOCUMENTO NÃO ENTRA
#
# Não é propriedade de glTF, é de material do three, e depois da fusão existe um
# material só — não há onde variar por peça. O valor equivalente já existe e é
# de cena: `environmentIntensity` em `components/figura3d/luzes.tsx`.

# (rugosidade, metálico)
MATERIAL_PRESETS = {
    "pele": (0.72, 0.0),
    "cabelo": (0.62, 0.0),
    "tecido": (0.88, 0.0),
    "jeans": (0.92, 0.0),
    "couro": (0.52, 0.0),
    "calcado": (0.48, 0.0),
    "plastico": (0.35, 0.0),
    "metal": (0.28, 0.9),
}

# Os materiais do pack têm nome de COR (`Black`, `White`, `Red_Dark`), não de
# peça, então o nome só decide onde ele é inequívoco.
ACABAMENTO_POR_NOME = {
    "Skin": "pele",
    "Skin_Darker": "pele",
    "Hair": "cabelo",
    "Hair_Black": "cabelo",
    "Hair_Blond": "cabelo",
    "Hair_Brown": "cabelo",
    "Hair_White": "cabelo",
    "Eyebrows": "cabelo",
    "Moustache": "cabelo",
    "Eye": "plastico",
    "Visor": "plastico",
    "SciFi_Light": "plastico",
    "SciFi_Light_Accent": "plastico",
    "Metal": "metal",
    "Metal_Dark": "metal",
    "Gold": "metal",
    "Earrings": "metal",
}

# O resto decide pela peça em que o material vive, que é o que o nome não conta:
# um `Black` no `_Feet` é sola, o mesmo `Black` no `_Body` é jaqueta.
ACABAMENTO_POR_PARTE = {
    "Head": "tecido",
    "Body": "tecido",
    "Legs": "jeans",
    "Feet": "calcado",
}


def peca_dominante():
    """material -> peça em que ele cobre mais faces.

    Um material pode aparecer em duas peças (`Skin` está no rosto e nas mãos), e
    depois da fusão ele terá um acabamento só. Escolher pela maior área é o
    default que erra menos: o acabamento certo cobre a superfície que se vê.
    """
    contagem = collections.defaultdict(collections.Counter)
    for obj in malhas():
        peca = obj.name.split(".")[0].rpartition("_")[2]
        for poly in obj.data.polygons:
            slot = obj.material_slots[poly.material_index]
            if slot.material:
                contagem[slot.material.name][peca] += 1
    return {nome: c.most_common(1)[0][0] for nome, c in contagem.items()}


# ------------------------------------------------------------------ ROSTO
#
# "Os ok's são feios de cara" — e são os TRINTA com a mesma cara, porque o pack
# desenha um rosto só e o resto do personagem é roupa.
#
# O caminho óbvio seria um atlas de UV com expressões, que é o que se faz num
# jogo. Aqui não dá: os `.glb` saem com zero textura e zero imagem (o export usa
# `export_image_format="NONE"`), o material é cor chapada, e não há boca — o
# rosto inteiro são duas ilhas de geometria, `Eye` e `Eyebrows`, 24 faces cada.
#
# Só que geometria separada é melhor que textura para o que se quer aqui: num
# rosto chibi sem boca, a SOBRANCELHA é a expressão inteira. Inclinar 14° para
# dentro é raiva; para fora é preocupação; levantar uma só é deboche. E como as
# ilhas são disjuntas do resto da malha, mexer nelas não deforma a pele.
#
# Roda em espaço LOCAL da malha, logo depois do import: ali o rosto está em
# repouso e os eixos são inequívocos (X lateral, Y profundidade, Z altura). Feito
# depois da pose, um personagem de cabeça inclinada teria a sobrancelha girando
# fora do plano do rosto.

# (giro da sobrancelha em graus — positivo baixa a ponta de DENTRO, que é o
#  franzido —, quanto ela sobe em metros, e o achatamento do olho)
EXPRESSOES = {
    "bravo": (15.0, -0.004, 0.72),
    "concentrado": (9.0, -0.002, 0.80),
    "confiante": (-7.0, 0.004, 0.88),
    "surpreso": (-4.0, 0.010, 1.18),
    "alegre": (-9.0, 0.006, 0.66),
    "cansado": (-13.0, -0.003, 0.62),
}


def _ilha_por_material(nome_material):
    """Vértices que só aparecem em faces DESTE material, por objeto.

    O 'só' importa: se um vértice for compartilhado com a pele, mexer nele abre
    um buraco no rosto. As ilhas do olho e da sobrancelha são fechadas e
    disjuntas — a checagem é o que garante que continuem sendo.
    """
    saida = []
    for obj in malhas():
        idx = [
            i
            for i, m in enumerate(obj.data.materials)
            if m and nome_base_material(m.name) == nome_material
        ]
        if not idx:
            continue
        dentro, fora = set(), set()
        for f in obj.data.polygons:
            (dentro if f.material_index in idx else fora).update(f.vertices)
        exclusivos = dentro - fora
        if exclusivos:
            saida.append((obj, exclusivos))
    return saida


def _girar_no_plano(obj, indices, angulo, sobe):
    """Gira um punhado de vértices no plano XZ, em torno do centro deles."""
    co = [obj.data.vertices[i].co for i in indices]
    centro = sum(co, Vector()) / len(co)
    c, s = math.cos(angulo), math.sin(angulo)
    for i in indices:
        v = obj.data.vertices[i]
        d = v.co - centro
        v.co = centro + Vector((d.x * c - d.z * s, d.y, d.x * s + d.z * c + sobe))


def expressao(nome):
    if not nome:
        return
    if nome not in EXPRESSOES:
        raise SystemExit(
            f"expressão '{nome}' não existe. Há: {', '.join(sorted(EXPRESSOES))}"
        )
    giro, sobe, olho = EXPRESSOES[nome]

    for obj, verts in _ilha_por_material("Eyebrows"):
        # Uma sobrancelha de cada vez, separadas pelo lado da cara. Girar as duas
        # juntas em torno do centro comum inclinaria o par inteiro como se a
        # cabeça estivesse torta.
        for lado in (1, -1):
            metade = [
                i for i in verts if math.copysign(1, obj.data.vertices[i].co.x) == lado
            ]
            if metade:
                # O sinal é espelhado: o que baixa a ponta interna de um lado
                # levanta a do outro se o ângulo for o mesmo.
                _girar_no_plano(obj, metade, math.radians(giro) * lado, sobe)
        obj.data.update()

    if olho != 1.0:
        for obj, verts in _ilha_por_material("Eye"):
            co = [obj.data.vertices[i].co for i in verts]
            meio = sum(c.z for c in co) / len(co)
            for i in verts:
                v = obj.data.vertices[i]
                v.co.z = meio + (v.co.z - meio) * olho
            obj.data.update()


def acabar(overrides):
    pecas = peca_dominante()
    for mat in bpy.data.materials:
        base = nome_base_material(mat.name)
        preset = (
            overrides.get(base)
            or ACABAMENTO_POR_NOME.get(base)
            or ACABAMENTO_POR_PARTE.get(pecas.get(mat.name), "tecido")
        )
        rugosidade, metalico = MATERIAL_PRESETS[preset]
        # A dupla de baixo é o que o viewport sólido mostra; o exportador lê o
        # Principled. Escrever nos dois evita que a folha da loja e o app
        # discordem sobre o brilho da mesma peça.
        mat.roughness = rugosidade
        mat.metallic = metalico
        if mat.use_nodes:
            for no in mat.node_tree.nodes:
                if no.type == "BSDF_PRINCIPLED":
                    no.inputs["Roughness"].default_value = rugosidade
                    no.inputs["Metallic"].default_value = metalico


# --------------------------------------------------------------- ADEREÇOS
#
# Os packs não têm um único adereço utilizável: `Weapons/` tem pistola e espada,
# e é isso. Nada de bola, raquete, taco, microfone, vassoura, coroa ou mochila.
# Então o nome de cada personagem prometia uma coisa e o modelo mostrava outra —
# "Vendedor de Pipoca" era um pedreiro de capacete, "Skatista" era um punk de
# mãos vazias. Adereço não é enfeite aqui: é o que torna o nome verdadeiro.
#
# GEOMETRIA, NÃO ARQUIVO
#
# Cada peça abaixo é construída em bmesh, em metros, na escala final do boneco.
# Isso mantém a promessa do pipeline (um `RECEITAS` reproduzível, sem asset
# solto para versionar) e, mais concreto, deixa a peça sujeita aos MESMOS passos
# que o corpo: solda, quina por ângulo, subdivisão com crease e o bake de AO.
# Uma bola importada de fora entraria depois do AO e ficaria com a sombra de
# contato faltando exatamente onde a mão a segura.
#
# ONDE ELAS ENTRAM
#
# Depois de `congelar` e ANTES de `refinar`. Depois de congelar porque aí o
# personagem é geometria pura na pose final — o adereço é posicionado no lugar
# onde a mão de fato está, não onde o rig a deixaria em repouso. Antes de
# refinar porque é o que faz a peça atravessar suavização, subdivisão, junção e
# AO junto com o resto, e sair do outro lado como parte da malha única (o
# personagem continua custando UMA chamada de desenho).
#
# COMO SE ORIENTA UMA PEÇA NA MÃO
#
# `quadros_de_pose` mede referenciais ortonormais em mundo a partir dos ossos,
# com a pose e o chibi já aplicados. A convenção é a mesma em todos:
#
#   mao.L / mao.R  origem no meio da palma; +X é o lado do polegar (para onde
#                  aponta a cabeça de um martelo empunhado), +Y é a direção dos
#                  dedos, +Z sai do dorso. Um cabo empunhado corre em X.
#   cabeca         origem no ALTO DO CRÂNIO (medido na malha, não no osso), +Y
#                  para cima, +Z para a frente, +X para a esquerda do boneco.
#   peito/quadril  origem na base do osso, mesmos eixos da cabeça.
#   pe.L / pe.R    origem no tornozelo, +Y para cima, +Z na direção da ponta do
#                  pé, no plano do chão.
#   pes            o ponto médio entre os dois tornozelos.
#
# O eixo X do punho ESPELHA entre as mãos (o rig é simétrico), então ele é
# invertido na direita para as duas mãos significarem a mesma coisa. A inversão
# é feita antes de recalcular Z pelo produto vetorial: um referencial de
# determinante negativo viraria a normal de toda peça colocada nele, e o defeito
# aparece como uma bola preta iluminada por dentro.


def tinta(hexa, acabamento="plastico"):
    """Material de adereço, reusado por (cor, acabamento).

    Reusar importa: `palette` do gltf-transform funde materiais num atlas, e
    dois materiais idênticos com nomes diferentes são duas entradas de atlas
    para a mesma cor. Também roda DEPOIS de `acabar`, então cada peça declara o
    próprio acabamento — não há passagem posterior que o faça por ela.
    """
    nome = f"Ad_{acabamento}_{hexa.lstrip('#')}"
    mat = bpy.data.materials.get(nome)
    if mat:
        return mat
    rugosidade, metalico = MATERIAL_PRESETS[acabamento]
    rgba = hex_rgba(hexa)
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    mat.diffuse_color = rgba
    mat.roughness = rugosidade
    mat.metallic = metalico
    for no in mat.node_tree.nodes:
        if no.type == "BSDF_PRINCIPLED":
            no.inputs["Base Color"].default_value = rgba
            no.inputs["Roughness"].default_value = rugosidade
            no.inputs["Metallic"].default_value = metalico
    return mat


_EIXO = {
    # `create_cone` nasce ao longo de Z; estes giros levam Z ao eixo pedido.
    "X": Matrix.Rotation(math.radians(90), 4, "Y"),
    "Y": Matrix.Rotation(math.radians(-90), 4, "X"),
    "Z": Matrix.Identity(4),
}


def _giro(g):
    gx, gy, gz = g
    return (
        Matrix.Rotation(math.radians(gz), 4, "Z")
        @ Matrix.Rotation(math.radians(gy), 4, "Y")
        @ Matrix.Rotation(math.radians(gx), 4, "X")
    )


class Peca:
    """Acumula geometria de um adereço, agrupada por material.

    Um objeto por material (o Blender só junta malhas de material único sem
    embaralhar índice de face), todos com matriz identidade: quem posiciona é
    `aplicar_aderecos`, aplicando o referencial do osso de uma vez só.
    """

    def __init__(self, nome):
        self.nome = nome
        self.partes = {}

    def _bm(self, mat):
        if mat.name not in self.partes:
            self.partes[mat.name] = (mat, bmesh.new())
        return self.partes[mat.name][1]

    @staticmethod
    def _base(em, giro, mira, escala):
        M = Matrix.Translation(Vector(em))
        if mira is not None:
            M = M @ Vector((0, 0, 1)).rotation_difference(
                Vector(mira).normalized()
            ).to_matrix().to_4x4()
        if giro is not None:
            M = M @ _giro(giro)
        if escala is not None:
            M = M @ Matrix.Diagonal(Vector(escala).to_4d())
        return M

    def caixa(self, cor, tam, em=(0, 0, 0), giro=None, acab="plastico"):
        bmesh.ops.create_cube(
            self._bm(tinta(cor, acab)),
            size=1.0,
            matrix=self._base(em, giro, None, tam),
        )
        return self

    def cilindro(
        self,
        cor,
        raio,
        alt,
        em=(0, 0, 0),
        eixo="Z",
        raio2=None,
        segs=16,
        giro=None,
        mira=None,
        escala=None,
        acab="plastico",
    ):
        bmesh.ops.create_cone(
            self._bm(tinta(cor, acab)),
            cap_ends=True,
            cap_tris=False,
            segments=segs,
            radius1=raio,
            radius2=raio if raio2 is None else raio2,
            depth=alt,
            matrix=self._base(em, giro, mira, escala) @ _EIXO[eixo],
        )
        return self

    def esfera(
        self,
        cor,
        raio,
        em=(0, 0, 0),
        segs=16,
        aneis=10,
        escala=None,
        giro=None,
        mira=None,
        acab="plastico",
    ):
        bmesh.ops.create_uvsphere(
            self._bm(tinta(cor, acab)),
            u_segments=segs,
            v_segments=aneis,
            radius=raio,
            matrix=self._base(em, giro, mira, escala),
        )
        return self

    def anel(
        self,
        cor,
        raio,
        tubo,
        em=(0, 0, 0),
        giro=None,
        segs=20,
        lados=8,
        arco=1.0,
        escala=None,
        acab="plastico",
    ):
        """Toro no plano XY. `arco<1` faz um arco aberto (arco de fone, alça)."""
        bm = self._bm(tinta(cor, acab))
        M = self._base(em, giro, None, escala)
        fechado = arco >= 1.0
        n = max(3, round(segs * arco))
        aros = []
        for i in range(n if fechado else n + 1):
            a = 2 * math.pi * arco * i / n
            radial = Vector((math.cos(a), math.sin(a), 0))
            centro = radial * raio
            aros.append(
                [
                    bm.verts.new(
                        M
                        @ (
                            centro
                            + radial * (math.cos(2 * math.pi * j / lados) * tubo)
                            + Vector((0, 0, math.sin(2 * math.pi * j / lados) * tubo))
                        )
                    )
                    for j in range(lados)
                ]
            )
        for i in range(len(aros) if fechado else len(aros) - 1):
            a, b = aros[i], aros[(i + 1) % len(aros)]
            for j in range(lados):
                k = (j + 1) % lados
                bm.faces.new((a[j], b[j], b[k], a[k]))
        return self

    def superficie(self, cor, grade, espessura=0.0, acab="tecido"):
        """Casca a partir de uma grade de pontos (pano, fita, deck).

        Com `espessura` sai um sólido: a mesma grade deslocada pela normal e as
        bordas costuradas. Casca aberta funciona no render, mas o AO enxerga o
        avesso e a peça sai com uma face preta.
        """
        bm = self._bm(tinta(cor, acab))
        linhas = len(grade)
        colunas = len(grade[0])

        def normal(i, j):
            di = Vector(grade[min(i + 1, linhas - 1)][j]) - Vector(
                grade[max(i - 1, 0)][j]
            )
            dj = Vector(grade[i][min(j + 1, colunas - 1)]) - Vector(
                grade[i][max(j - 1, 0)]
            )
            n = di.cross(dj)
            return n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))

        faces = [[bm.verts.new(Vector(p)) for p in linha] for linha in grade]
        if espessura:
            verso = [
                [
                    bm.verts.new(Vector(grade[i][j]) - normal(i, j) * espessura)
                    for j in range(colunas)
                ]
                for i in range(linhas)
            ]
        for i in range(linhas - 1):
            for j in range(colunas - 1):
                bm.faces.new(
                    (faces[i][j], faces[i][j + 1], faces[i + 1][j + 1], faces[i + 1][j])
                )
                if espessura:
                    bm.faces.new(
                        (
                            verso[i][j],
                            verso[i + 1][j],
                            verso[i + 1][j + 1],
                            verso[i][j + 1],
                        )
                    )
        if espessura:
            # As quatro bordas. A ordem dos vértices não precisa ser coerente
            # entre elas: `objetos()` recalcula as normais no fim.
            for j in (0, colunas - 1):
                for i in range(linhas - 1):
                    bm.faces.new(
                        (faces[i][j], verso[i][j], verso[i + 1][j], faces[i + 1][j])
                    )
            for i in (0, linhas - 1):
                for j in range(colunas - 1):
                    bm.faces.new(
                        (faces[i][j], verso[i][j], verso[i][j + 1], faces[i][j + 1])
                    )
        return self

    def objetos(self):
        saida = []
        for n, (mat, bm) in enumerate(self.partes.values()):
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            me = bpy.data.meshes.new(f"{self.nome}_{n}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mat)
            obj = bpy.data.objects.new(f"{self.nome}_{n}", me)
            bpy.context.scene.collection.objects.link(obj)
            saida.append(obj)
        self.partes = {}
        return saida


# ------------------------------------------------------------- AS PEÇAS
#
# Cada função recebe a `Peca` e desenha em coordenadas LOCAIS do referencial em
# que vai ser presa (a convenção está no cabeçalho da seção). Toda cor é
# parâmetro: a mesma raquete serve para dois personagens em cores diferentes.


def _bola_futebol(p, cor="#F5F5F5", cor2="#1B1B1B", **_):
    p.esfera(cor, 0.115, segs=20, aneis=14, acab="couro")
    for d in (
        (0, 0, 1),
        (0, 0, -1),
        (0.86, 0, 0.5),
        (-0.86, 0, 0.5),
        (0, 0.86, -0.5),
        (0, -0.86, -0.5),
    ):
        v = Vector(d).normalized()
        p.cilindro(cor2, 0.038, 0.02, em=v * 0.108, mira=v, segs=5, acab="couro")


def _bola_volei(p, cor="#F7F7F2", cor2="#1F6FEB", **_):
    p.esfera(cor, 0.105, segs=20, aneis=14, acab="couro")
    for giro in ((0, 0, 0), (90, 0, 0), (0, 90, 0)):
        p.anel(cor2, 0.099, 0.012, giro=giro, segs=20, lados=6, acab="couro")


def _cachecol(p, cor="#C8102E", cor2="#F5F5F5", **_):
    """Gola em volta do pescoço e duas pontas caídas na frente."""
    p.anel(cor, 0.105, 0.032, escala=(1.0, 0.85, 1.0), segs=18, lados=8, acab="tecido")
    # As pontas descem pelo PEITO, que é mais grosso que o pescoço: no mesmo z do
    # anel elas ficam dentro do tórax e o cachecol vira uma gravatinha vermelha.
    for x, z in ((0.05, 0.155), (-0.05, 0.15)):
        p.caixa(cor, (0.075, 0.30, 0.022), em=(x, -0.14, z), acab="tecido")
        p.caixa(cor2, (0.075, 0.05, 0.024), em=(x, -0.27, z), acab="tecido")


def _bandeira(p, cor="#C8102E", cor2="#F5F5F5", mastro="#6B4A2F", **_):
    p.cilindro(mastro, 0.014, 0.95, eixo="X", em=(0.30, 0, 0), acab="couro")
    grade = [
        [
            (0.30 + 0.36 * (1 - i / 5), 0.02 + 0.34 * (j / 6), 0.03 * math.sin(3.0 * j / 6 * math.pi))
            for j in range(7)
        ]
        for i in range(6)
    ]
    p.superficie(cor, grade, espessura=0.008)
    faixa = [
        [
            (0.30 + 0.36 * (1 - i / 5), 0.02 + 0.34 * (j / 6), 0.003 + 0.03 * math.sin(3.0 * j / 6 * math.pi))
            for j in range(7)
        ]
        for i in (2, 3)
    ]
    p.superficie(cor2, faixa, espessura=0.004)


def _prancheta(p, cor="#4A3524", papel="#F2EFE6", clipe="#9AA3A8", **_):
    p.caixa(cor, (0.20, 0.27, 0.012), acab="couro")
    p.caixa(papel, (0.175, 0.235, 0.006), em=(0, -0.012, 0.008), acab="tecido")
    p.caixa(clipe, (0.075, 0.03, 0.016), em=(0, 0.115, 0.012), acab="metal")


def _radinho(p, cor="#3B3F46", grelha="#C9A227", **_):
    p.caixa(cor, (0.10, 0.15, 0.045), acab="plastico")
    p.cilindro(grelha, 0.032, 0.008, em=(0, 0.03, 0.025), acab="metal")
    p.cilindro(grelha, 0.014, 0.01, em=(0, -0.04, 0.025), acab="metal")
    p.cilindro("#9AA3A8", 0.005, 0.22, em=(0.04, 0.19, 0.01), eixo="Y", acab="metal")


# O crânio destes bonecos mede ~0,35 de largura por ~0,42 de profundidade (o
# nariz e o cabelo entram na conta), ou seja RAIO ~0,18 na altura das orelhas, e
# o topo fica em y=0 por construção do referencial. Peça de cabeça que ignore
# isso não erra pouco: sai um chapéu de boneca num boneco chibi.
RAIO_CRANIO = 0.18


def _boina(p, cor="#4A4038", **_):
    p.esfera(cor, RAIO_CRANIO + 0.02, em=(0, -0.10, 0.01), escala=(1.0, 0.55, 1.05), acab="tecido")
    p.esfera(cor, 0.022, em=(0, 0.01, 0), acab="tecido")


def _bone(p, cor="#1B1B1B", aba=None, **_):
    aba = aba or cor
    p.esfera(cor, RAIO_CRANIO + 0.015, em=(0, -0.12, 0), escala=(1.0, 0.85, 1.0), acab="tecido")
    p.esfera(aba, 0.145, em=(0, -0.20, 0.17), escala=(1.0, 0.08, 1.05), acab="tecido")
    p.esfera(cor, 0.024, em=(0, 0.005, 0), acab="tecido")


def _quepe(p, cor="#16233F", aba="#0C1526", brasao="#D4AF37", **_):
    p.cilindro(cor, RAIO_CRANIO + 0.005, 0.105, raio2=RAIO_CRANIO + 0.03, em=(0, -0.05, 0), eixo="Y", acab="tecido")
    p.cilindro(cor, RAIO_CRANIO + 0.032, 0.016, em=(0, 0.005, 0), eixo="Y", acab="tecido")
    p.cilindro(aba, RAIO_CRANIO + 0.01, 0.035, em=(0, -0.10, 0), eixo="Y", acab="couro")
    p.esfera(aba, 0.155, em=(0, -0.105, 0.16), escala=(1.0, 0.08, 1.0), acab="couro")
    p.caixa(brasao, (0.055, 0.04, 0.014), em=(0, -0.045, 0.185), acab="metal")


def _touca(p, cor="#12305C", **_):
    p.esfera(cor, RAIO_CRANIO + 0.012, em=(0, -0.115, 0), escala=(1.0, 0.92, 1.0), acab="plastico")


def _oculos_natacao(p, cor="#7FD8FF", aro="#12305C", **_):
    for x in (0.07, -0.07):
        p.cilindro(aro, 0.055, 0.035, em=(x, -0.22, 0.155), eixo="Z", acab="plastico")
        p.cilindro(cor, 0.04, 0.04, em=(x, -0.22, 0.165), eixo="Z", acab="plastico")
    p.anel(aro, RAIO_CRANIO + 0.01, 0.013, em=(0, -0.22, 0), giro=(90, 0, 0), escala=(1.0, 1.12, 1.0), segs=20, lados=6, acab="tecido")


def _faixa_cabeca(p, cor="#D7F205", **_):
    p.anel(cor, RAIO_CRANIO + 0.012, 0.026, em=(0, -0.19, 0), giro=(90, 0, 0), escala=(1.0, 1.14, 1.0), segs=20, lados=8, acab="tecido")


def _fone_ouvido(p, cor="#161616", almofada="#D7F205", **_):
    p.anel(cor, RAIO_CRANIO + 0.03, 0.022, em=(0, -0.05, -0.02), giro=(0, 90, 0), arco=0.5, segs=22, lados=8, acab="plastico")
    for x in (RAIO_CRANIO + 0.03, -(RAIO_CRANIO + 0.03)):
        p.cilindro(cor, 0.065, 0.05, em=(x, -0.21, -0.02), eixo="X", acab="plastico")
        p.cilindro(almofada, 0.055, 0.024, em=(x * 0.82, -0.21, -0.02), eixo="X", acab="tecido")


def _orelhas_tigre(p, cor="#F07818", dentro="#F5E0C0", **_):
    for x in (0.115, -0.115):
        p.cilindro(cor, 0.075, 0.10, raio2=0.012, em=(x, 0.02, -0.03), eixo="Y", segs=3, acab="tecido")
        p.cilindro(dentro, 0.045, 0.095, raio2=0.008, em=(x, 0.03, 0.005), eixo="Y", segs=3, acab="tecido")


def _cauda(p, cor="#F07818", listra="#1B1B1B", **_):
    passo, raio = 0.055, 0.032
    for i in range(9):
        t = i / 8
        em = (
            0.02 * math.sin(t * 3.4),
            -0.10 - passo * i * 0.85,
            0.05 + 0.42 * math.sin(t * 2.0),
        )
        p.esfera(listra if i % 2 else cor, raio * (1 - 0.55 * t), em=em, segs=10, aneis=7, acab="tecido")


def _capacete_integral(p, cor="#C8102E", faixa="#F2F2F2", visor="#1B1B1B", **_):
    p.esfera(cor, 0.165, em=(0, -0.05, -0.035), escala=(1.0, 1.02, 1.0), acab="plastico")
    p.caixa(faixa, (0.045, 0.24, 0.1), em=(0, -0.05, 0.085), acab="plastico")
    p.esfera(visor, 0.145, em=(0, -0.11, -0.035), escala=(0.92, 0.62, 0.42), acab="plastico")


def _capacete_domo(p, cor="#BFD8E8", aro="#D4AF37", **_):
    p.esfera(cor, 0.185, em=(0, -0.05, -0.055), acab="plastico")
    p.anel(aro, 0.155, 0.02, em=(0, -0.05, -0.16), segs=20, lados=8, acab="metal")
    p.caixa(aro, (0.05, 0.04, 0.05), em=(0.14, -0.05, 0.02), acab="metal")


def _numero_peito(p, cor="#F5F5F2", tinta_cor="#1B1B1B", **_):
    p.caixa(cor, (0.17, 0.13, 0.012), em=(0, -0.02, 0.11), giro=(-8, 0, 0), acab="tecido")
    p.caixa(tinta_cor, (0.035, 0.075, 0.014), em=(-0.035, -0.02, 0.116), giro=(-8, 0, 0), acab="tecido")
    p.caixa(tinta_cor, (0.035, 0.075, 0.014), em=(0.035, -0.02, 0.116), giro=(-8, 0, 0), acab="tecido")


def _apito(p, cordao="#1B1B1B", cor="#D4AF37", **_):
    # A alça a 0,10 e não 0,16 do peito: em 0,16 ela chega à altura da MANDÍBULA
    # (medido: z≈1,39 contra 1,35 do encaixe da cabeça) e o laço atravessava o
    # queixo — 31 vértices dentro do rosto. Chibi tem cabeça de 1,5× e quase
    # nenhum pescoço; a folga que existe num boneco de proporção normal aqui não
    # existe.
    p.anel(cordao, 0.082, 0.008, em=(0, 0.115, 0.01), giro=(94, 0, 0), escala=(1.0, 0.85, 1.0), segs=18, lados=6, acab="tecido")
    # z = 0,13 e 0,17, não 0,07 e 0,115: o osso `Chest` fica no CENTRO do tórax e
    # a camisa está uns 12 cm à frente dele. Desenhado a 7 cm, o cordão corria
    # por dentro do peito e do apito só sobrava uma lasca dourada aflorando na
    # camisa — o árbitro parecia ter um distintivo cravado, não um apito
    # pendurado. Cordão e apito têm de POUSAR na superfície, não morar atrás
    # dela.
    p.caixa(cordao, (0.008, 0.14, 0.008), em=(0.03, 0.08, 0.13), acab="tecido")
    p.caixa(cordao, (0.008, 0.14, 0.008), em=(-0.03, 0.08, 0.13), acab="tecido")
    p.caixa(cor, (0.028, 0.055, 0.03), em=(0, 0.015, 0.17), acab="metal")


def _avental(p, cor="#F5F0E6", faixa="#C8102E", **_):
    p.caixa(cor, (0.26, 0.34, 0.02), em=(0, -0.05, 0.13), acab="tecido")
    p.caixa(cor, (0.19, 0.16, 0.02), em=(0, -0.05, 0.33), acab="tecido")
    p.caixa(faixa, (0.27, 0.05, 0.022), em=(0, -0.052, 0.24), acab="tecido")
    for x in (0.075, -0.075):
        p.caixa(cor, (0.03, 0.02, 0.14), em=(x, -0.045, 0.44), giro=(14, 0, 0), acab="tecido")


def _mochila_entrega(p, cor="#1F6FEB", alca="#1B1B1B", **_):
    """Caixa nas costas + alças que passam pelo ombro e reaparecem no peito.

    O card da loja mostra a frente do personagem; a caixa, que fica atrás, não
    entra em quadro nenhum. Sem as alças cruzando o peito o adereço simplesmente
    não existe para quem olha o boneco — foi assim que ele saiu na primeira folha.
    """
    p.caixa(cor, (0.30, 0.26, 0.30), em=(0, 0.20, 0.18), acab="tecido")
    p.caixa(alca, (0.31, 0.035, 0.31), em=(0, 0.20, 0.18), acab="tecido")
    for x in (0.10, -0.10):
        # De cima da caixa, por cima do ombro, até a altura do peito. `em` é o
        # meio do cilindro e `mira` o alinha com o próprio comprimento.
        #
        # Na cor da MOCHILA, não na do reforço: preto sobre um tronco escuro é
        # invisível, e a alça no peito é a única parte do adereço que o card
        # chega a mostrar.
        #
        # O `b` é generoso em −Z de propósito. O referencial nasce na COLUNA:
        # parar na superfície teórica do peito deixa a alça enterrada no tronco,
        # que é o mesmo defeito do número do corredor.
        a = Vector((x, 0.34, 0.06))
        b = Vector((x, -0.08, -0.26))
        p.cilindro(
            cor, 0.030, (b - a).length,
            em=tuple((a + b) / 2), mira=tuple(b - a), segs=6, acab="tecido",
        )


def _bandeja_pipoca(p, caixa="#C8102E", listra="#F5F0E6", milho="#F0DFA8", **_):
    p.caixa(caixa, (0.34, 0.22, 0.11), em=(0, -0.21, 0.10), acab="tecido")
    for x in (-0.11, 0, 0.11):
        p.caixa(listra, (0.055, 0.225, 0.112), em=(x, -0.21, 0.10), acab="tecido")
    for i in range(11):
        a = i * 2.399
        p.esfera(
            milho,
            0.028,
            em=(0.11 * math.cos(a), -0.21 + 0.055 * math.sin(a), 0.155 + 0.02 * ((i * 7) % 3)),
            segs=8,
            aneis=6,
            acab="tecido",
        )
    for x in (0.13, -0.13):
        p.caixa("#3B3F46", (0.025, 0.02, 0.42), em=(x, -0.14, 0.30), giro=(-16, 0, 0), acab="tecido")


def _skate(p, deck="#2E9E8F", lixa="#1B1B1B", roda="#F0B429", eixo="#9AA3A8", **_):
    """Prancha em pé, apoiada pelo rabo. Local: origem no chão, Y para cima."""
    comp = 0.62
    grade = [
        [
            (-0.085 + 0.17 * j / 3, comp * i / 7, 0.028 * math.sin(math.pi * (i / 7) ** 1.4))
            for j in range(4)
        ]
        for i in range(8)
    ]
    p.superficie(deck, grade, espessura=0.016, acab="couro")
    p.superficie(lixa, [[(x, y + 0.004, z) for x, y, z in linha] for linha in grade], espessura=0.004, acab="tecido")
    for y, z in ((0.13, 0.021), (0.49, 0.021)):
        p.cilindro(eixo, 0.012, 0.15, em=(0, y, z + 0.03), eixo="X", acab="metal")
        for x in (0.075, -0.075):
            p.cilindro(roda, 0.028, 0.022, em=(x, y, z + 0.03), eixo="X", acab="plastico")


def _prancha_surfe(p, cor="#F5E6C8", faixa="#0E9AA7", quilha="#1B1B1B", **_):
    alt = 1.05
    linhas = []
    for i in range(9):
        t = i / 8
        larg = 0.135 * math.sin(math.pi * min(1.0, 0.08 + t * 0.94)) ** 0.55
        linhas.append([(-larg + 2 * larg * j / 4, alt * t, 0.0) for j in range(5)])
    p.superficie(cor, linhas, espessura=0.045, acab="plastico")
    p.superficie(
        faixa,
        [[(x * 0.28, y, z + 0.004) for x, y, z in linha] for linha in linhas],
        espessura=0.006,
        acab="plastico",
    )
    p.caixa(quilha, (0.014, 0.10, 0.07), em=(0, 0.09, -0.06), giro=(0, 0, 0), acab="plastico")


def _vassoura(p, cabo="#8A5A2B", cerda="#C9A227", aro="#9AA3A8", **_):
    # A origem fica junto do TOPO do cabo, não no meio dele: vassoura se pega em
    # cima. Com a origem no meio, a mão segurava a altura das cerdas e um metro
    # de cabo saía por cima da cabeça — que foi o que apareceu na primeira folha.
    p.cilindro(cabo, 0.017, 0.92, em=(-0.25, 0, 0), eixo="X", acab="couro")
    p.cilindro(aro, 0.024, 0.05, em=(-0.69, 0, 0), eixo="X", acab="metal")
    for i in range(6):
        p.caixa(cerda, (0.03, 0.20, 0.06), em=(-0.74 - 0.032 * i, 0, 0), acab="tecido")


def _celular(p, cor="#1B1B1B", tela="#7FD8FF", **_):
    p.caixa(cor, (0.075, 0.145, 0.014), acab="plastico")
    p.caixa(tela, (0.062, 0.125, 0.016), em=(0, 0, 0.002), acab="plastico")


def _cartao(p, cor="#C8102E", **_):
    p.caixa(cor, (0.085, 0.12, 0.008), em=(0.10, 0.02, 0), acab="plastico")


def _microfone(p, cor="#2B2F36", cabeca="#9AA3A8", marca="#C8102E", **_):
    p.cilindro(cor, 0.022, 0.20, em=(0.06, 0, 0), eixo="X", acab="plastico")
    p.esfera(cabeca, 0.045, em=(0.185, 0, 0), acab="metal")
    p.caixa(marca, (0.05, 0.05, 0.05), em=(0.06, 0, 0.005), acab="plastico")


def _raquete(p, aro="#D7F205", corda="#F2F2EF", cabo="#1B1B1B", **_):
    # A cabeça é um anel no plano XY: ele CONTÉM o eixo do cabo (X), que é o que
    # faz a raquete ficar em linha com a mão e não atravessada nela.
    p.cilindro(cabo, 0.022, 0.17, em=(0.075, 0, 0), eixo="X", acab="couro")
    for y in (0.055, -0.055):
        p.cilindro(aro, 0.011, 0.14, em=(0.235, y * 0.6, 0), eixo="X", acab="plastico")
    p.anel(aro, 0.145, 0.014, em=(0.40, 0, 0), escala=(1.0, 0.78, 1.0), segs=22, lados=6, acab="plastico")
    for k in range(-3, 4):
        p.caixa(corda, (0.27, 0.005, 0.004), em=(0.40, k * 0.030, 0), acab="tecido")
        p.caixa(corda, (0.005, 0.21, 0.004), em=(0.40 + k * 0.036, 0, 0), acab="tecido")


def _taco(p, madeira="#C9A227", ponta="#F2EFE6", coice="#1B1B1B", **_):
    p.cilindro(madeira, 0.016, 1.30, raio2=0.009, em=(0.35, 0, 0), eixo="X", acab="couro")
    p.cilindro(coice, 0.017, 0.24, em=(-0.19, 0, 0), eixo="X", acab="couro")
    p.cilindro(ponta, 0.009, 0.02, em=(1.005, 0, 0), eixo="X", acab="plastico")


def _halter(p, barra="#9AA3A8", disco="#1B1B1B", **_):
    p.cilindro(barra, 0.018, 0.42, em=(0, 0, 0), eixo="X", acab="metal")
    for x in (0.15, -0.15):
        p.cilindro(disco, 0.095, 0.045, em=(x, 0, 0), eixo="X", acab="plastico")
        p.cilindro(disco, 0.07, 0.075, em=(x, 0, 0), eixo="X", acab="plastico")


def _luva_boxe(p, cor="#8E1B1B", punho="#EDEDED", **_):
    p.esfera(cor, 0.115, em=(0, 0.02, 0), escala=(0.92, 1.05, 1.0), acab="couro")
    p.esfera(cor, 0.062, em=(0.075, -0.02, 0.03), acab="couro")
    p.cilindro(punho, 0.082, 0.075, em=(0, -0.12, 0), eixo="Y", acab="tecido")


def _luva_goleiro(p, cor="#F0B429", palma="#1B1B1B", **_):
    p.caixa(cor, (0.10, 0.16, 0.15), em=(0, 0.02, 0), acab="tecido")
    p.caixa(palma, (0.102, 0.15, 0.03), em=(0, 0.02, -0.062), acab="couro")
    p.caixa(cor, (0.075, 0.05, 0.155), em=(0.075, -0.02, 0), acab="tecido")
    p.cilindro(palma, 0.08, 0.05, em=(0, -0.09, 0), eixo="Y", acab="tecido")


def _peca_xadrez(p, cor="#D8D8D8", **_):
    p.cilindro(cor, 0.065, 0.035, em=(0, 0.02, 0), eixo="Y", acab="plastico")
    p.cilindro(cor, 0.042, 0.14, raio2=0.05, em=(0, 0.105, 0), eixo="Y", acab="plastico")
    p.cilindro(cor, 0.062, 0.05, em=(0, 0.20, 0), eixo="Y", acab="plastico")
    for i in range(4):
        a = math.pi / 2 * i + math.pi / 4
        p.caixa(cor, (0.03, 0.05, 0.03), em=(0.042 * math.cos(a), 0.235, 0.042 * math.sin(a)), acab="plastico")


def _katana(p, lamina="#C9CED6", cabo="#14171C", guarda="#4A0F14", **_):
    p.cilindro(cabo, 0.019, 0.26, em=(0.05, 0, 0), eixo="X", segs=8, acab="couro")
    p.cilindro(guarda, 0.055, 0.014, em=(0.19, 0, 0), eixo="X", acab="metal")
    # Fita plana no plano XZ que afina para a ponta; a espessura sai em Y. O
    # fio da lâmina fica no plano da mão, que é como uma katana é empunhada.
    grade = [
        [
            (0.20 + 0.72 * (i / 8), 0.0, (0.030 - 0.024 * (i / 8) ** 2.4) * (1 - 2 * j))
            for j in range(2)
        ]
        for i in range(9)
    ]
    p.superficie(lamina, grade, espessura=0.012, acab="metal")


def _cajado(p, cabo="#4A2F1C", orbe="#D4AF37", enfeite="#5B2D8E", **_):
    # 1,45 e não 1,10: cajado é do chão até acima da cabeça. Curto, ele fica
    # todo abaixo da linha do ombro e lê como bengala.
    p.cilindro(cabo, 0.018, 1.45, em=(0.50, 0, 0), eixo="X", segs=10, acab="couro")
    p.esfera(orbe, 0.068, em=(1.29, 0, 0), acab="metal")
    p.anel(enfeite, 0.058, 0.013, em=(1.20, 0, 0), giro=(0, 90, 0), segs=16, lados=6, acab="metal")


def _trofeu(p, ouro="#D4AF37", base="#2B2118", **_):
    p.caixa(base, (0.13, 0.05, 0.13), em=(0, 0.025, 0), acab="couro")
    p.cilindro(ouro, 0.03, 0.09, em=(0, 0.095, 0), eixo="Y", acab="metal")
    # Raio de baixo 0,05 e de cima 0,085, não o contrário. Estava invertido
    # desde o começo — taça mais larga embaixo que em cima é um SINO — e ninguém
    # viu porque o troféu nascia dentro da barriga do rei. Tirar o adereço de
    # dentro do corpo é o que revela a forma dele.
    p.cilindro(ouro, 0.05, 0.14, raio2=0.085, em=(0, 0.21, 0), eixo="Y", acab="metal")
    for x in (0.105, -0.105):
        p.anel(ouro, 0.048, 0.011, em=(x, 0.22, 0), giro=(90, 0, 0), segs=16, lados=6, acab="metal")


def _fita(p, cor="#D6266B", bastao="#F0B429", **_):
    """Fita de ginástica: uma hélice que abre, presa a um bastão na mão."""
    p.cilindro(bastao, 0.011, 0.34, em=(0.16, 0, 0), eixo="X", acab="plastico")
    linhas = []
    for i in range(22):
        t = i / 21
        a = t * 5.6 * math.pi
        r = 0.10 + 0.30 * t
        centro = Vector((0.33 + 0.55 * t, math.sin(a) * r, math.cos(a) * r * 0.75))
        largura = Vector((0.0, math.cos(a), -math.sin(a) * 0.75)).normalized() * 0.028
        linhas.append([tuple(centro - largura), tuple(centro), tuple(centro + largura)])
    p.superficie(cor, linhas, espessura=0.006, acab="tecido")


ADERECOS = {
    "apito": _apito,
    "avental": _avental,
    "bandeira": _bandeira,
    "bandeja-pipoca": _bandeja_pipoca,
    "boina": _boina,
    "bola-futebol": _bola_futebol,
    "bola-volei": _bola_volei,
    "bone": _bone,
    "cachecol": _cachecol,
    "cajado": _cajado,
    "capacete-domo": _capacete_domo,
    "capacete-integral": _capacete_integral,
    "cartao": _cartao,
    "cauda": _cauda,
    "celular": _celular,
    "faixa-cabeca": _faixa_cabeca,
    "fita": _fita,
    "fone-ouvido": _fone_ouvido,
    "halter": _halter,
    "katana": _katana,
    "luva-boxe": _luva_boxe,
    "luva-goleiro": _luva_goleiro,
    "microfone": _microfone,
    "mochila-entrega": _mochila_entrega,
    "numero-peito": _numero_peito,
    "oculos-natacao": _oculos_natacao,
    "orelhas-tigre": _orelhas_tigre,
    "peca-xadrez": _peca_xadrez,
    "prancha-surfe": _prancha_surfe,
    "prancheta": _prancheta,
    "quepe": _quepe,
    "radinho": _radinho,
    "raquete": _raquete,
    "skate": _skate,
    "taco": _taco,
    "touca": _touca,
    "trofeu": _trofeu,
    "vassoura": _vassoura,
}


def quadros_de_pose(arm):
    """Referenciais ortonormais em MUNDO, um por ponto de encaixe.

    Roda ANTES de `congelar` — é a última janela em que a armadura existe — e
    DEPOIS do chibi, para o adereço ser colocado onde a mão de fato ficou.
    """

    def eixo(M, i):
        return M.col[i].to_3d().normalized()

    def quadro(origem, x, y):
        z = x.cross(y).normalized()
        y = z.cross(x).normalized()
        M = Matrix.Identity(4)
        for i, v in enumerate((x.normalized(), y, z)):
            M[0][i], M[1][i], M[2][i] = v.x, v.y, v.z
        M.translation = origem
        return M

    pw = arm.matrix_world
    ossos = arm.pose.bones
    q = {}

    for nome, chave in (("Head", "cabeca"), ("Chest", "peito"), ("Body", "quadril")):
        b = ossos.get(nome)
        if b:
            M = pw @ b.matrix
            q[chave] = quadro(pw @ b.head, eixo(M, 0), eixo(M, 1))

    for lado in ("L", "R"):
        pulso, dedo = ossos.get(f"Wrist.{lado}"), ossos.get(f"Middle1.{lado}")
        if pulso and dedo:
            M = pw @ pulso.matrix
            x = eixo(M, 0)
            q[f"mao.{lado}"] = quadro(
                (pw @ pulso.head).lerp(pw @ dedo.tail, 0.55),
                -x if lado == "R" else x,
                eixo(M, 1),
            )
        pe = ossos.get(f"Foot.{lado}")
        if pe:
            ponta = (pw @ pe.tail) - (pw @ pe.head)
            frente = Vector((ponta.x, ponta.y, 0.0))
            if frente.length < 1e-4:
                frente = Vector((0, -1, 0))
            frente.normalize()
            cima = Vector((0, 0, 1))
            q[f"pe.{lado}"] = quadro(pw @ pe.head, cima.cross(frente), cima)

    if "peito" in q:
        # `costas` é o referencial do peito girado meia-volta em torno do eixo
        # do tronco: uma peça desenhada "para a frente" (+Z) sai nas costas, sem
        # a receita ter de inverter o sinal de nada.
        q["costas"] = q["peito"] @ Matrix.Rotation(math.pi, 4, "Y")

    if "pe.L" in q and "pe.R" in q:
        meio = q["pe.L"].copy()
        meio.translation = (q["pe.L"].translation + q["pe.R"].translation) / 2
        q["pes"] = meio
    return q


def aprumar(quadro, frente):
    """Mantém a origem do encaixe, mas põe a peça DE PÉ no mundo.

    Metade dos adereços de mão (troféu, peça de xadrez, halter, bandeja) tem um
    "em cima" absoluto, e o referencial da mão não tem: com o braço caído os
    dedos apontam para o chão, e um troféu preso a esse referencial fica de
    cabeça para baixo. Aqui o eixo vertical passa a ser o do mundo e o +Z passa
    a ser a frente do CORPO — o objeto acompanha para onde o personagem olha,
    não para onde o punho girou.
    """
    horizontal = Vector((frente.x, frente.y, 0.0))
    if horizontal.length < 1e-4:
        horizontal = Vector((0, -1, 0))
    horizontal.normalize()
    cima = Vector((0, 0, 1))
    x = cima.cross(horizontal)
    M = Matrix.Identity(4)
    for i, v in enumerate((x, cima, horizontal)):
        M[0][i], M[1][i], M[2][i] = v.x, v.y, v.z
    M.translation = quadro.translation
    return M


def coroar(quadro):
    """Sobe o referencial da cabeça do osso até o ALTO DO CRÂNIO.

    O osso `Head` começa na base do pescoço, e um chapéu colocado ali fica na
    altura do queixo. Onde o crânio termina depende do personagem (moicano,
    capacete do Swat, coque) e do chibi, então é medido na malha, não estimado:
    o ponto mais alto ao longo do eixo da cabeça, dentro de um cilindro estreito
    em volta dele — largo demais e o ombro levantado do `Wave` vira o "alto da
    cabeça".

    Tem de rodar DEPOIS de `congelar` (a malha só está na pose final quando o
    modificador de armadura foi aplicado) e ANTES de `refinar`, enquanto ela
    ainda tem 6 mil vértices e não 35 mil.
    """
    origem = quadro.translation
    cima = quadro.col[1].to_3d().normalized()
    alto = 0.0
    for obj in malhas():
        mw = obj.matrix_world
        for v in obj.data.vertices:
            d = (mw @ v.co) - origem
            proj = d.dot(cima)
            # O cilindro é estreito de propósito: largo demais e o ombro
            # levantado do `Wave` vira o "alto da cabeça".
            if proj > 0 and (d - cima * proj).length < 0.22:
                alto = max(alto, proj)
    novo = quadro.copy()
    novo.translation = origem + cima * alto
    return novo


# ------------------------------------------------- ADEREÇO DENTRO DO CORPO
#
# O defeito que o dono descreveu como "tem coisa saindo do meio do corpo dele"
# não é um bug de código: é um `pos` de receita que ninguém conferiu. O encaixe
# é a ORIGEM DO OSSO — o punho, o tornozelo, a base do pescoço — e osso mora no
# centro do membro, não na superfície dele. Colocar a peça de xadrez no `mao.R`
# e mandar ficar de pé desenha a peça a partir de um ponto que já está DENTRO da
# mão, subindo até o peito: exatamente o que se vê no render.
#
# `coroar` já resolvia isso para a cabeça, medindo o alto do crânio na malha em
# vez de estimar. O que faltava era o mesmo rigor para mão, pé, peito e quadril,
# e um portão que não deixe passar. É o que está aqui:
#
#   `_dentro`   — o ponto está dentro desta casca? Paridade de cruzamentos por
#                 três raios, maioria vence. Distância-com-sinal pela normal da
#                 face mais próxima seria mais barato, mas o corpo são QUATRO
#                 cascas separadas (`Suit_Body`, `Head`, `Legs`, `Feet`) e nas
#                 costuras entre elas o sinal mente. Paridade por casca fechada,
#                 uma de cada vez, não mente.
#   `afastar`   — empurra a peça para fora até parar de furar, e é OPT-IN
#                 (`"afastar": True` na receita). Ligado por padrão ele "conserta"
#                 tudo e estraga junto: na primeira rodada tirou a katana 6,4 cm
#                 da mão do Ninja — um dos sete que o dono aprovou — e a peça de
#                 xadrez 5,6 cm, o que troca um adereço enterrado por um adereço
#                 flutuando ao lado do punho. Empurrar só resolve encosto raso;
#                 furo de 7 cm é `pos` errado, e `pos` errado se conserta na
#                 receita, com o olho na folha de contato.
#   `_furos`    — o portão. Roda nos 30 e o build imprime a contagem.

# Vértice do adereço mais fundo que isto no corpo conta como furo. É folga de
# encosto, não de tolerância: o skate atravessa a perna por 15 cm, a peça de
# xadrez entra 9 cm no tronco. 1,2 cm não esconde nenhum defeito real e absorve
# o dedo que aperta a alça.
FOLGA = 0.012

# Peças VESTIDAS: entrar no corpo é o desenho delas, não um defeito. Um capacete
# que não invade o crânio é um capacete flutuando; uma luva que não invade a mão
# é uma luva no chão. Estas ficam fora do portão.
VESTIDOS = {
    "avental",
    "boina",
    "bone",
    "cachecol",
    "capacete-domo",
    "capacete-integral",
    "cauda",
    "faixa-cabeca",
    "fita",
    "fone-ouvido",
    "luva-boxe",
    "luva-goleiro",
    "mochila-entrega",
    "numero-peito",
    "oculos-natacao",
    "orelhas-tigre",
    "quepe",
    "touca",
}

# Raio da esfera de isenção em volta do encaixe. Dentro dela o furo é a mão que
# segura, e mão que segura tem de furar mesmo — cabo de vassoura que não entra
# no punho está sendo carregado pelo ar.
ISENCAO = {"mao": 0.15, "pe": 0.17, "cabeca": 0.20}

_RAIOS = (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))


def _cascas_do_corpo():
    """Uma BVH por malha de corpo (tudo que não é adereço), em mundo."""
    saida = []
    for o in malhas():
        if o.name.startswith("Ad_"):
            continue
        mw, me = o.matrix_world, o.data
        me.calc_loop_triangles()
        verts = [tuple(mw @ v.co) for v in me.vertices]
        faces = [tuple(t.vertices) for t in me.loop_triangles]
        if faces:
            saida.append(BVHTree.FromPolygons(verts, faces, all_triangles=True))
    return saida


def _dentro(casca, p):
    """Paridade de cruzamentos: ímpar em pelo menos dois dos três eixos."""
    votos = 0
    for d in _RAIOS:
        n, origem = 0, p.copy()
        while n < 24:
            loc, _nor, _idx, _dist = casca.ray_cast(origem, d)
            if loc is None:
                break
            n += 1
            origem = loc + d * 1e-4
        votos += n % 2
    return votos >= 2


def _furos(objs, cascas, isentos):
    """(quantos vértices enterrados, o mais fundo em metros)."""
    n, fundo = 0, 0.0
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            if any((p - c).length < r for c, r in isentos):
                continue
            for casca in cascas:
                if not _dentro(casca, p):
                    continue
                loc = casca.find_nearest(p)[0]
                d = (p - loc).length if loc else 0.0
                if d > FOLGA:
                    n += 1
                    fundo = max(fundo, d)
                    # ZAFE_FUROS=1 diz ONDE está enterrado, em coordenada de
                    # mundo. Sem isso a calibragem é adivinhar qual das oito
                    # primitivas da peça é a que entrou no corpo.
                    if os.environ.get("ZAFE_FUROS"):
                        print(
                            f"    [furo] {o.name} "
                            f"({p.x:.3f},{p.y:.3f},{p.z:.3f}) {d * 100:.1f} cm",
                            flush=True,
                        )
                break
    return n, fundo


def _para_fora(onde, quadro, quadros):
    """A direção em que empurrar um adereço enterrado.

    Peito e costas saem pela frente/trás do tronco; cabeça sobe. O resto sai
    RADIALMENTE do eixo do corpo — é o que "para fora" quer dizer para uma mão
    ou um pé, e é o único vetor que funciona igual nos dois lados sem a receita
    ter de saber que a direita do personagem é −X.
    """
    if onde in ("peito", "costas"):
        return quadro.col[2].to_3d().normalized()
    if onde == "cabeca":
        return Vector((0, 0, 1))
    eixo = quadros.get("quadril") or quadros.get("peito")
    if eixo is None:
        return None
    d = quadro.translation - eixo.translation
    d.z = 0.0
    return d.normalized() if d.length > 1e-3 else None


def afastar(objs, direcao, cascas, isentos, passo=0.008, limite=0.08):
    """Empurra até limpar a malha. Devolve (quanto andou, furos que sobraram)."""
    n, _fundo = _furos(objs, cascas, isentos)
    if n == 0 or direcao is None:
        return 0.0, n
    andado = 0.0
    while andado < limite:
        for o in objs:
            o.matrix_world = Matrix.Translation(direcao * passo) @ o.matrix_world
        andado += passo
        n, _fundo = _furos(objs, cascas, isentos)
        if n == 0:
            break
    return andado, n


def aplicar_aderecos(avatar_id, receita, quadros):
    pedidos = receita.get("aderecos", [])
    if not pedidos:
        return []
    if "cabeca" in quadros:
        quadros["cabeca"] = coroar(quadros["cabeca"])
    corpo = quadros.get("peito") or quadros.get("quadril")
    frente = corpo.col[2].to_3d() if corpo else Vector((0, -1, 0))
    cascas = _cascas_do_corpo()
    postos, laudo = [], []

    for n, item in enumerate(pedidos):
        nome = item["peca"]
        desenhar = ADERECOS.get(nome)
        if not desenhar:
            raise SystemExit(
                f"{avatar_id}: adereço '{nome}' não existe. "
                f"Há: {', '.join(sorted(ADERECOS))}"
            )
        onde = item.get("onde", "mao.R")
        quadro = quadros.get(onde)
        if quadro is None:
            raise SystemExit(f"{avatar_id}: não há encaixe '{onde}' nesta armadura")

        peca = Peca(f"Ad_{nome.replace('-', '_')}_{n}")
        cores = {
            k: v
            for k, v in item.items()
            if k not in ("peca", "onde", "pos", "giro", "escala", "aprumar", "afastar")
        }
        desenhar(peca, **cores)

        if item.get("aprumar"):
            quadro = aprumar(quadro, frente)
        base = (
            quadro
            @ Matrix.Translation(Vector(item.get("pos", (0, 0, 0))))
            @ _giro(item.get("giro", (0, 0, 0)))
            @ Matrix.Scale(item.get("escala", 1.0), 4)
        )
        objs = peca.objetos()
        for obj in objs:
            obj.matrix_world = base
        postos.append((item, nome, onde, quadro, objs))

    # O portão roda DEPOIS de todos os adereços estarem postos, e mede contra o
    # corpo apenas — dois adereços podem se cruzar de propósito (o taco encosta
    # na mesa, a bola encosta na luva) e isso não é o defeito em questão.
    for item, nome, onde, quadro, objs in postos:
        if nome in VESTIDOS:
            continue
        raio = ISENCAO.get(onde.split(".")[0], 0.13)
        isentos = [(quadro.translation.copy(), raio)]
        if item.get("afastar"):
            andado, sobrou = afastar(
                objs, _para_fora(onde, quadro, quadros), cascas, isentos
            )
        else:
            andado, (sobrou, _f) = 0.0, _furos(objs, cascas, isentos)
        if sobrou or andado:
            _n, fundo = _furos(objs, cascas, isentos)
            laudo.append(
                {
                    "peca": nome,
                    "onde": onde,
                    "empurrado": round(andado, 3),
                    "furos": sobrou,
                    "fundo": round(fundo, 3),
                }
            )
    return laudo


# ----------------------------------------------------------------- CHIBI
#
# A alavanca isolada mais forte do pipeline, e a única invisível como defeito:
# ninguém olha o cast e pensa "a proporção está errada", olha e pensa "não
# parece personagem de jogo". A auditoria mediu 6,80 cabeças de altura na
# matéria-prima; o alvo é 3,2 a 3,8.
#
# A MATEMÁTICA
#
# Com R₀ = razão atual, R₁ = alvo, H = escala da cabeça e B = escala do corpo:
#
#     R₁ = (H + (R₀ − 1)·B) / H     →     B = H·(R₁ − 1)/(R₀ − 1)
#
# O corpo NÃO escala uniforme: chibi tem mão e pé grandes, não pequenos, e é
# na perna que se corta altura. Daí a tabela por osso.
#
# O QUE A TABELA DO DOCUMENTO NÃO DIZ, E QUEBRA TUDO SE FOR IGNORADO
#
# Escala de osso é HERDADA pela cadeia. Escrever `pb.scale = f` com os números
# da tabela — que é o que o script do documento faz — dá o resultado errado
# neste rig: `Neck` a 0,45 multiplica `Head`, e a cabeça que deveria sair a
# 1,70 sai a 0,45 × 1,70 = 0,765. Ou seja, o script que existe para AUMENTAR a
# cabeça a encolhe em 24%, e sem erro nenhum no console.
#
# Então a tabela abaixo é de fatores ABSOLUTOS (o tamanho final da peça no
# mundo), e `aplicar_chibi` converte para relativos dividindo pelo alvo do pai.
# O produto ao longo da cadeia telescopa e devolve exatamente o absoluto.
#
# Osso sem entrada na tabela herda o alvo do pai — não 1,0. Sem isso os dedos
# ficariam em tamanho normal pendurados numa mão 1,45×, que é o desenho de uma
# luva vazia.
#
# A SEGUNDA ARMADILHA: ESCALA DE OSSO ALONGA, NÃO ENGROSSA
#
# Em espaço de osso o eixo Y é o comprimento. Um fator uniforme de 1,35 no
# `Foot` não faz um pé graúdo de chibi: faz um pé com 35% mais de COMPRIMENTO,
# e como o pé é um osso longo o tênis vira um espinho que atravessa o chão e
# passa a definir o rodapé da caixa envolvente — a primeira versão saía com o
# calçado de apoio descendo para fora do quadro. O simétrico vale para a perna:
# 0,60 uniforme encurta a coxa e AFINA junto, e chibi de perna fina lê como
# boneco de palito.
#
# Por isso são duas tabelas. `pb.scale = (espessura, comprimento, espessura)`.
# Só o comprimento entra na conta de altura, então mexer em espessura nunca
# desregula a razão de cabeças.

# Os dois botões de calibragem. `CABECA` é o H da fórmula; `CORPO` multiplica
# os COMPRIMENTOS do corpo (o B) — não as espessuras, que são absolutas. Mexer
# neles é a decisão visual do dono; o resto do script só obedece. Cada montagem
# imprime `cabeças X -> Y` e devolve a razão no RELATORIO, então a régua depois
# de mexer sai da própria rodada — não há um modo de medir à parte.
#
# A razão medida é do TOPO DA CAIXA até a base do crânio, então cabelo espetado
# e chapéu entram na conta como cabeça: a bruxa de chapéu de bico marca 2,35
# sem que a proporção dela tenha nada de errado. O aviso de faixa é informativo,
# não é portão.
CHIBI_CABECA = 1.50
CHIBI_CORPO = 0.85

# Comprimento ao longo do osso. Alvos com B = 0,65, como o documento.
CHIBI_COMPRIMENTO = {
    "Neck": 0.45,  # chibi quase não tem pescoço
    "Abdomen": 0.78,  # a "spine" deste rig são três ossos, não dois
    "Torso": 0.78,
    "Chest": 0.78,
    "Shoulder": 0.88,
    "UpperArm": 0.80,  # braço encurta menos que perna
    "LowerArm": 0.78,
    "Wrist": 1.05,  # mão só um respiro maior; o volume vem da espessura
    "UpperLeg": 0.60,  # é na perna que se corta altura
    "LowerLeg": 0.58,
    "Foot": 1.00,  # NUNCA alongar: alonga para dentro do chão
    "PT": 1.00,  # ponta do pé (este rig não tem `Toe`)
}

# Seção transversal. É aqui que mora o "gordinho" do chibi.
CHIBI_ESPESSURA = {
    "Neck": 0.90,
    "Abdomen": 1.06,
    "Torso": 1.06,
    "Chest": 1.06,
    "Shoulder": 1.00,
    "UpperArm": 1.18,
    "LowerArm": 1.14,
    "Wrist": 1.40,  # mão grande é a marca registrada — em largura
    "UpperLeg": 1.28,  # compensa o encurtamento: curta E grossa
    "LowerLeg": 1.22,
    "Foot": 1.30,  # pé graúdo, sem virar espinho
    "PT": 1.20,
}

CHIBI_ALVO = 3.5
CHIBI_FAIXA = (3.2, 3.8)


def alvo_do_osso(nome, cache, ossos, tabela, corpo):
    """Fator ABSOLUTO de um osso: o da tabela, ou o herdado do pai."""
    if nome in cache:
        return cache[nome]
    prefixo = nome.split(".")[0]
    if prefixo == "Head":
        f = CHIBI_CABECA
    elif prefixo in tabela:
        f = tabela[prefixo] * corpo
    else:
        pai = ossos[nome].parent
        f = alvo_do_osso(pai.name, cache, ossos, tabela, corpo) if pai else 1.0
    cache[nome] = f
    return f


def tornozelos(arm):
    """Onde a canela termina, agora, em espaço de pose."""
    return {
        lado: arm.pose.bones[f"LowerLeg.{lado}"].tail.copy()
        for lado in ("L", "R")
        if f"LowerLeg.{lado}" in arm.pose.bones
    }


def reencaixar_pes(arm, antes):
    """Leva `Foot` e `PT` junto com a canela encurtada.

    A TERCEIRA ARMADILHA, E A QUE ARRUINOU A PRIMEIRA FOLHA INTEIRA

    Neste rig `Foot.L`, `Foot.R`, `PT.L` e `PT.R` são filhos de `Root` — não da
    perna — e nenhum osso é conectado (`use_connect` é falso nos 63). Filho não
    conectado herda a escala do pai, então o crânio acompanha o pescoço curto
    sozinho; mas o pé pendura em `Root`, que ninguém escala, e simplesmente não
    se move. Encurtar a perna a 0,6 sobe o tornozelo 15cm e deixa o tênis para
    trás, no chão, solto embaixo de uma canela que agora acaba no ar.

    O defeito não aparece no console, não aparece na razão de cabeças e nem
    chega a parecer um bug de rig na folha da loja — parece que os trinta
    ficaram com a perna terminando em ponta. Só se descobre listando a
    hierarquia da armadura.

    Reparentar o pé sob a canela seria a correção "certa" e quebraria as 24
    animações do pack: a ação guarda a rotação do pé em espaço de `Root`, e sob
    um novo pai ela passaria a somar com a rotação da perna. Então o pé
    continua onde está na hierarquia e é reposicionado à mão, pelo mesmo
    deslocamento que o tornozelo sofreu.
    """
    for lado, alvo in tornozelos(arm).items():
        if lado not in antes:
            continue
        desloca = Matrix.Translation(alvo - antes[lado])
        for nome in (f"Foot.{lado}", f"PT.{lado}"):
            pb = arm.pose.bones.get(nome)
            if not pb:
                continue
            pb.matrix = desloca @ pb.matrix
            # `pose_bone.matrix` só resolve contra a avaliação corrente; sem o
            # update aqui, o segundo osso lê a matriz velha do primeiro.
            bpy.context.view_layer.update()


def aplicar_chibi(arm):
    ossos = {pb.name: pb for pb in arm.pose.bones}
    caches = {"c": {}, "e": {}}

    def rel(nome, pb, tabela, corpo, cache):
        meu = alvo_do_osso(nome, cache, ossos, tabela, corpo)
        do_pai = (
            alvo_do_osso(pb.parent.name, cache, ossos, tabela, corpo)
            if pb.parent
            else 1.0
        )
        # Só a DIFERENÇA para o pai: a cadeia multiplica o resto sozinha.
        return meu / do_pai

    antes = tornozelos(arm)
    for nome, pb in ossos.items():
        c = rel(nome, pb, CHIBI_COMPRIMENTO, CHIBI_CORPO, caches["c"])
        e = rel(nome, pb, CHIBI_ESPESSURA, 1.0, caches["e"])
        # Y é o eixo do osso.
        pb.scale = (e, c, e)
    bpy.context.view_layer.update()
    reencaixar_pes(arm, antes)


def razao_cabecas(arm):
    """Quantas cabeças de altura o personagem tem, AGORA.

    `bone.head` é a ponta de origem do osso, nada a ver com crânio: a cabeça do
    osso `Head` é a base do pescoço, e do topo da caixa até ali é a altura da
    cabeça.

    Tem de ser chamada com a armadura ainda viva, ou seja antes de `congelar`.
    """
    ms = malhas()
    osso = arm.pose.bones.get("Head")
    if not ms or not osso:
        return None
    zs = [(o.matrix_world @ Vector(c)).z for o in ms for c in o.bound_box]
    total = max(zs) - min(zs)
    alto = max(zs) - (arm.matrix_world @ osso.head).z
    return (total / alto) if alto > 0 else None


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


# --------------------------------------------------------------- SUPERFÍCIE
#
# Duas coisas diferentes que o olho lê como o mesmo defeito ("pixelado"):
#
#   SHADING  — a face marcada flat mostra a quina no MEIO da superfície. Custa
#              zero triângulo consertar: é uma flag por face mais um ângulo.
#   SILHUETA — o CONTORNO continua uma linha quebrada por mais suave que o
#              sombreamento fique, porque ali não há geometria nenhuma. Só
#              subdividir resolve, e custa triângulo de verdade.
#
# Ordem obrigatória: soldar → marcar quina → suavizar → subdividir. Invertida,
# a subdivisão arredonda a sola do tênis e a aba do boné junto com o resto.

ANGULO_QUINA = math.radians(40)
NIVEL_SUBDIV = 1


def soldar(obj, limite=0.0001):
    """Funde vértices coincidentes.

    Sem isto o smooth shading não tem efeito onde a malha veio partida: dois
    vértices no mesmo ponto têm normais próprias e cada face continua com o
    próprio degrau. O limite é apertado de propósito — solto demais funde dedo
    com dedo e a bainha da calça com a perna."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=limite)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def suavizar(obj, angulo=ANGULO_QUINA):
    """Suave em tudo, menos onde há quina de verdade.

    Marca a aresta como dura pelo ÂNGULO entre as duas faces, e não pelo
    operador `shade_auto_smooth`: aquele foi introduzido no 4.1 junto com a
    remoção do `use_auto_smooth`, e um script que dependa de qualquer um dos
    dois quebra em metade das versões. Ângulo é aritmética, e aritmética não
    muda de API.

    Aresta de borda aberta (uma face só) entra como dura sempre: é literalmente
    o contorno de uma casca, e suavizá-la faz o material vazar para o vazio.
    """
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.edges.ensure_lookup_table()

    # A camada de crease é criada ANTES do laço, e não depois: criar uma camada
    # realoca os dados do bmesh e invalida todo `BMEdge` que estiver numa lista
    # Python — o erro que sai é "BMesh data of type BMEdge has been removed",
    # que não parece ter nada a ver com a causa.
    #
    # Crease é o que faz a quina RESISTIR à subdivisão Catmull-Clark, que sem
    # isto arredonda sola de tênis, aba de boné e bainha de calça. Uma quina
    # perdida é mais visível que uma faceta a menos.
    #
    # O nome do atributo é `crease_edge` desde o 4.0; `layers.crease` sumiu.
    cl = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new(
        "crease_edge"
    )

    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle() < angulo
        else:
            e.smooth = False
        if not e.smooth:
            e[cl] = 1.0

    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.update()


def subdividir(obj, niveis=NIVEL_SUBDIV):
    """Geometria de verdade no contorno.

    `use_limit_surface` e os creases acima são o que contém os dois defeitos
    conhecidos do Catmull-Clark: encolher o volume e arredondar o que deveria
    ser reto."""
    if niveis <= 0:
        return
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(name="Subsurf", type="SUBSURF")
    mod.subdivision_type = "CATMULL_CLARK"
    mod.levels = niveis
    mod.render_levels = niveis
    mod.use_creases = True
    mod.use_limit_surface = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def refinar():
    """Roda a passagem de superfície em cada malha, antes de juntar.

    Antes de `juntar` de propósito: depois da junção existe um objeto só, e a
    solda passaria a fundir peças que se tocam — o pé com a barra da calça, o
    pescoço com a gola."""
    for obj in malhas():
        bpy.context.view_layer.objects.active = obj
        soldar(obj)
        suavizar(obj)
        subdividir(obj)
        # De novo depois da subdivisão: os vértices novos nascem sem herdar a
        # marcação, e sem isto o modelo volta a facetar exatamente onde ganhou
        # geometria.
        suavizar(obj)


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


# ------------------------------------------------------- OCLUSÃO DE AMBIENTE
#
# O contorno do personagem já está resolvido pela luz do palco; o que falta é o
# INTERIOR. Numa figura de cor chapada, axila, virilha, queixo sobre o pescoço e
# a dobra do cotovelo recebem exatamente a mesma luz que a barriga, e a peça
# inteira lê como um adesivo. Oclusão de ambiente é a única informação que
# nenhuma luz de cena consegue dar: quanto do céu cada ponto enxerga.
#
# POR QUE EM COR DE VÉRTICE, E NÃO NUMA TEXTURA
#
# O cast não tem UV utilizável — as peças vêm de packs diferentes, com ilhas que
# se sobrepõem, e desdobrar trinta personagens não é opção. Cor de vértice não
# precisa de UV nenhum: mora na malha, sobrevive ao `join` e ao `simplify` do
# gltf-transform, e o glTF a carrega em COLOR_0, que o three multiplica pela cor
# base sozinho — nenhuma linha de runtime.
#
# A densidade da subdivisão é o que torna isso viável: 35 mil triângulos dão
# resolução de sombreado suficiente. No modelo cru, de 5.872, o mesmo bake sairia
# em manchas. É a razão de este passo vir DEPOIS de `refinar`.
#
# O RAIO É PEQUENO DE PROPÓSITO
#
# O padrão do Blender é 10 metros, o que num boneco de 1,4 m significa que o
# tronco inteiro se auto-ocluí e o personagem sai cinza. Com 12 cm o efeito fica
# onde deve ficar: onde duas superfícies quase se tocam.
AO_DISTANCIA = 0.35
AO_AMOSTRAS = 64
# Quanto do escuro entra. 1,0 é o AO cru, que em cor chapada lê como sujeira.
AO_FORCA = 0.55


def assar_ao(obj):
    """Assa AO na cor de vértice do objeto já unido."""
    me = obj.data
    for antiga in list(me.color_attributes):
        me.color_attributes.remove(antiga)
    # CORNER + BYTE_COLOR é o que o exportador glTF sabe levar para COLOR_0.
    me.color_attributes.new(name="AO", type="BYTE_COLOR", domain="CORNER")
    me.color_attributes.active_color_index = 0

    cena = bpy.context.scene
    # O Cycles vem desligado no `--factory-startup` que `cena_vazia` usa, e sem
    # ele `object.bake` não existe: o operador é do Cycles, não do EEVEE.
    addon_utils.enable("cycles", default_set=False, persistent=False)
    motor_antes = cena.render.engine
    cena.render.engine = "CYCLES"
    cena.cycles.samples = AO_AMOSTRAS
    cena.cycles.use_denoising = False
    # `cena_vazia` não cria mundo, e AO é literalmente "quanto do céu este ponto
    # enxerga": sem mundo não há céu, e o operador estoura em `light_settings`.
    if cena.world is None:
        cena.world = bpy.data.worlds.new("ao")
    cena.world.light_settings.distance = AO_DISTANCIA
    cena.render.bake.target = "VERTEX_COLORS"

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO")

    cena.render.engine = motor_antes

    # O bake escreve o AO cru. Puxar para 1,0 pela força evita o personagem
    # encardido — o AO aqui é realce de dobra, não iluminação.
    dados = me.color_attributes[0].data
    for c in dados:
        v = c.color
        k = 1.0 - AO_FORCA + AO_FORCA * v[0]
        c.color = (k, k, k, 1.0)
    me.update()


def mostrar_ao(obj, atributo="Color"):
    """Faz o material do Blender multiplicar a cor base pela AO de vértice.

    No app isto é de graça: o glTF entrega a AO em COLOR_0 e o three multiplica
    sozinho, sem uma linha de runtime. Dentro do Blender, não — cor de vértice
    só aparece se algum nó a ler, e o material importado não lê.

    Sem esta função a folha de miniaturas sairia SEM a AO que o editor mostra, e
    o card passaria a vender um personagem mais chapado do que o que o usuário
    recebe. É o mesmo argumento de `luzes.tsx`: a miniatura é a propaganda do
    editor, e as duas divergirem por descuido é o defeito a evitar.

    O nome do atributo é `Color`, e não `AO`: o exportador glTF renomeia ao
    gravar em COLOR_0, e é do arquivo exportado que a folha lê.
    """
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        base = bsdf.inputs["Base Color"]

        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = atributo
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0

        # O nó Mix tem entradas homônimas para float, vetor e cor; procurar por
        # nome devolve a errada. Casar nome E tipo é o que acerta a de cor.
        a = next(s for s in mix.inputs if s.name == "A" and s.type == "RGBA")
        b = next(s for s in mix.inputs if s.name == "B" and s.type == "RGBA")
        saida = next(s for s in mix.outputs if s.type == "RGBA")

        if base.is_linked:
            nt.links.new(base.links[0].from_socket, a)
        else:
            a.default_value = base.default_value
        nt.links.new(vc.outputs["Color"], b)
        nt.links.new(saida, base)


def caixa_mundo(objs):
    """Caixa envolvente em MUNDO, medida vértice a vértice.

    Não por `obj.bound_box`: ele é cache e só é reavaliado quando o objeto é
    tocado de novo. Logo depois de `juntar()` ele ainda descreve a malha que o
    objeto tinha ANTES da fusão — uma peça de roupa qualquer — e foi assim que o
    boneco passou a sair 18 cm acima do chão quando os adereços entraram, sem
    ninguém ter errado uma conta.
    """
    pontos = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    eixos = [[p[i] for p in pontos] for i in range(3)]
    return (
        Vector(tuple(min(e) for e in eixos)),
        Vector(tuple(max(e) for e in eixos)),
    )


def assentar():
    """Pés em y=0 e centrado em x/z.

    O carregador do app já normaliza, mas ele normaliza o que chegar: se a pose
    deslocou o personagem para fora da origem (Run desloca), o boneco entraria
    torto no enquadramento da célula da loja."""
    ms = malhas()
    if not ms:
        return
    minimo, maximo = caixa_mundo(ms)
    centro = (minimo + maximo) / 2
    # Z é a altura no Blender; X/Y são o plano do chão.
    for obj in ms:
        obj.location -= Vector((centro.x, centro.y, minimo.z))

    # E aí ASSA a transformação na malha. Sem isto o assentamento vive no nó do
    # `.glb`, e quem reposiciona o objeto depois — a folha de miniaturas faz
    # exatamente isso, `obj.location = (célula)` — apaga o assentamento junto e
    # cada personagem volta a flutuar de um jeito diferente. Era a origem da
    # grade em escada: as colunas certas, as alturas cada uma para um lado.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in ms:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# ---------------------------------------------------------------- MONTAGEM

# A régua do cast, em metros de Blender: a mediana dos trinta DEPOIS do chibi.
# Tem de bater com `ALTURA_BASE_GLB` em `components/figura3d/avatar/rig.ts` — é
# lá que o app converte para a altura da cena, e é o MESMO número para os trinta.
#
# Caiu de 1,85 para 1,42 com o chibi: a perna encurta 40% e a cabeça, mesmo a
# 1,5×, não repõe o que a perna tirou. O número em metros não significa mais
# nada sozinho — é só a escala em que os arquivos saem, e existe para o app
# dividir por ela.
ALTURA_BASE = 1.42

# Quanto um personagem pode legitimamente fugir da régua. Para cima é adereço na
# cabeça (o chapéu de bico da bruxa chega a 1,66); para baixo é pose fechada (a
# capitã, 1,34). Fora disso não é caracterização, é acidente — peça importada em
# escala de FBX, personagem deitado, malha sem assentar.
ALTURA_MIN, ALTURA_MAX = 1.25, 1.80


def conferir_altura(avatar_id):
    """Recusa exportar um modelo cuja altura não caiba na régua do cast.

    O app escala todo `.glb` por um fator ÚNICO, e é isso que faz inclinar-se
    diminuir a silhueta em vez de aumentá-la. O preço desse acerto é que o
    arquivo não pode mais chegar em qualquer escala: um export fora da faixa
    vira um gigante ou um anão na loja, e sem esta linha ele viraria isso em
    silêncio — a montagem termina, o arquivo tem o tamanho esperado e nada no
    console avisa. Só se descobre olhando a grade.
    """
    ms = malhas()
    if not ms:
        raise SystemExit(f"{avatar_id}: nada para medir")
    minimo, maximo = caixa_mundo(ms)
    alto = maximo.z - minimo.z
    if not ALTURA_MIN <= alto <= ALTURA_MAX:
        raise SystemExit(
            f"{avatar_id}: {alto:.3f}m (de {minimo.z:.3f} a {maximo.z:.3f}) fora da "
            f"faixa [{ALTURA_MIN}, {ALTURA_MAX}] (régua {ALTURA_BASE}m). "
            "Pose extrema demais, adereço grande demais ou malha não assentada."
        )
    return alto


def montar(avatar_id, receita, destino=None):
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

    # Antes da pose: o rosto tem de ser mexido em repouso (ver a seção ROSTO).
    expressao(receita.get("rosto"))

    pintar(receita.get("cores", {}))
    # Antes de `juntar()`: o acabamento é decidido pela peça, e depois da fusão
    # não existe mais peça, existe uma malha só.
    acabar(receita.get("acabamento", {}))

    pose = receita.get("pose")
    if pose:
        aplicar_pose(arm, pose[0], pose[1])

    # Depois da pose e antes de congelar: é a única janela em que a armadura
    # ainda existe e a pose final já está montada.
    cru = razao_cabecas(arm)
    aplicar_chibi(arm)
    razao = razao_cabecas(arm)
    if razao and not CHIBI_FAIXA[0] <= razao <= CHIBI_FAIXA[1]:
        print(
            f"  [aviso] {avatar_id}: {razao:.2f} cabeças, fora de {CHIBI_FAIXA}. "
            f"Ajuste CHIBI_CABECA/CHIBI_CORPO.",
            flush=True,
        )

    # Medido com a armadura ainda viva; usado depois que ela já foi embora.
    quadros = quadros_de_pose(arm)
    congelar(arm)
    # ZAFE_ENCAIXES=1 imprime onde cada ponto de encaixe caiu nesta pose. É por
    # aqui que se descobre um `pos` errado sem abrir o Blender.
    if os.environ.get("ZAFE_ENCAIXES"):
        print(
            f"  [encaixe] {avatar_id} coroa {coroar(quadros['cabeca']).translation.z:.3f} "
            + " ".join(
                f"{k}({quadros[k].translation.x:.2f},{quadros[k].translation.y:.2f},"
                f"{quadros[k].translation.z:.2f})"
                for k in sorted(quadros)
            ),
            flush=True,
        )
    laudo = aplicar_aderecos(avatar_id, receita, quadros)
    for p in laudo:
        estado = (
            f"ATRAVESSA ({p['furos']} vértices, {p['fundo'] * 100:.1f} cm dentro)"
            if p["furos"]
            else f"corrigido (+{p['empurrado'] * 100:.1f} cm)"
        )
        print(f"  [adereço] {avatar_id} {p['peca']}@{p['onde']}: {estado}", flush=True)

    refinar()
    juntar()
    assar_ao(malhas()[0])
    assentar()
    alto = conferir_altura(avatar_id)

    # `destino` só é passado pela prospecção de pose, que escreve em /tmp: um
    # candidato descartado não pode encostar em `public/avatares`.
    destino = destino or os.path.join(SAIDA, f"{avatar_id}.glb")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=destino,
        export_format="GLB",
        # Os materiais são cor chapada nomeada; não há textura a levar, e sem
        # esta linha o exportador embute os PNG do pack que ninguém usa.
        export_image_format="NONE",
        export_animations=False,
        export_skins=False,
        export_yup=True,
        # O padrão (`MATERIAL`) só exporta cor de vértice que algum nó do
        # material leia. O AO de `assar_ao` não passa por nó nenhum — ele existe
        # para o three multiplicar na cor base — então tem de ser `ACTIVE`.
        export_vertex_color="ACTIVE",
    )
    kb = round(os.path.getsize(destino) / 1024)
    verts = sum(len(o.data.vertices) for o in malhas())
    for o in malhas():
        o.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in malhas())
    print(
        f"[montar] {avatar_id}: {kb} KB, {verts} vértices, {tris} tris, "
        f"cabeças {cru:.2f} -> {razao:.2f}"
        if cru and razao
        else f"[montar] {avatar_id}: {kb} KB, {verts} vértices, {tris} tris",
        flush=True,
    )
    return {
        "id": avatar_id,
        "kb": kb,
        "vertices": verts,
        "tris": tris,
        "cabecas": round(razao, 2) if razao else None,
        "altura": round(alto, 3),
        "aderecos": [p for p in laudo if p["furos"]],
    }


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
# Fração da célula ocupada por um personagem DE PÉ na régua (`ALTURA_BASE`) —
# não pelo personagem mais alto. Quem tem chapéu de bico passa disso de
# propósito; a folga até 1.0 é o que o deixa passar sem ser cortado. Contas com
# o teto da faixa: 0.72 × 1.80 / 1.42 + 0.05 ≈ 0.96 de célula, ainda dentro.
#
# Baixou de 0,78 quando o chibi mudou a régua: com `ALTURA_BASE` em 1,42 o teto
# passou a valer 1,27 célula, e o número velho cortava a cabeça de quem tem
# moicano ou chapéu — pelo topo, que é o único lugar onde ninguém repara que
# faltou, porque a silhueta continua plausível.
OCUPACAO_MINI = 0.72
# Distância do pé até a base da célula. Fixa, porque é o que alinha os trinta na
# mesma linha de chão.
PISO_MINI = 0.05
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
        # Escala CONSTANTE, igual à do editor: dividir a célula pela altura
        # medida de cada um faria o card mentir duas vezes — apagaria a coroa do
        # Rei (que existe justamente para ele ser o mais alto) e inflaria quem
        # está numa pose fechada, porque medir a caixa é medir a pose.
        obj.scale = (OCUPACAO_MINI / ALTURA_BASE,) * 3
        mostrar_ao(obj)

        col, lin = n % COLUNAS_MINI, n // COLUNAS_MINI
        # Alinhados pelos PÉS, não centralizados: os trinta pisam na mesma linha
        # e a diferença de altura entre eles vira leitura, não desalinhamento.
        obj.location = (
            (col - (COLUNAS_MINI - 1) / 2) * ASPECTO_MINI,
            0,
            (linhas - 1 - lin) + PISO_MINI,
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


# ------------------------------------------------------------ PROSPECÇÃO DE POSE


def tira_de_poses(avatar_id, nome_anim, quadros):
    """Rende o mesmo personagem em vários quadros de uma animação, lado a lado.

    POR QUE ISTO EXISTE

    A receita de cada avatar congela um instante de uma das 24 animações, e
    escolher esse instante no chute é o erro mais caro do pipeline: `Kick_Right`
    no quadro 12 não é "chutando", é um corpo a 45° do chão que na loja lê como
    tropeço, e nada no console diz isso. Só render diz.

    A alternativa seria abrir o Blender e arrastar a linha do tempo. Isso não
    escala para trinta personagens e, pior, não deixa registro: a escolha some
    quando a janela fecha. Uma tira renderizada é comparável, é anexável a um
    commit e mostra as opções lado a lado, que é como se escolhe pose — nunca
    olhando um quadro isolado.

    Usa a mesma iluminação e o mesmo ângulo da folha da loja de propósito: pose
    escolhida sob outra luz é pose escolhida para outra imagem.
    """
    receita = RECEITAS[avatar_id]
    arquivos = []
    for q in quadros:
        caminho = os.path.join(tempfile.gettempdir(), f"pose-{avatar_id}-{q}.glb")
        montar(avatar_id, {**receita, "pose": (nome_anim, q)}, destino=caminho)
        arquivos.append((q, caminho))

    cena_vazia()
    cena = bpy.context.scene
    for n, (_, caminho) in enumerate(arquivos):
        antes = {o.name for o in bpy.data.objects}
        bpy.ops.import_scene.gltf(filepath=caminho)
        for o in malhas():
            if o.name in antes:
                continue
            o.scale = (OCUPACAO_MINI / ALTURA_BASE,) * 3
            o.location = ((n - (len(arquivos) - 1) / 2) * ASPECTO_MINI, 0, PISO_MINI)
            o.rotation_euler.z = math.radians(-155)

    iluminar(cena, fundo=(0.18, 0.19, 0.22, 1))
    cam_dados = bpy.data.cameras.new("cam")
    cam_dados.type = "ORTHO"
    cam_dados.ortho_scale = max(len(arquivos) * ASPECTO_MINI, 1.0)
    cam = bpy.data.objects.new("cam", cam_dados)
    cam.location = (0, -12, 0.5)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cena.collection.objects.link(cam)
    cena.camera = cam

    motor_eevee(cena)
    cena.render.image_settings.file_format = "PNG"
    cena.render.resolution_x = round(len(arquivos) * CELULA_PX * ASPECTO_MINI)
    cena.render.resolution_y = CELULA_PX
    cena.render.filepath = os.path.join(
        tempfile.gettempdir(), f"poses-{avatar_id}-{nome_anim}.png"
    )
    bpy.ops.render.render(write_still=True)
    print(
        f"[poses] {avatar_id} {nome_anim} quadros {[q for q, _ in arquivos]}"
        f" -> {cena.render.filepath}",
        flush=True,
    )


# ------------------------------------------------------------------- MAIN


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

    if "--folha" in argv:
        # Com ids depois da flag, rende só eles — e maiores, porque a folha do
        # elenco inteiro é boa para comparar silhuetas e péssima para conferir
        # se um adereço ficou no lugar.
        escolhidos = [a for a in argv if a in RECEITAS]
        folha_contato(escolhidos or list(RECEITAS), largura=min(4, len(escolhidos) or 5))
        return

    # --poses <avatar_id> <Animacao> <q1,q2,...>
    if "--poses" in argv:
        resto = argv[argv.index("--poses") + 1 :]
        if len(resto) < 3:
            raise SystemExit("uso: --poses <avatar_id> <Animacao> <q1,q2,...>")
        alvo, anim, quadros = resto[0], resto[1], [int(q) for q in resto[2].split(",")]
        if alvo not in RECEITAS:
            raise SystemExit(f"sem receita para: {alvo}")
        tira_de_poses(alvo, anim, quadros)
        return

    if "--miniaturas" in argv:
        folha_miniaturas(ordem_do_catalogo())
        return

    pedidos = argv or list(RECEITAS)
    desconhecidos = [i for i in pedidos if i not in RECEITAS]
    if desconhecidos:
        raise SystemExit(f"sem receita para: {', '.join(desconhecidos)}")

    relatorio = [montar(i, RECEITAS[i]) for i in pedidos]

    # O placar do portão de adereços, no fim e em uma linha. É o número que o
    # dono cobra: nenhum personagem com coisa saindo do corpo.
    furados = [r for r in relatorio if r["aderecos"]]
    print(
        f"ADEREÇOS {len(relatorio) - len(furados)}/{len(relatorio)} limpos",
        flush=True,
    )
    for r in furados:
        for p in r["aderecos"]:
            print(
                f"  FURA {r['id']}: {p['peca']}@{p['onde']} "
                f"{p['furos']} vértices a {p['fundo'] * 100:.1f} cm",
                flush=True,
            )
    print("RELATORIO " + json.dumps(relatorio), flush=True)


main()
