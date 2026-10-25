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
let isPaused = false;
let dropInterval = 500;
let dropCounter = 0;
let lastTime = 0;

// Maximum brightness & saturation neon colors
const SHAPES = [
    { name: "I", shape: [[1, 1, 1, 1]], color: "#00FFFF" }, // Cyan Neon
    { name: "O", shape: [[1, 1], [1, 1]], color: "#FFFF00" }, // Bright Yellow
    { name: "T", shape: [[0, 1, 0], [1, 1, 1]], color: "#FF00FF" }, // Magenta Neon
    { name: "Z", shape: [[1, 1, 0], [0, 1, 1]], color: "#FF0055" }, // Hot Neon Red
    { name: "S", shape: [[0, 1, 1], [1, 1, 0]], color: "#00FF55" }, // Neon Green
    { name: "L", shape: [[1, 0, 0], [1, 1, 1]], color: "#0088FF" }, // Electric Blue
    { name: "J", shape: [[0, 0, 1], [1, 1, 1]], color: "#FF6600" }, // Bright Orange
    { name: "P", shape: [[1, 1, 1], [1, 0, 1]], color: "#CC00FF" }, // Vivid Purple
    { name: "R", shape: [[1, 1], [1, 0], [1, 1]], color: "#7700FF" }  // Deep Neon Violet
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
    isPaused = false;
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
        isPaused = false;
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
    if (gameOver || isPaused) return;
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
    if (gameOver || isPaused) return;
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
    if (gameOver || isPaused || !player.matrix) return;
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

function drawBlock(x, y, color) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    ctx.save();
    // High-intensity neon aura glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;

    // Solid vivid neon fill
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    // Brilliant white inner core for extreme brightness and clarity
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(px + 4, py + 4, BLOCK_SIZE - 8, 4);

    // Crisp high-contrast outer border
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    
    ctx.restore();
}

function draw() {
    ctx.fillStyle = "#020611";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== 0) {
                drawBlock(c, r, grid[r][c]);
            }
        }
    }

    if (!gameOver && !isPaused && player.matrix) {
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
    uiOverlay.innerHTML = `
        <div class="revivedPanel">
            <button class="menuBtn" id="startBtn">START STACKING</button>
        </div>
    `;

    const startBtn = document.getElementById("startBtn");
    startBtn.addEventListener("click", () => {
        ensureAudio();
        startNewGame();
    });
}

function togglePause() {
    if (gameOver) return;

    isPaused = !isPaused;

    if (isPaused) {
        uiOverlay.innerHTML = `
            <div class="revivedPanel">
                <h2 style="color: var(--cyan); margin-bottom: 12px; font-size: 20px;">GAME PAUSED</h2>
                <div class="reviveActions">
                    <button class="menuBtn" id="resumeBtn">RESUME</button>
                    <button class="menuBtn secondaryBtn" id="quitBtn">MAIN MENU</button>
                </div>
            </div>
        `;

        document.getElementById("resumeBtn").addEventListener("click", () => {
            togglePause();
        });

        document.getElementById("quitBtn").addEventListener("click", () => {
            isPaused = false;
            gameOver = true;
            uiOverlay.innerHTML = "";
            showStartScreen();
        });
    } else {
        uiOverlay.innerHTML = "";
        lastTime = performance.now();
    }
}

function showGameOverScreen() {
    uiOverlay.innerHTML = `
        <div class="revivedPanel">
            <h2 style="color: var(--pink); margin-bottom: 12px; font-size: 20px;">ROUTE BLOCKED!</h2>
            <div class="reviveActions">
                <button class="menuBtn" id="reviveBtn">🎬 WATCH AD TO REVIVE</button>
                <button class="menuBtn secondaryBtn" id="restartBtn">TRY AGAIN</button>
            </div>
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
        <div class="revivedPanel">
            <h2 style="color: var(--cyan); font-size: 16px; margin-bottom: 6px;">SPONSORED PARTNER AD</h2>
            <p class="statLabel" style="margin-bottom: 12px;">Resetting board on Level ${level}...</p>
            <div class="adBar">
                <div class="adProgress" id="adProgress" style="transition: width 10s linear;"></div>
            </div>
            <div style="font-size: 28px; font-weight: bold; color: var(--yellow); margin-top: 10px;" id="adTimer">10</div>
        </div>
    `;

    playAdJingle();
    
    setTimeout(() => {
        const bar = document.getElementById("adProgress");
        if (bar) bar.style.width = "0%";
    }, 50);

    let timeLeft = 10;
    const timerInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById("adTimer");
        if (timerEl) timerEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            // Full board reset from bottom, keeping current level and score intact!
            grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

            uiOverlay.innerHTML = "";
            gameOver = false;
            isPaused = false;
            dropCounter = 0;
            spawnPiece();
        }
    }, 1000);
}

document.addEventListener("keydown", event => {
    if (event.code === "KeyP" || event.code === "Escape") {
        togglePause();
        return;
    }

    if (gameOver || isPaused) return;

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

    if (!gameOver && !isPaused) {
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
