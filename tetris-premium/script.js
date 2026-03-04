const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;
const NEXT_BLOCK_SIZE = 30;

// Grid representation
let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

// Tetromino colors mapping
const COLORS = [
    'transparent',
    '#06b6d4', // I - cyan
    '#3b82f6', // J - blue
    '#f97316', // L - orange
    '#eab308', // O - yellow
    '#22c55e', // S - green
    '#a855f7', // T - purple
    '#ef4444'  // Z - red
];

// Tetromino shapes (Standard SRS formats roughly)
const TETROMINOS = [
    [], // 0 is empty
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z
];

let score = 0;
let level = 1;
let lines = 0;
let requestAnimationId = null;
let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000;
let isGameOver = false;
let isPaused = false;

let piece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;

// Screens
const gameOverScreen = document.getElementById('gameOverScreen');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const finalScoreDisplay = document.getElementById('finalScore');

function init() {
    // Reset state
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    isGameOver = false;
    isPaused = false;
    updateScoreUI();

    // Manage UI
    gameOverScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');

    // Spawn pieces
    nextPiece = randomPiece();
    spawnPiece();

    // Start loop
    if (requestAnimationId) {
        cancelAnimationFrame(requestAnimationId);
    }
    lastTime = performance.now();
    gameLoop(lastTime);
}

function randomPiece() {
    const typeId = Math.floor(Math.random() * 7) + 1;
    const shape = TETROMINOS[typeId];
    return {
        shape: shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
        typeId: typeId
    };
}

function spawnPiece() {
    piece = nextPiece;
    nextPiece = randomPiece();
    canHold = true;
    drawNextPiece();

    if (collide(grid, piece)) {
        isGameOver = true;
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.innerText = score;
    }
}

// Collisions
function collide(board, p) {
    const m = p.shape;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (board[y + p.y] && board[y + p.y][x + p.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

// Rotate matrix (clockwise)
function rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; ++y) {
        for (let x = 0; x < N; ++x) {
            result[x][N - 1 - y] = matrix[y][x];
        }
    }
    return result;
}

function playerRotateRight() {
    const pos = piece.x;
    let offset = 1;
    const shapeBackup = piece.shape;
    piece.shape = rotateMatrix(piece.shape);

    // Wall kick simple logic
    while (collide(grid, piece)) {
        piece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > piece.shape[0].length) {
            // Revert
            piece.shape = shapeBackup;
            piece.x = pos;
            return;
        }
    }
}

function playerRotateLeft() {
    // Rotating left revolves to rotating right 3 times
    const pos = piece.x;
    let offset = 1;
    const shapeBackup = piece.shape;

    let newShape = rotateMatrix(piece.shape);
    newShape = rotateMatrix(newShape);
    newShape = rotateMatrix(newShape);
    piece.shape = newShape;

    while (collide(grid, piece)) {
        piece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > piece.shape[0].length) {
            piece.shape = shapeBackup;
            piece.x = pos;
            return;
        }
    }
}

function playerMove(dir) {
    piece.x += dir;
    if (collide(grid, piece)) {
        piece.x -= dir;
    }
}

function playerDrop() {
    piece.y++;
    if (collide(grid, piece)) {
        piece.y--;
        merge(grid, piece);
        clearLines();
        spawnPiece();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(grid, piece)) {
        piece.y++;
    }
    piece.y--;
    merge(grid, piece);
    clearLines();
    spawnPiece();
    dropCounter = 0;
}

function holdCurrentPiece() {
    if (!canHold) return;

    if (holdPiece === null) {
        holdPiece = {
            shape: TETROMINOS[piece.typeId],
            typeId: piece.typeId
        };
        spawnPiece(); // Automatically sets canHold = true, but we need it false for this turn
        canHold = false;
    } else {
        const temp = {
            shape: TETROMINOS[piece.typeId],
            typeId: piece.typeId
        };
        piece = {
            shape: holdPiece.shape,
            x: Math.floor(COLS / 2) - Math.floor(holdPiece.shape[0].length / 2),
            y: 0,
            typeId: holdPiece.typeId
        };
        holdPiece = temp;
        // Reset position slightly if colliding immediately (rare, but good practice)
        if (collide(grid, piece)) piece.y--;
        canHold = false;
        drawNextPiece(); // Re-render next UI (though not changing)
    }

    drawHoldPiece();
    dropCounter = 0;
}

function merge(board, p) {
    p.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + p.y][x + p.x] = value;
            }
        });
    });
}

function animateLineClear(yToClear, callback) {
    // We could add complex particle animations here. 
    // For simplicity, we just clear immediately, but one could add CSS or canvas transitions.
    callback();
}

function clearLines() {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (grid[y][x] === 0) {
                continue outer;
            }
        }

        const row = grid.splice(y, 1)[0].fill(0);
        grid.unshift(row);
        ++y; // Check same row again
        linesCleared++;
    }

    if (linesCleared > 0) {
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[linesCleared] * level;
        lines += linesCleared;

        // Level up every 10 lines
        level = Math.floor(lines / 10) + 1;
        // Increase speed
        dropInterval = Math.max(100, 1000 - (level - 1) * 80);

        updateScoreUI();
    }
}

function updateScoreUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lines').innerText = lines;
}

// Drawing Functions
function drawBlock(targetCtx, x, y, color, blockSize, opacity = 1) {
    // Shadow / base
    targetCtx.fillStyle = color;
    targetCtx.globalAlpha = opacity;
    targetCtx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);

    // Highlights for 3D/glass effect
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    targetCtx.fillRect(x * blockSize, y * blockSize, blockSize, 4); // Top
    targetCtx.fillRect(x * blockSize, y * blockSize, 4, blockSize); // Left

    targetCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    targetCtx.fillRect(x * blockSize, y * blockSize + blockSize - 4, blockSize, 4); // Bottom
    targetCtx.fillRect(x * blockSize + blockSize - 4, y * blockSize, 4, blockSize); // Right

    // Border
    targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);

    targetCtx.globalAlpha = 1;
}

function drawMatrix(matrix, offset, drawCtx, blockSize, opacity = 1) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(drawCtx, x + offset.x, y + offset.y, COLORS[value], blockSize, opacity);
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    const m = nextPiece.shape;
    const width = m[0].length * NEXT_BLOCK_SIZE;
    const height = m.length * NEXT_BLOCK_SIZE;
    const offsetX = (nextCanvas.width - width) / 2 / NEXT_BLOCK_SIZE;
    const offsetY = (nextCanvas.height - height) / 2 / NEXT_BLOCK_SIZE;

    drawMatrix(nextPiece.shape, { x: offsetX, y: offsetY }, nextCtx, NEXT_BLOCK_SIZE);
}

// Ghost piece calculation
function drawHoldPiece() {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

    if (holdPiece) {
        const m = holdPiece.shape;
        const width = m[0].length * NEXT_BLOCK_SIZE;
        const height = m.length * NEXT_BLOCK_SIZE;
        const offsetX = (holdCanvas.width - width) / 2 / NEXT_BLOCK_SIZE;
        const offsetY = (holdCanvas.height - height) / 2 / NEXT_BLOCK_SIZE;

        // Gray out if canHold is false
        const opacity = canHold ? 1.0 : 0.5;
        drawMatrix(holdPiece.shape, { x: offsetX, y: offsetY }, holdCtx, NEXT_BLOCK_SIZE, opacity);
    }
}
function getGhostY() {
    if (!piece) return 0;
    const backupY = piece.y;
    while (!collide(grid, piece)) {
        piece.y++;
    }
    const ghostY = piece.y - 1;
    piece.y = backupY;
    return ghostY;
}

function drawGhost() {
    const ghostY = getGhostY();
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const px = (x + piece.x) * BLOCK_SIZE;
                const py = (y + ghostY) * BLOCK_SIZE;

                // Draw outline for ghost
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

                // Very faint fill
                ctx.fillStyle = COLORS[value];
                ctx.globalAlpha = 0.15;
                ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                ctx.globalAlpha = 1.0;
            }
        });
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    drawMatrix(grid, { x: 0, y: 0 }, ctx, BLOCK_SIZE);

    if (piece) {
        drawGhost();
        drawMatrix(piece.shape, { x: piece.x, y: piece.y }, ctx, BLOCK_SIZE);
    }
}

// Game Loop
function gameLoop(time = 0) {
    if (isGameOver || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (isGameOver || startScreen.classList.contains('hidden') === false) return;

    isPaused = !isPaused;
    if (isPaused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        lastTime = performance.now();
        gameLoop(lastTime);
    }
}

// Controls
document.addEventListener('keydown', event => {
    // Prevent default scrolling for game keys
    if ([32, 37, 38, 39, 40].includes(event.keyCode)) {
        event.preventDefault();
    }

    if (event.keyCode === 80) { // 'P'
        togglePause();
        return;
    }

    if (isGameOver || isPaused || !piece) return;

    const key = event.key.toLowerCase();

    // Q, W, Space mapping
    if (key === 'q') {
        playerRotateLeft();
    } else if (key === 'w') {
        playerRotateRight();
    } else if (key === ' ' || key === 'c') {
        holdCurrentPiece();
    }

    switch (event.keyCode) {
        case 37: // Left
            playerMove(-1);
            break;
        case 39: // Right
            playerMove(1);
            break;
        case 40: // Down
            playerDrop();
            break;
        case 38: // Up (Hard Drop)
            playerHardDrop();
            break;
    }

    if (!isPaused) draw();
});

// Button events
document.getElementById('startBtn').addEventListener('click', init);
document.getElementById('restartBtn').addEventListener('click', init);

// Initial draw of the empty board
draw();
