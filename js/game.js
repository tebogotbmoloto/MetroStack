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

// High-vibrancy arcade color theme mapping (matching your reference image gradients)
const SHAPES = [
    { name: "I", shape: [[1, 1, 1, 1]], color1: "#00F0FF", color2: "#0077FF" }, // Cyan
    { name: "O", shape: [[1, 1], [1, 1]], color1: "#FFEE00", color2: "#FF8800" }, // Gold/Yellow
    { name: "T", shape: [[0, 1, 0], [1, 1, 1]], color1: "#FF00FF", color2: "#8800FF" }, // Magenta
    { name: "Z", shape: [[1, 1, 0], [0, 1, 1]], color1: "#FF2244", color2: "#990011" }, // Red
    { name: "S", shape: [[0, 1, 1], [1, 1, 0]], color1: "#00FF66", color2: "#009933" }, // Lime Green
    { name: "L", shape: [[1, 0, 0], [1, 1, 1]], color1: "#3399FF", color2: "#0033CC" }, // Blue
    { name: "J", shape: [[0, 0, 1], [1, 1, 1]], color1: "#FF7700", color2: "#CC3300" }, // Orange
    { name: "P", shape: [[1, 1, 1], [1, 0, 1]], color1: "#EE44FF", color2: "#7700AA" }, // Purple
    { name: "R", shape: [[1, 1], [1, 0], [1, 1]], color1: "#AA44FF", color2: "#440099" }  // Violet
];

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    color1: "#00FFFF",
    color2: "#0077FF"
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
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 500;
    dropCounter = 0;
    lastTime = 0;
    updateUI();
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (typeof showStartScreen === 'function') showStartScreen();
});

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
    player.color1 = nextShape.color1;
    player.color2 = nextShape.color2;
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
            if (newY >= 0 && grid[newY][newX] !== null) return true;
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
                    grid[y][x] = { color1: player.color1, color2: player.color2 };
                }
            }
        });
    });
}

function clearLines() {
    let rowCount = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
        const fullRow = grid[r].every(cell => cell !== null);
        if (!fullRow) continue;

        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
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

// Exact reference-matching block renderer with rich gradient fill and 3D inner texture frame
function drawBlock(x, y, color1, color2) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    ctx.save();

    // 1. Rich vertical gradient background matching your reference image style
    const grad = ctx.createLinearGradient(px, py, px, py + BLOCK_SIZE);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    // 2. Checkerboard / Dot inner recessed texture frame
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let i = 4; i < BLOCK_SIZE - 4; i += 4) {
        for (let j = 4; j < BLOCK_SIZE - 4; j += 4) {
            ctx.fillRect(px + i, py + j, 2, 2);
        }
    }

    // 3. Inner recessed bevel border (gives that exact 3D carved arcade button look)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + BLOCK_SIZE - 2);
    ctx.lineTo(px + 2, py + 2);
    ctx.lineTo(px + BLOCK_SIZE - 2, py + 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.beginPath();
    ctx.moveTo(px + 2, py + BLOCK_SIZE - 2);
    ctx.lineTo(px + BLOCK_SIZE - 2, py + BLOCK_SIZE - 2);
    ctx.lineTo(px + BLOCK_SIZE - 2, py + 2);
    ctx.stroke();

    ctx.restore();
}

function draw() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== null) {
                drawBlock(c, r, grid[r][c].color1, grid[r][c].color2);
            }
        }
    }

    if (!gameOver && !isPaused && player.matrix) {
        player.matrix.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    drawBlock(player.pos.x + c, player.pos.y + r, player.color1, player.color2);
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
    let installBtnHTML = deferredPrompt ? `<button class="menuBtn secondaryBtn" id="installAppBtn" style="margin-top: 10px;">📱 INSTALL APP</button>` : '';

    uiOverlay.innerHTML = `
        <div class="revivedPanel">
            <button class="menuBtn" id="startBtn">START STACKING</button>
            ${installBtnHTML}
        </div>
    `;

    const startBtn = document.getElementById("startBtn");
    startBtn.addEventListener("click", () => {
        ensureAudio();
        startNewGame();
    });

    const installAppBtn = document.getElementById("installAppBtn");
    if (installAppBtn) {
        installAppBtn.addEventListener("click", async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') deferredPrompt = null;
            installAppBtn.style.display = 'none';
        });
    }
}

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;

    if (isPaused) {
        uiOverlay.innerHTML = `
            <div class="revivedPanel">
                <h2 style="color: #00ffff; margin-bottom: 12px; font-size: 20px;">GAME PAUSED</h2>
                <div class="reviveActions">
                    <button class="menuBtn" id="resumeBtn">RESUME</button>
                    <button class="menuBtn secondaryBtn" id="quitBtn">MAIN MENU</button>
                </div>
            </div>
        `;
        document.getElementById("resumeBtn").addEventListener("click", () => togglePause());
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
            <h2 style="color: #ff0055; margin-bottom: 12px; font-size: 20px;">ROUTE BLOCKED!</h2>
            <div class="reviveActions">
                <button class="menuBtn" id="reviveBtn">🎬 WATCH AD TO REVIVE</button>
                <button class="menuBtn secondaryBtn" id="restartBtn">TRY AGAIN</button>
            </div>
        </div>
    `;

    document.getElementById("reviveBtn").addEventListener("click", () => {
        ensureAudio();
        triggerAdRevive();
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
        ensureAudio();
        startNewGame();
    });
}

function triggerAdRevive() {
    uiOverlay.innerHTML = `
        <div class="revivedPanel">
            <h2 style="color: #00ffff; font-size: 16px; margin-bottom: 6px;">SPONSORED PARTNER AD</h2>
            <p class="statLabel" style="margin-bottom: 12px;">Resetting board on Level ${level}...</p>
            <div class="adBar">
                <div class="adProgress" id="adProgress" style="transition: width 10s linear;"></div>
            </div>
            <div style="font-size: 28px; font-weight: bold; color: #ffff00; margin-top: 10px;" id="adTimer">10</div>
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
            grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
            uiOverlay.innerHTML = "";
            gameOver = false;
            isPaused = false;
            dropCounter = 0;
            spawnPiece();
        }
    }, 1000);
}

// Keyboard controls
document.addEventListener("keydown", event => {
    if (event.code === "KeyP" || event.code === "Escape") {
        togglePause();
        return;
    }
    if (gameOver || isPaused) return;

    if (event.code === "ArrowLeft" || event.code === "KeyA") playerMove(-1);
    else if (event.code === "ArrowRight" || event.code === "KeyD") playerMove(1);
    else if (event.code === "ArrowDown" || event.code === "KeyS") playerDrop();
    else if (event.code === "ArrowUp" || event.code === "KeyW") playerRotate();
});

// Instant Mobile Touch Controls
const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");
const btnRotate = document.getElementById("btnRotate");
const btnDrop = document.getElementById("btnDrop");

if (btnLeft) {
    btnLeft.addEventListener("touchstart", (e) => { e.preventDefault(); playerMove(-1); });
    btnLeft.addEventListener("click", () => playerMove(-1));
}
if (btnRight) {
    btnRight.addEventListener("touchstart", (e) => { e.preventDefault(); playerMove(1); });
    btnRight.addEventListener("click", () => playerMove(1));
}
if (btnRotate) {
    btnRotate.addEventListener("touchstart", (e) => { e.preventDefault(); playerRotate(); });
    btnRotate.addEventListener("click", () => playerRotate());
}
if (btnDrop) {
    btnDrop.addEventListener("touchstart", (e) => { e.preventDefault(); playerDrop(); });
    btnDrop.addEventListener("click", () => playerDrop());
}

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
