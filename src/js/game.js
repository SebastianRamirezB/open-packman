// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frightTimer: 0, // frames restantes de modo asustado; 0 = inactivo
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      released: false,       // aún no ha salido de la pen
      releaseDelay: i * 120, // frames a esperar antes de salir (escalonado)
      frightened: false,    // true mientras huye de Pac-Man
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer Power Pellet.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      game.frightTimer = 480;
      game.ghosts.forEach( ( g ) => {
        if ( g.released ) g.frightened = true;
      } );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige la direccion que minimiza la distancia Manhattan hacia un objetivo.
function chaseTarget( g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Elige la direccion que MAXIMIZA la distancia Manhattan a un objetivo (huida).
function fleeTarget( g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = -Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist > bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Fantasma asustado: huye maximizando distancia Manhattan a Pac-Man.
  if ( g.frightened ) {
    g.dir = fleeTarget( g, choices, px, py );
    return;
  }

  if ( g.kind === 'hunter' ) {
    g.dir = chaseTarget( g, choices, px, py );
  } else if ( g.kind === 'ambush' ) {
    const pd = DIRS[ p.dir ];
    g.dir = chaseTarget( g, choices, px + 4 * pd.x, py + 4 * pd.y );
  } else if ( g.kind === 'flank' ) {
    const hunter = game.ghosts.find( ( gh ) => gh.kind === 'hunter' );
    const pd = DIRS[ p.dir ];
    // vector desde el pivote (hunter) hasta pacman + 4 * DIRS[pacman.dir]
    const vx = ( px + 4 * pd.x ) - hunter.x;
    const vy = ( py + 4 * pd.y ) - hunter.y;
    g.dir = chaseTarget( g, choices, hunter.x + 2 * vx, hunter.y + 2 * vy );
  } else if ( g.kind === 'intermittent' ) {
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    if ( dist > 8 ) {
      g.dir = chaseTarget( g, choices, px, py );
    } else {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
  }
}

// Salida escalonada de la pen. Mientras released === false:
//   1) esperar releaseDelay (frames) sin moverse;
//   2) alinear horizontalmente a la columna de la puerta mas cercana
//      (13 o 14; la puerta esta en cols 13-14 de la fila 12);
//   3) subir recto y, al cruzar la fila de la puerta, marcar released = true.
function releaseFromPen( g ) {
  const doorCol = g.x < 14 ? 13 : 14;
  if ( g.x !== doorCol ) {
    g.dir = g.x < doorCol ? 'right' : 'left';
  } else {
    g.dir = 'up';
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    if ( !g.released ) {
      if ( g.releaseDelay > 0 ) {
        g.releaseDelay--;
        return;
      }
      releaseFromPen( g );
    } else {
      decideGhost( game, g );
    }

    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = g.frightened ? g.speed * 0.5 : g.speed;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );

  // Fila de la puerta = 12. Al cruzarla (g.y < 12) el fantasma ya esta fuera.
  if ( !g.released && g.y < 12 ) {
    g.released = true;
    // Si el timer sigue activo, el recién liberado tambien se asusta.
    if ( game.frightTimer > 0 ) g.frightened = true;
  }

  //Expiracion del modo asustado.
  if ( g.frightened && game.frightTimer <= 0 ) g.frightened = false;
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frightTimer = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    g.releaseDelay = i * 120;
    g.frightened = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      if ( g.frightened ) {
        // Fantasma comido: reaparece en la pen, sin restar vida.
        game.score += 200;
        const i = game.ghosts.indexOf( g );
        g.x = GHOST_STARTS[ i ].x;
        g.y = GHOST_STARTS[ i ].y;
        g.dir = 'up';
        g.released = false;
        g.releaseDelay = 60;
        g.frightened = false;
      } else {
        game.lives--;
        if ( game.lives <= 0 ) {
          game.state = 'lost';
          game.frightTimer = 0;
          game.ghosts.forEach( ( g ) => { g.frightened = false; } );
          return;
        }
        resetPositions( game );
        break;
      }
    }
  }

  if ( game.dotsRemaining <= 0 ) {
    game.state = 'won';
    game.frightTimer = 0;
    game.ghosts.forEach( ( g ) => { g.frightened = false; } );
  }

  // Decrementar timer de modo asustado (al final, tras mover y colisionar).
  if ( game.frightTimer > 0 ) game.frightTimer--;
  // Al expirar: todos los fantasmas vuelven a estado normal.
  if ( game.frightTimer === 0 ) {
    game.ghosts.forEach( ( g ) => { g.frightened = false; } );
  }
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
