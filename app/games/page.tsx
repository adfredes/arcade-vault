import GamesGrid from '@/components/GamesGrid';
import { getAllGames } from '@/lib/supabase/queries';

export const revalidate = 0;

export default async function LibraryPage() {
  const games = await getAllGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <GamesGrid games={games} />
    </div>
  );
}
