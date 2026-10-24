const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const overlay = document.getElementById('uiOverlay');

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const EMPTY = null;

const COLORS = {
  I: '#7dd3fc',
  O: '#facc15',
  T: '#c084fc',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c'
};

const SHAPES = {
  I: [
    [1, 1, 1, 1]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
};

let board;
let currentPiece;
let nextPiece;
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let lastTime = 0;
let isRunning = true;
let gameOver = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: SHAPES[type].map(row => [...row]),
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: -1
  };
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  nextPiece = randomPiece();
  currentPiece = null;
  spawnPiece();
  updateHud();
  hideOverlay();
  gameOver = false;
  isRunning = true;
  dropCounter = 0;
  lastTime = 0;
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

function collides(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;

      const boardX = offsetX + x;
      const boardY = offsetY + y;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }

  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;
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
  if (!currentPiece || gameOver) return;

  const rotated = rotateMatrix(currentPiece.matrix);
  const kickOffsets = [0, -1, 1, -2, 2];

  for (const offset of kickOffsets) {
    if (!collides(rotated, currentPiece.x + offset, currentPiece.y)) {
      currentPiece.matrix = rotated;
      currentPiece.x += offset;
      return;
    }
  }
}

function movePiece(dx, dy) {
  if (!currentPiece || gameOver) return false;

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

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(cell => cell !== EMPTY)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = Math.floor(lines / 10) + 1;
    updateHud();
  }
}

function updateHud() {
  scoreEl.textContent = `R ${score}`;
  levelEl.textContent = String(level);
  linesEl.textContent = String(lines);
}

function showOverlay(text) {
  overlay.textContent = text;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function endGame() {
  gameOver = true;
  isRunning = false;
  showOverlay('Game Over');
}

function getDropInterval() {
  return Math.max(120, 720 - (level - 1) * 60);
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = board[y][x];
      if (type) {
        drawCell(x, y, COLORS[type]);
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
        ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
      }
    }
  }

  if (currentPiece) {
    const ghostY = getGhostY();
    drawPiece(currentPiece.matrix, currentPiece.x, ghostY, 'rgba(255,255,255,0.12)', true);
    drawPiece(currentPiece.matrix, currentPiece.x, currentPiece.y, COLORS[currentPiece.type]);
  }
}

function getGhostY() {
  if (!currentPiece) return 0;
  let ghostY = currentPiece.y;
  while (!collides(currentPiece.matrix, currentPiece.x, ghostY + 1)) {
    ghostY += 1;
  }
  return ghostY;
}

function drawPiece(matrix, offsetX, offsetY, color, ghost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const drawX = offsetX + x;
      const drawY = offsetY + y;
      if (drawY < 0) return;

      if (ghost) {
        ctx.fillStyle = color;
        ctx.fillRect(drawX * BLOCK + 4, drawY * BLOCK + 4, BLOCK - 8, BLOCK - 8);
        return;
      }

      drawCell(drawX, drawY, color);
    });
  });
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (isRunning && !gameOver) {
    dropCounter += deltaTime;
    if (dropCounter > getDropInterval()) {
      if (!movePiece(0, 1)) {
        lockPiece();
      }
      dropCounter = 0;
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

function handleKeydown(event) {
  if (gameOver) {
    if (event.key === 'Enter' || event.key === ' ') {
      resetGame();
    }
    return;
  }

  switch (event.key) {
    case 'ArrowLeft':
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
      movePiece(1, 0);
      break;
    case 'ArrowDown':
      if (!movePiece(0, 1)) {
        lockPiece();
      }
      score += 1;
      updateHud();
      break;
    case 'ArrowUp':
      rotatePiece();
      break;
    case ' ':
      event.preventDefault();
      while (!movePiece(0, 1)) {
        break;
      }
      score += 2;
      updateHud();
      lockPiece();
      break;
    default:
      break;
  }
}

document.addEventListener('keydown', handleKeydown);

resetGame();
requestAnimationFrame(update);
