import Link from 'next/link';
import { getGame, getTopScores, getGameStats } from '@/lib/supabase/queries';

export const revalidate = 0;

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [game, scores, stats] = await Promise.all([
    getGame(id),
    getTopScores(id, 10),
    getGameStats(id),
  ]);

  if (!game) return null;

  const playsDisplay =
    stats.plays > 0 ? stats.plays.toLocaleString('es-ES') : '0';
  const bestDisplay = stats.best;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover ?? ''}`} />
        </div>

        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>

          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>

          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{playsDisplay}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: 'var(--magenta)',
                  textShadow: '0 0 6px rgba(255,0,110,0.5)',
                }}
              >
                {bestDisplay.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>

          <div className="detail-actions">
            <Link href={`/games/${id}/play`} className="btn xl pulse">
              ▶&nbsp; JUGAR AHORA
            </Link>
            <Link href="/" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 ? (
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--ink-dim)',
                letterSpacing: '0.14em',
                padding: '20px 0',
                textAlign: 'center',
              }}
            >
              SIN PUNTUACIONES AÚN
            </div>
          ) : (
            scores.map((r, i) => {
              const date = new Date(r.created_at);
              const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
              return (
                <div
                  key={r.id}
                  className={
                    'lb-row' +
                    (i === 0
                      ? ' top1'
                      : i === 1
                        ? ' top2'
                        : i === 2
                          ? ' top3'
                          : '')
                  }
                >
                  <div className="rk">#{String(i + 1).padStart(2, '0')}</div>
                  <div className="pl">
                    {r.player_name}
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--ink-faint)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {dateStr}
                    </div>
                  </div>
                  <div className="sc">{r.score.toLocaleString('es-ES')}</div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
