export type TopicCategory =
  | "esportes"
  | "esports";

export type TopicStatus = "pending" | "active" | "resolving" | "resolved" | "cancelled";
export type TopicResolution = "sim" | "nao" | null;
export type BetSide = "sim" | "nao";
export type MarketType = "binary" | "multi";

export interface TopicOutcome {
  id: string;
  topic_id: string;
  label: string;
  position: number;
  pool: number;
  created_at: string;
}
export type BetStatus =
  | "pending"
  | "matched"
  | "partial"
  | "won"
  | "lost"
  | "refunded"
  | "exited";
export type TransactionType =
  | "deposit"
  | "withdraw"
  | "bet_placed"
  | "bet_won"
  | "bet_refund"
  | "commission"
  | "bonus"
  | "referral_bonus"
  | "exit_fee"
  | "bet_exited";
export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type InviteStatus = "pending" | "accepted" | "declined" | "expired";
export type NotificationType =
  | "bet_invite"
  | "bet_matched"
  | "market_resolved"
  | "friend_request"
  | "bet_won"
  | "judge_invite"
  | "trade_executed"
  | "support_reply"
  | "support_message";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_premium: boolean;
  premium_until: string | null;
  birth_date: string | null;
  cpf: string | null;
  kyc_verified: boolean;
  phone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  // Personagem 3D. `figura` é a FiguraV2 (lib/figura/tipos.ts), saneada no POST
  // /api/perfil/figura; as duas URLs são os PNGs que o navegador fotografou do
  // canvas — é o que o resto do app mostra, para não rodar WebGL em toda rota.
  figura: Record<string, unknown> | null;
  figura_desbloqueada: boolean;
  figura_url: string | null;
  figura_retrato_url: string | null;
  /** A figura v1 (DiceBear) de quem já tinha avatar. Não converte — é rollback. */
  figura_legado: Record<string, string> | null;
  created_at: string;
}

export interface TopicInsightContent {
  resumo: string;
  pontos_chave: string[];
  pesquisas: string;
  historico: string;
  contexto: string;
  fontes: string[];
}

export interface TopicInsight {
  topic_id: string;
  content: TopicInsightContent;
  model: string | null;
  status: string;
  generated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  net_amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: TopicCategory;
  status: TopicStatus;
  resolution: TopicResolution;
  market_type: MarketType;
  winning_outcome_id: string | null;
  min_bet: number;
  closes_at: string;
  is_private: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  concurso_id: string | null;
  created_at: string;
}

export interface TopicSnapshot {
  id: string;
  topic_id: string;
  prob_sim: number;
  volume_sim: number;
  volume_nao: number;
  recorded_at: string;
}

export interface Bet {
  id: string;
  topic_id: string;
  user_id: string;
  side: BetSide;
  amount: number;
  status: BetStatus;
  matched_amount: number;
  unmatched_amount: number;
  potential_payout: number;
  is_private: boolean;
  created_at: string;
}

export interface BetMatch {
  id: string;
  topic_id: string;
  sim_bet_id: string;
  nao_bet_id: string;
  matched_amount: number;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export interface PrivateBetInvite {
  id: string;
  topic_id: string;
  inviter_id: string;
  invitee_id: string;
  inviter_side: BetSide;
  invitee_side: BetSide;
  amount: number;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface TopicStats {
  topic_id: string;
  volume_sim: number;
  volume_nao: number;
  total_volume: number;
  prob_sim: number;
  prob_nao: number;
  bet_count: number;
}

export interface TopicWithStats extends Topic {
  stats?: TopicStats;
  creator?: Profile;
}

export type SupportThreadStatus = "aberto" | "respondido" | "fechado";

export interface SupportThread {
  id: string;
  user_id: string;
  subject: string;
  status: SupportThreadStatus;
  last_message_at: string;
  unread_user: boolean;
  unread_admin: boolean;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  from_admin: boolean;
  message: string;
  created_at: string;
}

export interface UserStats {
  total_bets: number;
  bets_won: number;
  bets_lost: number;
  win_rate: number;
  total_volume: number;
}
