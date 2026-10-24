const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('uiOverlay');

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const EMPTY = 0;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const COLORS = {
  I: '#38bdf8',
  O: '#facc15',
  T: '#c084fc',
  S: '#4ade80',
  Z: '#fb7185',
  J: '#60a5fa',
  L: '#f97316'
};

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let score = 0;
let bestScore = Number(localStorage.getItem('metrostack-best') || 0);
let lines = 0;
let level = 1;
let combo = 0;
let dropInterval = 700;
let dropAccumulator = 0;
let lastTime = 0;
let started = false;
let paused = false;
let gameOver = false;
let touchStart = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: cloneMatrix(SHAPES[type]),
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: -1
  };
}

function updateHud() {
  scoreEl.textContent = `R ${score}`;
  levelEl.textContent = String(level);
  linesEl.textContent = String(lines);
  bestEl.textContent = `R ${bestScore}`;
  comboEl.textContent = `x${combo}`;
}

function hideOverlay() {
  overlay.classList.remove('visible');
  overlay.innerHTML = '';
}

function showOverlay(title, subtitle, buttonText, callback) {
  overlay.innerHTML = `
    <div class="overlayCard">
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <button id="overlayBtn" class="menuBtn">${buttonText}</button>
    </div>
  `;
  overlay.classList.add('visible');

  const btn = document.getElementById('overlayBtn');
  btn.addEventListener('click', callback);
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  dropInterval = 700;
  dropAccumulator = 0;
  lastTime = 0;
  paused = false;
  gameOver = false;
  started = true;
  nextPiece = randomPiece();
  spawnPiece();
  updateHud();
  hideOverlay();
}

function spawnPiece() {
  currentPiece = nextPiece || randomPiece();
  currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
  currentPiece.y = -1;
  nextPiece = randomPiece();

  if (collides(currentPiece.matrix, currentPiece.x, currentPiece.y)) {
    endGame();
  }
}

function collides(matrix, x, y) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;

      const boardX = x + col;
      const boardY = y + row;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX] !== EMPTY) return true;
    }
  }
  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + colIndex;
      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.type;
      }
    });
  });
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
}

function rotatePiece() {
  if (!currentPiece || gameOver || paused) return;

  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collides(rotated, currentPiece.x + kick, currentPiece.y)) {
      currentPiece.matrix = rotated;
      currentPiece.x += kick;
      return;
    }
  }
}

function movePiece(dx, dy) {
  if (!currentPiece || !started || gameOver || paused) return false;

  if (!collides(currentPiece.matrix, currentPiece.x + dx, currentPiece.y + dy)) {
    currentPiece.x += dx;
    currentPiece.y += dy;
    return true;
  }

  if (dy > 0) {
    lockPiece();
  }

  return false;
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
  updateHud();
}

function clearLines() {
  let cleared = 0;

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(cell => cell !== EMPTY)) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      row += 1;
    }
  }

  if (cleared > 0) {
    combo += 1;
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level * combo;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 700 - (level - 1) * 55);
    updateHud();
  } else {
    combo = 0;
    updateHud();
  }
}

function endGame() {
  started = false;
  gameOver = true;
  bestScore = Math.max(bestScore, score);
  localStorage.setItem('metrostack-best', String(bestScore));
  updateHud();
  showOverlay('ROUTE BLOCKED!', `BEST: R ${bestScore} | COMBO: x${combo}`, 'TRY AGAIN', resetGame);
}

function drawCell(x, y, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, 4);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
  ctx.restore();
}

function drawGhost() {
  if (!currentPiece) return;

  let ghostY = currentPiece.y;
  while (!collides(currentPiece.matrix, currentPiece.x, ghostY + 1)) {
    ghostY += 1;
  }

  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const drawX = currentPiece.x + colIndex;
      const drawY = ghostY + rowIndex;
      if (drawY >= 0) {
        drawCell(drawX, drawY, 'rgba(255,255,255,0.12)', 0.85);
      }
    });
  });
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
    }
  }

  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== EMPTY) {
        drawCell(x, y, COLORS[cell]);
      }
    });
  });

  if (currentPiece && started) {
    drawGhost();
    currentPiece.matrix.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) return;
        const drawX = currentPiece.x + colIndex;
        const drawY = currentPiece.y + rowIndex;
        if (drawY >= 0) {
          drawCell(drawX, drawY, COLORS[currentPiece.type]);
        }
      });
    });
  }
}

function playerDrop() {
  if (!started || gameOver || paused) return;

  if (!movePiece(0, 1)) {
    lockPiece();
  } else {
    score += 1;
    updateHud();
  }
}

function handleKeydown(event) {
  if (!started || gameOver) return;

  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
      movePiece(1, 0);
      break;
    case 'ArrowDown':
    case 's':
      playerDrop();
      break;
    case 'ArrowUp':
    case 'w':
      rotatePiece();
      break;
    case ' ':
      event.preventDefault();
      while (!movePiece(0, 1)) {
        break;
      }
      score += 2;
      updateHud();
      break;
    case 'p':
      paused = !paused;
      break;
    default:
      break;
  }
}

function handleTouchStart(event) {
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!started || gameOver || !touchStart) return;

  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) movePiece(-1, 0);
    if (dx > 0) movePiece(1, 0);
  } else {
    if (dy > 20) {
      playerDrop();
    } else if (dy < -20) {
      rotatePiece();
    }
  }

  touchStart = null;
}

function gameLoop(timestamp = 0) {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  if (started && !paused && !gameOver) {
    dropAccumulator += deltaTime;
    if (dropAccumulator >= dropInterval) {
      playerDrop();
      dropAccumulator = 0;
    }
  }

  drawBoard();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', handleKeydown);
canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

showOverlay('METROSTACK', 'QUANTUM EDITION', 'START ROUTE', resetGame);
updateHud();
requestAnimationFrame(gameLoop);
