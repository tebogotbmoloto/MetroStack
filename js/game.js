// --- METROSTACK ENGINE ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const uiOverlay = document.getElementById("uiOverlay");

const uiScore = document.getElementById("score");
const uiLevel = document.getElementById("level");
const uiLines = document.getElementById("lines");

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let level = 1;
let lines = 0;
let gameOver = true;
let dropInterval = 500;
let dropCounter = 0;
let lastTime = 0;

// Tetromino Shapes & Colors (Quantum Vibe)
const SHAPES = [
    { shape: [[1, 1, 1, 1]], color: "#00f0ff" }, // I - Long Quantum
    { shape: [[1, 1], [1, 1]], color: "#facc15" }, // O - Speaker Stack
    { shape: [[0, 1, 0], [1, 1, 1]], color: "#a855f7" }, // T - Rank Junction
    { shape: [[1, 1, 0], [0, 1, 1]], color: "#ef4444" }, // Z - Sharp Curve
    { shape: [[0, 1, 1], [1, 1, 0]], color: "#22c55e" }, // S - Smooth Route
    { shape: [[1, 0, 0], [1, 1, 1]], color: "#38bdf8" }, // L - Mini-bus L
    { shape: [[0, 0, 1], [1, 1, 1]], color: "#f97316" }  // J - Mini-bus J
];

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    color: "#fff"
};

function spawnPiece() {
    const rand = Math.floor(Math.random() * SHAPES.length);
    player.matrix = SHAPES[rand].shape;
    player.color = SHAPES[rand].color;
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

    if (checkCollision()) {
        gameOver = true;
        showGameOverScreen();
    }
}

function checkCollision() {
    for (let r = 0; r < player.matrix.length; r++) {
        for (let c = 0; c < player.matrix[r].length; c++) {
            if (player.matrix[r][c] !== 0) {
                let newX = player.pos.x + c;
                let newY = player.pos.y + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && grid[newY][newX] !== 0) return true;
            }
        }
    }
    return false;
}

function mergePiece() {
    player.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                if (player.pos.y + r >= 0) {
                    grid[player.pos.y + r][player.pos.x + c] = player.color;
                }
            }
        });
    });
}

function clearLines() {
    let rowCount = 0;
    outer: for (let r = ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === 0) continue outer;
        }
        const row = grid.splice(r, 1)[0].fill(0);
        grid.unshift(row);
        r++;
        rowCount++;
    }
    if (rowCount > 0) {
        lines += rowCount;
        score += rowCount * 100 * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 500 - (level - 1) * 40);
        updateUI();
    }
}

function playerDrop() {
    player.pos.y++;
    if (checkCollision()) {
        player.pos.y--;
        mergePiece();
        clearLines();
        spawnPiece();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (checkCollision()) {
        player.pos.x -= dir;
    }
}

function playerRotate() {
    const prevX = player.pos.x;
    let offset = 1;
    
    // Rotate matrix
    const m = player.matrix;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
        }
    }
    m.forEach(row => row.reverse());

    while (checkCollision()) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > m[0].length) {
            // Undo rotation if no room
            m.forEach(row => row.reverse());
            for (let y = 0; y < m.length; ++y) {
                for (let x = 0; x < y; ++x) {
                    [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
                }
            }
            player.pos.x = prevX;
            return;
        }
    }
}

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
    
    // Inner bevel for slick arcade look
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, 4);
}

function draw() {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Stack
    grid.forEach((row, r) => {
        row.forEach((color, c) => {
            if (color !== 0) {
                drawBlock(c, r, color);
            }
        });
    });

    // Draw Active Piece
    if (!gameOver && player.matrix) {
        player.matrix.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    drawBlock(player.pos.x + c, player.pos.y + r, player.color);
                }
            });
        });
    }
}

function updateUI() {
    uiScore.innerText = `R ${score}`;
    uiLevel.innerText = level;
    uiLines.innerText = lines;
}

function showStartScreen() {
    uiOverlay.innerHTML = `<button class="menuBtn" id="startBtn">START STACKING</button>`;
    document.getElementById("startBtn").onclick = () => {
        uiOverlay.innerHTML = "";
        grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        score = 0;
        lines = 0;
        level = 1;
        updateUI();
        gameOver = false;
        spawnPiece();
    };
}

function showGameOverScreen() {
    uiOverlay.innerHTML = `
        <div style="text-align: center;">
            <h2 style="color: #ef4444; font-size: 22px; margin-bottom: 15px;">ROUTE BLOCKED!</h2>
            <button class="menuBtn" id="restartBtn">TRY AGAIN</button>
        </div>
    `;
    document.getElementById("restartBtn").onclick = () => {
        uiOverlay.innerHTML = "";
        grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        score = 0;
        lines = 0;
        level = 1;
        updateUI();
        gameOver = false;
        spawnPiece();
    };
}

// Controls
document.addEventListener("keydown", event => {
    if (gameOver) return;
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
        playerMove(-1);
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        playerMove(1);
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
        playerDrop();
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
        playerRotate();
    }
});

// Game Loop
function gameLoop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!gameOver) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

showStartScreen();
gameLoop();
