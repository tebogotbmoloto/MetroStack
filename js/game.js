const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

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

const SHAPES = [
    { name: "I", shape: [[1, 1, 1, 1]], color: "#00FFFF" }, // Vivid Neon Cyan
    { name: "O", shape: [[1, 1], [1, 1]], color: "#FFEE00" }, // Electric Yellow
    { name: "T", shape: [[0, 1, 0], [1, 1, 1]], color: "#FF00FF" }, // Neon Magenta
    { name: "Z", shape: [[1, 1, 0], [0, 1, 1]], color: "#FF1744" }, // Bright Hot Red
    { name: "S", shape: [[0, 1, 1], [1, 1, 0]], color: "#00E676" }, // Neon Mint Green
    { name: "L", shape: [[1, 0, 0], [1, 1, 1]], color: "#00B0FF" }, // Bright Azure Blue
    { name: "J", shape: [[0, 0, 1], [1, 1, 1]], color: "#FF9100" }, // Vivid Tangerine
    { name: "P", shape: [[1, 1, 1], [1, 0, 1]], color: "#E040FB" }, // Bright Orchid
    { name: "R", shape: [[1, 1], [1, 0], [1, 1]], color: "#7C4DFF" }  // Electric Violet
];

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    color: "#ffffff"
};

const AudioCtor = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtor ? new AudioCtor() : null;

function ensureAudio() {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function playTone(freq, duration = 0.08, type = "sine", volume = 0.04, slide = 0) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide !== 0) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audioCtx.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playMoveSound() {
    ensureAudio();
    playTone(220, 0.05, "square", 0.025, 45);
}

function playRotateSound() {
    ensureAudio();
    playTone(330, 0.06, "triangle", 0.03, 80);
}

function playClearSound() {
    ensureAudio();
    playTone(500, 0.12, "triangle", 0.035, 120);
    setTimeout(() => playTone(660, 0.1, "triangle", 0.035, 140), 70);
}

function playGameOverSound() {
    ensureAudio();
    playTone(180, 0.18, "sawtooth", 0.05, -30);
    setTimeout(() => playTone(120, 0.22, "sawtooth", 0.05, -25), 120);
}

function playAdJingle() {
    ensureAudio();
    playTone(440, 0.1, "sine", 0.04, 100);
    setTimeout(() => playTone(554, 0.1, "sine", 0.04, 100), 100);
    setTimeout(() => playTone(659, 0.15, "sine", 0.04, 150), 200);
    setTimeout(() => playTone(880, 0.3, "sine", 0.05, 200), 350);
}

function resetBoard() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 500;
    dropCounter = 0;
    lastTime = 0;
    updateUI();
}

function startNewGame() {
    uiOverlay.innerHTML = "";
    resetBoard();
    gameOver = false;
    spawnPiece();
}

function spawnPiece() {
    const rand = Math.floor(Math.random() * SHAPES.length);
    const nextShape = SHAPES[rand];

    player.matrix = nextShape.shape.map(row => row.slice());
    player.color = nextShape.color;
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

    if (checkCollision()) {
        gameOver = true;
        player.matrix = null;
        playGameOverSound();
        showGameOverScreen();
    }
}

function checkCollision() {
    if (!player.matrix) return false;
    for (let r = 0; r < player.matrix.length; r++) {
        for (let c = 0; c < player.matrix[r].length; c++) {
            if (player.matrix[r][c] === 0) continue;

            const newX = player.pos.x + c;
            const newY = player.pos.y + r;

            if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
            if (newY >= 0 && grid[newY][newX] !== 0) return true;
        }
    }
    return false;
}

function mergePiece() {
    if (!player.matrix) return;
    player.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                const x = player.pos.x + c;
                const y = player.pos.y + r;

                if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                    grid[y][x] = player.color;
                }
            }
        });
    });
}

function clearLines() {
    let rowCount = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
        const fullRow = grid[r].every(cell => cell !== 0);
        if (!fullRow) continue;

        const removed = grid.splice(r, 1)[0];
        removed.fill(0);
        grid.unshift(removed);
        rowCount++;
        r++;
    }

    if (rowCount > 0) {
        lines += rowCount;
        score += rowCount * 100 * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 500 - (level - 1) * 40);
        playClearSound();
        updateUI();
    }
}

function playerDrop() {
    if (gameOver) return;
    player.pos.y += 1;

    if (checkCollision()) {
        player.pos.y -= 1;
        mergePiece();
        clearLines();
        if (!gameOver) {
            spawnPiece();
        }
    }

    dropCounter = 0;
}

function playerMove(dir) {
    if (gameOver) return;
    player.pos.x += dir;
    if (checkCollision()) {
        player.pos.x -= dir;
    } else {
        playMoveSound();
    }
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = matrix[r][c];
        }
    }

    return rotated;
}

function playerRotate() {
    if (gameOver || !player.matrix) return;
    const prevMatrix = player.matrix.map(row => row.slice());
    const prevX = player.pos.x;
    const rotated = rotateMatrix(player.matrix);

    player.matrix = rotated;

    let offset = 0;
    while (checkCollision()) {
        player.pos.x += 1;
        offset += 1;

        if (offset > 3) {
            player.matrix = prevMatrix;
            player.pos.x = prevX;
            return;
        }
    }

    playRotateSound();
}

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const normalized = clean.length === 3
        ? clean.split("").map(ch => ch + ch).join("")
        : clean;

    const num = parseInt(normalized, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function shadeColor(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const adjust = (channel) => Math.max(0, Math.min(255, channel + amount));
    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

function drawBlock(x, y, color) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    const topColor = color;
    const sideColor = shadeColor(color, -45);
    const faceColor = shadeColor(color, -85);

    ctx.save();
    ctx.fillStyle = topColor;
    ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

    ctx.fillStyle = sideColor;
    ctx.fillRect(px + BLOCK_SIZE - 6, py + 4, 4, BLOCK_SIZE - 8);
    ctx.fillRect(px + 2, py + BLOCK_SIZE - 6, BLOCK_SIZE - 6, 4);

    ctx.fillStyle = faceColor;
    ctx.fillRect(px + 2, py + BLOCK_SIZE - 6, BLOCK_SIZE - 6, 4);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(px + 4, py + 4, BLOCK_SIZE - 12, 5);

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px + 2.5, py + 2.5, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
    ctx.restore();
}

function draw() {
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== 0) {
                drawBlock(c, r, grid[r][c]);
            }
        }
    }

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
    uiScore.textContent = `R ${score}`;
    uiLevel.textContent = String(level);
    uiLines.textContent = String(lines);
}

function showStartScreen() {
    uiOverlay.innerHTML = '<button class="menuBtn" id="startBtn">START STACKING</button>';

    const startBtn = document.getElementById("startBtn");
    startBtn.addEventListener("click", () => {
        ensureAudio();
        startNewGame();
    });
}

function showGameOverScreen() {
    uiOverlay.innerHTML = `
        <div style="text-align: center; max-width: 260px;">
            <h2 style="color: #ff6b9a; font-size: 20px; margin-bottom: 10px;">ROUTE BLOCKED!</h2>
            <button class="menuBtn" id="reviveBtn" style="background: linear-gradient(135deg, #FFB14A, #FF78F0); margin-bottom: 10px;">🎬 WATCH AD TO REVIVE</button>
            <button class="menuBtn" id="restartBtn" style="font-size: 14px; padding: 10px;">TRY AGAIN</button>
        </div>
    `;

    const reviveBtn = document.getElementById("reviveBtn");
    reviveBtn.addEventListener("click", () => {
        ensureAudio();
        triggerAdRevive();
    });

    const restartBtn = document.getElementById("restartBtn");
    restartBtn.addEventListener("click", () => {
        ensureAudio();
        startNewGame();
    });
}

function triggerAdRevive() {
    uiOverlay.innerHTML = `
        <div style="text-align: center;">
            <h3 style="color: #00FFFF; font-size: 16px; margin-bottom: 8px;">SPONSORED PARTNER AD</h3>
            <p style="font-size: 12px; color: #aaa; margin-bottom: 15px;">Clearing traffic lane & staying on Level ${level}...</p>
            <div style="font-size: 24px; font-weight: bold; color: #FFEE00;" id="adTimer">3</div>
        </div>
    `;

    playAdJingle();
    let timeLeft = 3;
    const timerInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById("adTimer");
        if (timerEl) timerEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            for (let r = 3; r >= 0; r--) {
                grid.splice(r, 1);
                grid.unshift(Array(COLS).fill(0));
            }

            uiOverlay.innerHTML = "";
            gameOver = false;
            dropCounter = 0;
            spawnPiece();
        }
    }, 1000);
}

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
updateUI();
requestAnimationFrame(gameLoop);
