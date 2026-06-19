import Link from 'next/link';
import { getAllGames, getTopScores } from '@/lib/supabase/queries';

export const revalidate = 0;

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;

  const games = await getAllGames();
  const activeId = game ?? games[0]?.id ?? 'asteroides';

  const scores = await getTopScores(activeId, 10);
  const podium = scores.slice(0, 3);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <Link
            key={g.id}
            href={`?game=${g.id}`}
            className={'chip' + (activeId === g.id ? ' active' : '')}
          >
            {g.title}
          </Link>
        ))}
      </div>

      {scores.length < 3 ? (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--ink-dim)',
            letterSpacing: '0.16em',
            textAlign: 'center',
            padding: '40px 0',
          }}
        >
          {scores.length === 0
            ? 'SIN PUNTUACIONES AÚN — ¡SÉ EL PRIMERO!'
            : 'SE NECESITAN AL MENOS 3 PUNTUACIONES PARA EL PODIO'}
        </div>
      ) : (
        <div className="podium">
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{podium[1].player_name}</div>
            <div className="score">
              {podium[1].score.toLocaleString('es-ES')}
            </div>
            <div className="date">{formatDate(podium[1].created_at)}</div>
          </div>
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: 'var(--gold)',
                letterSpacing: '0.18em',
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{podium[0].player_name}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {podium[0].score.toLocaleString('es-ES')}
            </div>
            <div className="date">{formatDate(podium[0].created_at)}</div>
          </div>
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{podium[2].player_name}</div>
            <div className="score">
              {podium[2].score.toLocaleString('es-ES')}
            </div>
            <div className="date">{formatDate(podium[2].created_at)}</div>
          </div>
        </div>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>

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
            JUEGA ASTEROIDES Y APARECE AQUÍ
          </div>
        ) : (
          scores.map((r, i) => (
            <div
              key={r.id}
              className={
                'tr' +
                (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '')
              }
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(i + 1).padStart(2, '0')}</div>
              <div className="pl">{r.player_name}</div>
              <div className="sc">{r.score.toLocaleString('es-ES')}</div>
              <div className="dt">{formatDate(r.created_at)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
