# SPEC 01 — Cuatro fantasmas con IA distintas

> **Estado:** Approved
> **Depende de:** —
> **Fecha:** 2026-07-27
> **Objetivo:** Ampliar el reparto a 4 fantasmas con comportamientos distintos (agresivo, emboscada, flanqueo e intermitente) que salen gradualmente de la pen, reutilizando el `hunter` actual como fantasma agresivo.

## Scope

**In:**

- Pasar `GHOST_STARTS` de 2 a 4 entradas, los 4 juntos dentro de la pen.
- Definir 4 `kind` distintos: `hunter` (agresivo actual), `ambush`, `flank`, `intermittent`.
- Reescribir `decideGhost` en `src/js/game.js` con un branch por `kind`.
- Salida escalonada de la pen vía campos `released` (bool) y `releaseDelay` (número de frames) por fantasma.
- Asignar un color distinto por `kind` en `src/js/render.js`.

**Out of scope (para futuros specs):**

- Scatter mode (alternancia de objetivo contra esquina fija por temporizador global).
- Power-ups / energizers que vuelven azules y comestibles a los fantasmas.
- IA con pathfinding real (A*, BFS). Se mantiene la decisión greedy por distancia Manhattan heredada del `hunter`.
- Cambios de dificultad por nivel o multi-nivel.
- Nuevo arte/sprites de fantasmas (siguen siendo las figuras actuales de `render.js`).
- IA de regreso a la pen tras ser comidos.

## Data model

```js
// src/js/maze.js — GHOST_STARTS pasa a 4 entradas (kinds en inglés,
// consistente con los existentes 'hunter' / 'random' actuales)
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter' },       // agresivo (reutiliza el actual)
  { x: 13, y: 14, kind: 'ambush' },       // emboscada (Pinky)
  { x: 14, y: 14, kind: 'flank' },        // flanqueo (Inky)
  { x: 15, y: 14, kind: 'intermittent' }, // intermitente (Clyde)
];

// src/js/game.js — cada fantasma gana dos campos relacionados con la salida
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  x: g.x,
  y: g.y,
  dir: 'up',
  speed: GHOST_SPEED,
  kind: g.kind,
  released: false,         // aún no ha salido de la pen
  releaseDelay: i * 120,   // frames a esperar antes de salir (escalonado)
} ) )
```

**Convenciones:**
- Coordenadas: origen top-left, igual que el resto del proyecto.
- `releaseDelay` se cuenta en frames desde el inicio de la partida.
- El `kind` `random` (usado hasta ahora) desaparece; el índice 1 se reemplaza por `ambush`.

## Implementation plan

1. Editar `src/js/maze.js`: reemplazar las 2 entradas de `GHOST_STARTS` por las 4 nuevas con kinds `hunter`, `ambush`, `flank`, `intermittent`. Test manual: abrir `index.html`, no debe romper nada (los 2 primeros fantasmas siguen moviéndose como hasta ahora).

2. Editar `createGame` en `src/js/game.js`: añadir `released: false` y `releaseDelay: i * 120` a cada fantasma en el `.map()`. Test manual: recargar, los 4 fantasmas aparecen en la pen.

3. Añadir rutina de salida de la pen en `moveGhost`: si `released === false`, decrementar/comprobar `releaseDelay`; una vez cumplido, dirigir al fantasma hacia arriba hasta salir de la fila de la puerta (casilla `3` o celda inmediatamente arriba), y al cruzarla marcar `released = true`. Test manual: los 4 fantasmas salen escalonadamente por la puerta.

4. Refactorizar `decideGhost` en `src/js/game.js`:
   - Mantener el branch `hunter` tal cual está hoy (distancia Manhattan contra celda de Pac-Man).
   - `ambush`: objetivo = celda `pacman + 4 * DIRS[pacman.dir]`; elegir la dirección que minimiza Manhattan hacia ese objetivo.
   - `flank`: pivot = posición del fantasma `hunter` en `game.ghosts`; vector desde pivot hasta `pacman + 4 * DIRS[pacman.dir]`; objetivo = pivot + 2 * vector; minimizar Manhattan hacia ese objetivo.
   - `intermittent`: si Manhattan(ghost, pacman) > 8 → comportarse como `hunter`; si no → elegir dirección aleatoria entre las opciones (mismo código que el `random` actual).
   - Eliminar el branch suelto `else` (random actual) y la referencia al `kind === 'random'`.
   Test manual: observar que cada fantasma tienen trayectoria distinta tras salir.

5. Editar `src/js/render.js`: añadir un map `GHOST_COLORS` por `kind` (4 colores distintos, p. ej. rojo, rosa, cian, naranja, al estilo arcade) y usarlo al dibujar cada fantasma. Test manual: los 4 fantasmas ven pintados con su color, constante por kind en toda la partida.

6. Verificación final: abrir `src/index.html`, completar la partida o perder; comprobar criterios de aceptación.

## Acceptance criteria

- [ ] `GHOST_STARTS` en `src/js/maze.js` contiene exactamente 4 entradas con kinds `hunter`, `ambush`, `flank`, `intermittent`.
- [ ] `game.ghosts` tiene 4 elementos al iniciar una partida.
- [ ] Cada fantasma tiene los campos `released` (booleano) y `releaseDelay` (número).
- [ ] Al iniciar, los 4 fantasmas están dentro de la pen en sus celdas de inicio.
- [ ] Los 4 fantasmas salen escalonadamente: al menos 2 salidas ocurren en frames distintos (no todos a la vez).
- [ ] El fantasma `hunter` mantiene su comportamiento actual (persigue la celda de Pac-Man con distancia Manhattan).
- [ ] El fantasma `ambush` selecciona dirección minimizando Manhattan hacia la celda `pacman + 4 * DIRS[pacman.dir]`.
- [ ] El fantasma `flank` usa la posición del fantasma `hunter` como pivote para calcular su objetivo.
- [ ] El fantasma `intermittent` persigue a Pac-Man si su distancia Manhattan > 8; si no, elige dirección aleatoria entre las disponibles.
- [ ] `src/js/render.js` dibuja cada fantasma con un color distinto, constante por `kind`.
- [ ] No quedan referencias al `kind === 'random'` en `src/js/`.
- [ ] La consola del navegador no muestra errores al cargar `src/index.html`.

## Decisions

- **Sí:** reutilizar el `hunter` actual como fantasma agresivo. Ya persigue con Manhattan y funciona; reescribirlo ganaría riesgo sin valor.
- **No:** introducir un nuevo comportamiento agresivo tipo "predecir celda futura de Pac-Man". Desbalancearía más que el `hunter` actual.
- **Sí:** sustituir el `kind` `random` por `intermittent` (Clyde clásico). El `random` puro no aporta identidad de personaje.
- **Sí:** kinds en inglés (`hunter`, `ambush`, `flank`, `intermittent`). Mantiene la convención de los kinds existentes.
- **No:** A*/BFS. Mantener la decisión greedy por Manhattan como en `hunter`. Más simple y suficiente para MVP.
- **Sí:** salida escalonada vía `releaseDelay` en frames (`i * 120`). Sin temporizadores ni relojes externos.
- **No:** salida inmediata de los 4. Acorralaría al jugador al inicio.
- **Sí:** colores por `kind` en `render.js`. Coste mínimo y necesario para verificar visualmente los comportamientos.
- **No:** scatter mode (cambio de objetivo a esquina fija por temporizador global). Merce otra spec; fuera de scope.
- **Sí:** definir el comportamiento de salida de la pen como un miniestado previo a `released = true`. No existía y es necesario para que los fantasmas abandonen la pen en orden.

## Risks

| Riesgo                                                                      | Mitigación                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Los 4 fantasmas acorralan a Pac-Man en un mapa pequeño                     | Salida escalonada + `GHOST_SPEED` (0.1) menor que `PACMAN_SPEED` (0.125) ya le da ventaja al jugador.                |
| El `flank` depende del `hunter`; si este está muy lejos el objetivo es raro | Aceptable: el objetivo sigue siendo una celda válida del grid; el algoritmo sólo guía, no garantiza atrapar.        |
| Fantasmas quedan atascados dentro de la pen si la salida no pasa por la puerta | Paso 3 del plan de implementación trata explícitamente el cruce de la fila de la puerta antes de `released = true`. |
| Renombrar/eliminar `random` puede romper referencias antiguas               | Criterio de aceptación explícito: ninguna referencia a `kind === 'random'` debe quedar en `src/js/`.                  |

## What is **not** in this spec

- Scatter mode (objetivo en esquina fija por temporizador global).
- Power-ups / energizers que vuelvan azules y comestibles a los fantasmas.
- IA con pathfinding (A*, BFS).
- Modo multi-nivel o dificultad creciente por nivel.
- Nuevo sprite art de los fantasmas.
- IA de regreso a la pen tras ser comidos.

Cada uno de esos puntos, si aterriza, va en su propia spec.