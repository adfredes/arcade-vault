import { createClient } from './client';

export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = createClient();
  // Liga el score a la cuenta si hay sesión; null si es invitado.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from('scores').insert({
    game_id: gameId,
    player_name: playerName,
    score,
    user_id: user?.id ?? null,
  });
}
