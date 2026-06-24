# Game suggestions TODO

> Mantenido por el agente `game-planner`. Estados: 🟡 propuesto · 🟢 implementado · ⛔ descartado.
> Cada sugerencia lleva: nombre, estado, `cat:` categoría, `fuente:` (carpeta en
> `references/started-games/` o "a crear"), fecha, y una línea `Razón:`.

## Ya implementados

- [x] **Asteroides** — 🟢 implementado · cat: SHOOTER · fuente: started-games/02-asteroids
- [x] **Tetris** — 🟢 implementado · cat: PUZZLE · fuente: started-games/03-tetris
- [x] **Arkanoid** — 🟢 implementado · cat: ARCADE · fuente: started-games/04-arkanoid
- [x] **Snake** — 🟢 implementado · cat: ARCADE · fuente: a crear

## Sugerencias

<!-- El agente game-planner añade aquí las nuevas sugerencias 🟡 propuesto. -->

- [ ] **Space Invaders** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: aporta el subgénero shooter de disparos fijos / oleadas, ausente (Asteroides es shooter de
      movimiento libre 360°). Canvas vanilla puro: grilla de invasores, cañón con flechas + espacio,
      sin assets. Score numérico directo por enemigo destruido + bonus por nave nodriza, encaja en el
      leaderboard.
- [ ] **Pac-Man** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: aporta categoría laberinto/persecución, no cubierta. Score por puntos/píldoras y fantasmas
      comidos. Más costoso: requiere mapa de tiles + IA de fantasmas.
- [ ] **Frogger** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: mecánica de cruce/timing (carriles con obstáculos), distinta a lo existente. Score por ranas
      llevadas a casa. Canvas vanilla simple, sin físicas complejas.
- [ ] **Breakout-Runner / Doodle Jump** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: aporta plataformas verticales / scroll infinito. Score por altura. Riesgo de solaparse con
      Arkanoid en sensación de "rebote".

### Lote de 20 (2026-06-24) — SHOOTERS

- [ ] **Galaga** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: fixed shooter con enemigos en formación + dives por curvas y captura/nave doble. Sustituto
      superior de Space Invaders. Factibilidad media. Score por enemigo según tipo + bonus jefe.
- [ ] **Centipede** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: field shooter con grilla de hongos destructible y ciempiés segmentado que se parte (mecánica
      de splitting inédita). Cañón con movimiento 2D. Factibilidad media. Score por segmento/hongo/bonus.
- [ ] **Tempest** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: tube shooter vectorial radial, estética que encaja con el shell CRT/neón. Movimiento circular
      sobre carriles. Factibilidad media (geometría radial). Score por enemigo según profundidad.
- [ ] **Twin-Stick Arena (Geometry Wars-like)** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: subgénero twin-stick ausente (mover + disparar en ejes independientes). Factibilidad ALTA,
      estética neón barata. Score con multiplicador combo. ⭐ Destacado del bucket shooter.
- [ ] **1942 / Scramble (scroll shmup)** — 🟡 propuesto · cat: SHOOTER · fuente: a crear · 2026-06-24
      Razón: scrolling shoot-em-up con scroll continuo + power-ups, eje inexistente. Factibilidad alta/media.
      Score por enemigo/formación + bonus por power-ups y distancia.

### Lote de 20 (2026-06-24) — PUZZLE / TILE / MATCH

- [ ] **2048** — 🟡 propuesto · cat: PUZZLE · fuente: a crear · 2026-06-24
      Razón: sliding tile / merge numérico, mecánica nueva (Tetris es caída de piezas). Factibilidad ALTA,
      el game.js más simple. Score = suma de valores fusionados. ⭐ Destacado del bucket puzzle.
- [ ] **Bejeweled / Match-3** — 🟡 propuesto · cat: PUZZLE · fuente: a crear · 2026-06-24
      Razón: subgénero MATCH puro (swap + cascadas), ausente. Factibilidad media (detección de matches y
      refill). Score por gema + multiplicador por cascadas/combos.
- [ ] **Minesweeper (Buscaminas)** — 🟡 propuesto · cat: PUZZLE · fuente: a crear · 2026-06-24
      Razón: lógica pura / deducción, distinto a todo. Factibilidad ALTA (grilla + flood-fill, requiere
      mouse). Score basado en tiempo/dificultad (fórmula ascendente).
- [ ] **Flood-It** — 🟡 propuesto · cat: PUZZLE · fuente: a crear · 2026-06-24
      Razón: puzzle de conquista por color, lógica estratégica relajada sin solape con match-3. Factibilidad
      ALTA. Score por movimientos restantes del presupuesto.
- [ ] **Memory / Concentration (Pares)** — 🟡 propuesto · cat: PUZZLE · fuente: a crear · 2026-06-24
      Razón: match por memoria (pairs), variante de MATCH que no compite con match-3. Factibilidad ALTA.
      Score por eficiencia (menos intentos y tiempo).

### Lote de 20 (2026-06-24) — ARCADE / LABERINTO / PLATAFORMA

- [ ] **Dig Dug** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: subgénero "cavar" (laberinto destructible generado por el jugador), inflar enemigos, rocas.
      Factibilidad ALTA, más barato que Pac-Man. Score por enemigo/roca/vegetal. ⭐ Destacado del bucket.
- [ ] **Donkey Kong (climbing)** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: primer plataformero genuino (gravedad, saltos, escaleras), categoría inexistente. Factibilidad
      media (física de salto + plataformas). Score por barril esquivado/martillo + bonus de tiempo.
- [ ] **Q\*bert** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: movimiento isométrico/diagonal + pintar el tablero, mecánica espacial ausente. Factibilidad
      media-alta (proyección iso con offsets). Score por cubo cambiado de color + bonus.
- [ ] **Bomberman (1 jugador)** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: laberinto táctico con bombas (bloques destructibles + gestión de riesgo de cadena). Factibilidad
      ALTA. Score por enemigo/bloque/power-up + bonus nivel. Segundo refuerzo de laberinto.
- [ ] **Lode Runner** — 🟡 propuesto · cat: ARCADE · fuente: a crear · 2026-06-24
      Razón: puzzle-plataforma de excavar + recolectar (dig + climb + sogas). Factibilidad media (estados de
      tile). Score por lingote de oro + enemigo atrapado + bonus nivel.

### Lote de 20 (2026-06-24) — SPORTS / RACING / REFLEJOS / MISC

- [ ] **Pong** — 🟡 propuesto · cat: SPORTS · fuente: a crear · 2026-06-24
      Razón: abre la categoría SPORTS (paleta vs CPU), arcade fundacional. Factibilidad ALTA. Score = rallies
      devueltos + puntos + bonus por velocidad de bola (acumulativo, no "primero a 11").
- [ ] **Flappy Bird** — 🟡 propuesto · cat: REFLEJOS · fuente: a crear · 2026-06-24
      Razón: mecánica one-button / reflejos con gravedad, ausente. Factibilidad ALTA (física trivial + AABB).
      Score = +1 por tubería. ⭐ Destacado del bucket por relación valor/coste.
- [ ] **Pinball** — 🟡 propuesto · cat: MISC/FÍSICAS · fuente: a crear · 2026-06-24
      Razón: física de rebotes con bumpers y flippers, scores altos para Hall of Fame. Factibilidad media
      (tuning de física). Score por bumper/objetivo + multiplicadores.
- [ ] **Top-Down Racer** — 🟡 propuesto · cat: RACING · fuente: a crear · 2026-06-24
      Razón: abre la categoría RACING (conducción cenital con derrape). Factibilidad media (aceleración/
      rozamiento/giro + checkpoints). Score = vueltas en tiempo límite o floor(1e6/mejorVuelta).
- [ ] **Helicopter / Cavern Flyer** — 🟡 propuesto · cat: REFLEJOS · fuente: a crear · 2026-06-24
      Razón: one-button con navegación por túnel que se estrecha, distinto del salto de Flappy. Factibilidad
      ALTA (cueva procedural). Score = distancia + bonus por obstáculos esquivados.
