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
const REVIVE_SECONDS = 3;

let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let level = 1;
let lines = 0;
let gameOver = true;
let isPaused = false;
let isReviving = false;
let reviveAvailable = true;
dropInterval = 500;
let dropCounter = 0;
let lastTime = 0;

const SHAPES = [
    { shape: [[1, 1, 1, 1]], color: "#8AFBFF" },
    { shape: [[1, 1], [1, 1]], color: "#FFF26A" },
    { shape: [[0, 1, 0], [1, 1, 1]], color: "#FF7AF3" },
    { shape: [[1, 1, 0], [0, 1, 1]], color: "#FF5E81" },
    { shape: [[0, 1, 1], [1, 1, 0]], color: "#7EFF9D" },
    { shape: [[1, 0, 0], [1, 1, 1]], color: "#7CCBFF" },
    { shape: [[0, 0, 1], [1, 1, 1]], color: "#FFB75D" },
    { shape: [[1, 1, 1], [1, 1, 0]], color: "#D59BFF" },
    { shape: [[1, 1, 1], [1, 0, 1]], color: "#6DF7D7" },
    { shape: [[1, 0, 1], [1, 1, 1]], color: "#FF9B68" },
    { shape: [[1, 1, 1], [0, 1, 0], [0, 1, 0]], color: "#FFF980" },
    { shape: [[1, 1, 0], [1, 0, 1], [0, 1, 1]], color: "#A5F7FF" }
];

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    color: "#fff"
};

const audioCtx = window.AudioContext || window.webkitAudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;

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

function clearBoardForNewGame() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 500;
    dropCounter = 0;
    lastTime = 0;
    updateUI();
}

function spawnPiece() {
    const rand = Math.floor(Math.random() * SHAPES.length);
    player.matrix = SHAPES[rand].shape.map(row => [...row]);
    player.color = SHAPES[rand].color;
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

    if (checkCollision()) {
        gameOver = true;
        playGameOverSound();
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
        playClearSound();
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
    } else {
        playMoveSound();
    }
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            rotated[x][rows - 1 - y] = matrix[y][x];
        }
    }

    return rotated;
}

function playerRotate() {
    const prevX = player.pos.x;
    const prevMatrix = player.matrix.map(row => [...row]);
    const rotated = rotateMatrix(player.matrix);
    player.matrix = rotated;

    let kick = 0;
    while (checkCollision()) {
        player.pos.x += (kick === 0 ? 1 : kick);
        kick = kick === 0 ? -1 : (kick > 0 ? -kick - 1 : -kick + 1);
        if (Math.abs(kick) > 3) {
            player.matrix = prevMatrix;
            player.pos.x = prevX;
            return;
        }
    }

    playRotateSound();
}

function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const normalized = value.length === 3
        ? value.split('').map(ch => ch + ch).join('')
        : value;
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
    const sideColor = shadeColor(color, -18);
    const faceColor = shadeColor(color, -42);

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = topColor;
    ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

    ctx.shadowBlur = 0;
    ctx.fillStyle = sideColor;
    ctx.fillRect(px + BLOCK_SIZE - 6, py + 4, 4, BLOCK_SIZE - 8);
    ctx.fillRect(px + 2, py + BLOCK_SIZE - 6, BLOCK_SIZE - 6, 4);

    ctx.fillStyle = faceColor;
    ctx.fillRect(px + 2, py + BLOCK_SIZE - 6, BLOCK_SIZE - 6, 4);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(px + 5, py + 5, BLOCK_SIZE - 12, 6);

    ctx.strokeStyle = "rgba(255,255,255,0.96)";
    ctx.lineWidth = 1.3;
    ctx.strokeRect(px + 2.5, py + 2.5, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
    ctx.restore();
}

function draw() {
    ctx.fillStyle = "#070f1f";
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
    uiScore.innerText = `R ${score}`;
    uiLevel.innerText = level;
    uiLines.innerText = lines;
}

function finishRevive() {
    uiOverlay.innerHTML = "";
    isReviving = false;
    gameOver = false;
    isPaused = false;

    for (let r = ROWS - 3; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = 0;
        }
    }

    if (!player.matrix) {
        spawnPiece();
    } else {
        player.pos.y = 0;
        player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    }

    dropCounter = 0;
    lastTime = performance.now();
}

function startAdRevive() {
    if (isReviving || !reviveAvailable) return;
    isReviving = true;
    reviveAvailable = false;
    gameOver = false;

    let timeLeft = REVIVE_SECONDS;
    uiOverlay.innerHTML = `
        <div class="revivePanel">
            <h2 style="color: #8afbff; font-size: 22px; margin-bottom: 12px; text-shadow: 0 0 12px rgba(138, 251, 255, 0.9);">REVIVE AD</h2>
            <p style="color: #dfeeff; margin-bottom: 12px;">Reviving in <span id="reviveTimer">${timeLeft}</span>s</p>
            <div class="adBar">
                <div class="adProgress" id="reviveProgress"></div>
            </div>
        </div>
    `;

    const timerEl = document.getElementById("reviveTimer");
    const progressEl = document.getElementById("reviveProgress");
    const interval = setInterval(() => {
        timeLeft -= 1;
        timerEl.textContent = Math.max(0, timeLeft);
        progressEl.style.width = `${(Math.max(0, timeLeft) / REVIVE_SECONDS) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            setTimeout(() => finishRevive(), 250);
        }
    }, 1000);
}

function showRevivePrompt() {
    if (!reviveAvailable) return;
    uiOverlay.innerHTML = `
        <div class="revivePanel">
            <h2 style="color: #ff6b9a; font-size: 24px; margin-bottom: 10px; text-shadow: 0 0 12px rgba(255,107,154,0.9);">ROUTE BLOCKED!</h2>
            <p style="color: #edf7ff; margin-bottom: 16px;">Watch an ad to revive your run.</p>
            <div class="reviveActions">
                <button class="menuBtn" id="watchAdBtn">WATCH AD TO REVIVE</button>
                <button class="menuBtn secondaryBtn" id="restartBtn">TRY AGAIN</button>
            </div>
        </div>
    `;

    document.getElementById("watchAdBtn").onclick = startAdRevive;
    document.getElementById("restartBtn").onclick = () => {
        ensureAudio();
        uiOverlay.innerHTML = "";
        clearBoardForNewGame();
        gameOver = false;
        isPaused = false;
        isReviving = false;
        reviveAvailable = true;
        spawnPiece();
    };
}

function showPauseScreen() {
    uiOverlay.innerHTML = `
        <div style="text-align: center;">
            <h2 style="color: #7af9ff; font-size: 22px; margin-bottom: 12px; text-shadow: 0 0 12px rgba(122,249,255,0.9);">PAUSED</h2>
            <button class="menuBtn" id="resumeBtn">RESUME</button>
        </div>
    `;
    document.getElementById("resumeBtn").onclick = () => {
        ensureAudio();
        uiOverlay.innerHTML = "";
        isPaused = false;
        lastTime = performance.now();
    };
}

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        showPauseScreen();
    } else {
        uiOverlay.innerHTML = "";
        lastTime = performance.now();
    }
}

function showStartScreen() {
    isPaused = false;
    isReviving = false;
    reviveAvailable = true;
    uiOverlay.innerHTML = `<button class="menuBtn" id="startBtn">START STACKING</button>`;
    document.getElementById("startBtn").onclick = () => {
        ensureAudio();
        uiOverlay.innerHTML = "";
        clearBoardForNewGame();
        gameOver = false;
        isPaused = false;
        isReviving = false;
        reviveAvailable = true;
        spawnPiece();
    };
}

function showGameOverScreen() {
    showRevivePrompt();
}

document.addEventListener("keydown", event => {
    if (event.code === "KeyP" || event.code === "Escape") {
        if (!gameOver) {
            togglePause();
        }
        return;
    }

    if (gameOver || isPaused || isReviving) return;
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

    if (!gameOver && !isPaused && !isReviving) {
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
