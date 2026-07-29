# SPEC 02 — Power Pellets y fantasmas vulnerables

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-07-29
> **Objetivo:** Añadir 4 Power Pellets en las esquinas del laberinto que, al ser comidas, vuelven a los fantasmas vulnerables (lentos y huidizos) durante 8 segundos, permitiendo a Pac-Man comerlos para sumar 200 puntos y hacerlos reaparecer en la pen.

## Scope

**In:**

- Nuevo valor de celda `4` (Power Pellet) con char `o` en `parseTile`, en `src/js/maze.js`.
- 4 Power Pellets colocados en las esquinas interiores del laberinto (celdas transitables cercanas a las esquinas), editando los strings de `MAZE_STR`.
- Nuevo estado por fantasma `frightened` en `game.ghosts` y temporizador global `frightTimer` en `game`.
- Al comer un Power Pellet: celda → `0`, `score += 50`, `dotsRemaining--`, `frightTimer = 480`, todos los fantasmas `released` pasan a `frightened = true` y velocidad reducida (`GHOST_SPEED * 0.5`).
- IA de `frightened`: elegir dirección (entre las válidas, sin contar el reverso) que **maximice** la distancia Manhattan a Pac-Man (huida).
- Colisión Pac-Man vs fantasma `frightened`: `score += 200`, fantasma reaparece en `GHOST_STARTS[i]` con `released=false` y `releaseDelay=60`.
- Render en `src/js/render.js`: Power Pellet como círculo grande; fantasmas `frightened` en color azul (o blanco parpadeante durante los últimos 120 frames del timer).
- Reset de `frightTimer` y `frightened` al ganar (`won`) o perder (`lost`).

**Out of scope (para futuros specs):**

- Modo "ojos" navegando de vuelta a la pen tras ser comido (el fantasma teleporta a la pen).
- Multiplicador 200/400/800/1600 por varios fantasmas en el mismo Power Pellet (puntuación fija de 200 por fantasma).
- Fruta bonus.
- Reset de Power Pellets entre niveles (no hay multi-nivel todavía).
- Sonidos.

## Data model

```js
// src/js/maze.js — nuevo valor de celda
//   parseTile: 'o' -> 4 (Power Pellet)
// MAZE_STR cambia 4 celdas transitables con '.' por 'o' en las esquinas
//   interiores (posiciones orientativas, revisar en implementación):
//   (1,3), (26,3), (1,23), (26,23)

// src/js/game.js — estado del juego y de cada fantasma
const game = {
  // ... campos existentes ...
  frightTimer: 0, // frames restantes de modo asustado; 0 = inactivo
};

const ghost = {
  // ... campos existentes (x, y, dir, speed, kind, released, releaseDelay) ...
  frightened: false, // true mientras huye de Pac-Man
};
```

**Convenciones:**

- Coordenadas: origen top-left, igual que el resto del proyecto.
- `frightTimer` se cuenta en frames globales del juego (no por fantasma).
- Velocidad del fantasma `frightened` = `GHOST_SPEED * 0.5` (se aplica al mover; no se persiste en `g.speed`).
- Comer un Power Pellet cuando `frightTimer > 0` reinicia el timer a 480 (apilado).
- Fantasma comido reaparece con `released=false`, `releaseDelay=60`, `frightened=false`.

## Implementation plan

1. Editar `src/js/maze.js`: añadir `'o' -> 4` en `parseTile` y reemplazar 4 dots por `o` en las esquinas interiores de `MAZE_STR` (manteniendo la simetría vertical entre cols 13/14). Test manual: abrir `index.html`, las 4 esquinas muestran dots grandes; la consola no muestra errores.

2. Editar `createGame` en `src/js/game.js`: añadir `frightTimer: 0` al estado y `frightened: false` a cada fantasma en el `.map()`. Recuento de `dotsRemaining`: incluir las celdas `=== 4` (o contarlas como dots). Test manual: recargar, los 4 Power Pellets aparecen y el contador de dots restantes los incluye.

3. Editar `movePacman` en `src/js/game.js`: al alinear celda, si `grid[y][x] === 4` → `grid[y][x] = 0`, `score += 50`, `dotsRemaining--`, `frightTimer = 480`, y marcar `frightened = true` en todos los fantasmas con `released === true`. Test manual: comer un Power Pellet, los fantasmas sueltos cambian a color azul en `render.js` (siguiente paso lo pinta).

4. Añadir lógica de `frightened` en `moveGhost`/`decideGhost` en `src/js/game.js`:
   - Si `game.frightTimer > 0` y `g.released && !g.frightened` → marcar `frightened = true` (cubrir fantasmas que salen de la pen durante el timer).
   - Si `g.frightened`: elegir dirección que **maximice** Manhattan a Pac-Man entre las válidas (sin reverso); en callejón, permitir reverso como hoy. Velocidad efectiva = `GHOST_SPEED * 0.5`.
   - Al expirar `frightTimer == 0`: `frightened = false` en todos los fantasmas.
   Test manual: durante 8 s los fantasmas huyen; al expirar vuelven a su IA normal.

5. Editar la colisión en `update` en `src/js/game.js`: si `collides(pacman, g)` y `g.frightened` → `score += 200`, `g` reaparece en `GHOST_STARTS[i]` con `released=false`, `releaseDelay=60`, `frightened=false` (no resta vida). Si `g.frightened === false` → comportamiento actual (resta vida / reset). Test manual: comer un fantasma asustado suma 200 y lo hace reaparecer; tocar uno no asustado resta vida.

6. Decrementar `frightTimer` en `update` (al final, tras mover): si `> 0`, `frightTimer--`. Reset a `0` y `frightened=false` en todos los fantasmas al entrar en `won`/`lost`. Test manual: el timer expira solo; al ganar/perder, recargar partida deja fantasmas en estado normal.

7. Editar `src/js/render.js`:
   - En `drawDots` (o nueva `drawPowerPellets`): celdas `=== 4` se dibujan como círculo mayor (radio ~6, parpadeo opcional con `frame`).
   - En `drawGhost`: si `g.frightened`, usar color azul `#2121ff` (o blanco en parpadeo de los últimos 120 frames: `frame % 16 < 8 && game.frightTimer < 120`); ojos/pupilas en estilo asustado (opcionales).
   - `draw` accede a `game.frightTimer` para el parpadeo.
   Test manual: visuales de los 4 estados (normal, asustado azul, parpadeo blanco, fantasma comido).

8. Verificación final: abrir `src/index.html`, comer 4 Power Pellets, comer fantasmas, dejar expirar el timer, ganar y perder; comprobar criterios de aceptación.

## Acceptance criteria

- [ ] `parseTile` en `src/js/maze.js` mapea `'o'` a `4`.
- [ ] `MAZE_STR` contiene exactamente 4 caracteres `'o'` en posiciones simétricas respecto al eje entre cols 13/14.
- [ ] `createGame` inicializa `game.frightTimer = 0` y cada fantasma con `frightened: false`.
- [ ] `dotsRemaining` al iniciar una partida incluye los 4 Power Pellets.
- [ ] Comer un Power Pellet pone `grid[y][x] = 0`, suma 50 puntos, decrementa `dotsRemaining` y fija `frightTimer = 480`.
- [ ] Mientras `frightTimer > 0`, los fantasmas sueltos tienen `frightened === true` y se mueven a `GHOST_SPEED * 0.5`.
- [ ] El fantasma `frightened` elige la dirección que maximiza la distancia Manhattan a Pac-Man.
- [ ] Comer un segundo Power Pellet antes de expirar reinicia `frightTimer` a 480.
- [ ] Comer un fantasma `frightened` suma 200 puntos y lo hace reaparecer en `GHOST_STARTS[i]` con `released=false`, `releaseDelay=60`, `frightened=false`.
- [ ] Comer un fantasma `frightened` no resta vida.
- [ ] Tocar un fantasma no `frightened` resta una vida (comportamiento de SPEC 01).
- [ ] Al expirar `frightTimer` (llega a 0), todos los fantasmas vuelven a `frightened = false` y a su velocidad normal.
- [ ] En `render.js`, los Power Pellets se dibujan distintos a los dots normales.
- [ ] En `render.js`, los fantasmas `frightened` se dibujan en azul (y parpadean a blanco en los últimos 120 frames del timer).
- [ ] Al ganar o perder, `frightTimer` se resetea y los fantasmas quedan `frightened = false`.
- [ ] La consola del navegador no muestra errores al cargar `src/index.html`.

## Decisions

- **Sí:** nuevo valor de celda `4` y char `o`. Reutiliza el mismo mecanismo de `parseTile` y `MAZE_STR`; no introduce un sistema paralelo.
- **Sí:** 4 Power Pellets en las 4 esquinas interiores. Fiel al arcade y cubre el mapa simétricamente.
- **Sí:** duración 480 frames (8 s @ 60 fps). Concuerda con la petición explícita del usuario (más larga que el arcade clásico para MVP).
- **Sí:** puntuación fija de 200 por fantasma. Más simple que el multiplicador 200/400/800/1600; el multiplicador se deja para otra spec si se quiere.
- **Sí:** IA de huida maximizando Manhattan. Noble, barata y consistente con el `chaseTarget` existente (reutilizable con signo invertido).
- **Sí:** velocidad reducida a `GHOST_SPEED * 0.5` en `frightened`. Fiel al arcade; da tiempo a cazar.
- **Sí:** reaparición inmediata en la pen con `releaseDelay=60`. SPEC 01 dejó fuera la "IA de regreso a la pen"; teleportar es la opción más barata y no trivializa el juego.
- **Sí:** apilado del timer (reinicia a 480 al comer otra pellet). Comportamiento arcade clásico.
- **Sí:** parpadeo visual en los últimos 120 frames. Aviso al jugador sin coste extra.
- **Sí:** `dotsRemaining` incluye los Power Pellets. No partir de un sistema de contadores paralelos.
- **No:** modo "ojos". Fuera de scope; el fantasma teleporta a la pen.
- **No:** multiplicador de puntos por fantasma. Punto fijo de 200.
- **No:** Power Pellets que reaparecen. No hay multi-nivel todavía.

## Risks

| Riesgo                                                            | Mitigación                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Fantasmas salen de la pen durante `frightTimer` y quedan no asustados | Paso 4 del plan marca `frightened=true` a los recién liberados si el timer sigue activo.                              |
| Manhattan de huida puede meter al fantasma en callejones          | Misma lógica de callejón (reverso permitido) que en `decideGhost`; no garantiza escape, sólo guía.                  |
| Power Pellet contado doble en `dotsRemaining`                    | Criterio de aceptación explícito: 4 celdas `o` y `dotsRemaining` las cuenta una sola vez.                             |
| Parpadeo de los últimos 120 frames mal sincronizado con `frame`   | Usar `frame % 16 < 8` en `render.js` con `game.frightTimer < 120`; validación visual en el paso 7.                    |
| Olvidar reset de `frightened` al ganar/perder                    | Paso 6 del plan y criterio de aceptación explícito; reset en el bloque `won`/`lost` de `update`.                     |

## What is **not** in this spec

- Modo "ojos" navegando de vuelta a la pen tras ser comido (teleporta).
- Multiplicador 200/400/800/1600 por varios fantasmas en el mismo Power Pellet.
- Fruta bonus.
- Reset/reaparición de Power Pellets entre niveles (no hay multi-nivel).
- Sonidos.
- Cambios de dificultad por nivel.

Cada uno de esos puntos, si aterriza, va en su propia spec.