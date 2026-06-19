import { createClient as createServerClient } from './server';

export type Game = {
  id: string;
  title: string;
  short: string | null;
  long: string | null;
  cat: string | null;
  cover: string | null;
  color: string | null;
};

export type Score = {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
};

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('games')
    .select('id, title, short, long, cat, cover, color')
    .eq('id', id)
    .single();
  return data ?? null;
}

export async function getAllGames(): Promise<Game[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('games')
    .select('id, title, short, long, cat, cover, color')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getTopScores(
  gameId: string,
  limit = 10,
): Promise<Score[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('scores')
    .select('id, game_id, player_name, score, created_at')
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getGameStats(
  gameId: string,
): Promise<{ plays: number; best: number }> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('scores')
    .select('score')
    .eq('game_id', gameId);
  if (!data || data.length === 0) return { plays: 0, best: 0 };
  return {
    plays: data.length,
    best: Math.max(...data.map((r) => r.score)),
  };
}
