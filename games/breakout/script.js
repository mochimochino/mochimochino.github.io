// ===================================================
//  BREAKOUT  –  script.js
//  Step 1: Setup & static draw
//  Step 2: Animation loop & keyboard controls
//  Step 3: Collision detection (walls & paddle)
//  Step 4: Block destruction & win/lose conditions
// ===================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── DOM refs ──────────────────────────────────────
const scoreEl     = document.getElementById('score');
const levelEl     = document.getElementById('level');
const highScoreEl = document.getElementById('highScore');
const livesEl     = document.getElementById('lives');

const startScreen   = document.getElementById('startScreen');
const clearScreen   = document.getElementById('clearScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const clearScoreEl  = document.getElementById('clearScore');
const overScoreEl   = document.getElementById('overScore');

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);
document.getElementById('retryBtn').addEventListener('click', resetGame);

// ── Game Constants ────────────────────────────────
const W = canvas.width;
const H = canvas.height;

// Paddle
const PADDLE_H      = 10;
const PADDLE_W_BASE = 100;
const PADDLE_Y      = H - 40;
const PADDLE_SPEED  = 7;

// Ball
const BALL_RADIUS   = 8;
const BALL_SPEED_BASE = 4.5;

// Blocks
const COLS          = 10;
const ROWS          = 5;
const BLOCK_W       = (W - 40) / COLS;
const BLOCK_H       = 22;
const BLOCK_PAD     = 3;
const BLOCK_TOP     = 60;

// Colors per row
const ROW_COLORS = [
    ['#ff6b6b', '#ff8e8e'],   // row 0 – red
    ['#ff9f43', '#ffbe76'],   // row 1 – orange
    ['#feca57', '#ffd32a'],   // row 2 – yellow
    ['#48dbfb', '#0abde3'],   // row 3 – cyan
    ['#ff9ff3', '#f368e0'],   // row 4 – pink
];

// Row points
const ROW_POINTS = [7, 5, 4, 3, 2];

// ── Game State ────────────────────────────────────
let state = 'idle'; // idle | playing | paused | clear | over
let score      = 0;
let highScore  = 0;
let lives      = 3;
let level      = 1;
let animId     = null;

let paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W_BASE, h: PADDLE_H };
let ball   = { x: 0, y: 0, vx: 0, vy: 0, r: BALL_RADIUS };
let blocks = [];

const keys = { left: false, right: false };

// ── Initialisation ────────────────────────────────
function initPaddle() {
    paddle.w = Math.max(PADDLE_W_BASE - (level - 1) * 10, 50);
    paddle.x = W / 2 - paddle.w / 2;
}

function initBall() {
    ball.x  = W / 2;
    ball.y  = PADDLE_Y - BALL_RADIUS - 2;
    const spd = BALL_SPEED_BASE + (level - 1) * 0.5;
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
    ball.vx = Math.cos(angle) * spd;
    ball.vy = Math.sin(angle) * spd;
}

function initBlocks() {
    blocks = [];
    const extraRows = Math.min(level - 1, 3);
    const totalRows = ROWS + extraRows;
    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < COLS; c++) {
            const colorIdx = r % ROW_COLORS.length;
            blocks.push({
                x: 20 + c * BLOCK_W,
                y: BLOCK_TOP + r * (BLOCK_H + BLOCK_PAD),
                w: BLOCK_W - BLOCK_PAD,
                h: BLOCK_H,
                alive: true,
                color:  ROW_COLORS[colorIdx][0],
                color2: ROW_COLORS[colorIdx][1],
                row: r,
                flash: 0,
            });
        }
    }
}

// ── Draw ──────────────────────────────────────────
function draw() {
    // Background
    ctx.clearRect(0, 0, W, H);

    // Grid lines (subtle)
    ctx.save();
    ctx.strokeStyle = 'rgba(100,160,255,0.04)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    drawBlocks();
    drawPaddle();
    drawBall();
}

function drawBlocks() {
    blocks.forEach(b => {
        if (!b.alive) return;
        const grd = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        grd.addColorStop(0, b.flash > 0 ? '#ffffff' : b.color);
        grd.addColorStop(1, b.flash > 0 ? '#ffffff' : b.color2);
        if (b.flash > 0) b.flash--;

        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = grd;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.restore();
    });
}

function drawPaddle() {
    const grd = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y + paddle.h);
    grd.addColorStop(0, '#4d9fff');
    grd.addColorStop(1, '#a855f7');

    ctx.save();
    ctx.shadowColor = 'rgba(77,159,255,0.6)';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = grd;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
    ctx.fill();
    ctx.restore();
}

function drawBall() {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur  = 20;

    const grd = ctx.createRadialGradient(
        ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.1,
        ball.x, ball.y, ball.r
    );
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#80c4ff');

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ── Update ────────────────────────────────────────
function update() {
    // Paddle movement
    if (keys.left  && paddle.x > 0)           paddle.x -= PADDLE_SPEED;
    if (keys.right && paddle.x + paddle.w < W) paddle.x += PADDLE_SPEED;

    // Ball movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // ── Wall collisions (Step 3) ──────────────────
    // Left / Right
    if (ball.x - ball.r < 0) {
        ball.x  = ball.r;
        ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.r > W) {
        ball.x  = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
    }
    // Top
    if (ball.y - ball.r < 0) {
        ball.y  = ball.r;
        ball.vy = Math.abs(ball.vy);
    }
    // Bottom → lose life
    if (ball.y + ball.r > H) {
        loseLife();
        return;
    }

    // ── Paddle collision (Step 3) ─────────────────
    if (
        ball.vy > 0 &&
        ball.x + ball.r > paddle.x &&
        ball.x - ball.r < paddle.x + paddle.w &&
        ball.y + ball.r > paddle.y &&
        ball.y - ball.r < paddle.y + paddle.h
    ) {
        ball.y = paddle.y - ball.r;
        // Affect angle based on hit position on paddle
        const hitPos  = (ball.x - paddle.x) / paddle.w; // 0 → 1
        const angle   = (hitPos - 0.5) * Math.PI * 0.7; // ±63°
        const spd     = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.sin(angle) * spd;
        ball.vy = -Math.abs(Math.cos(angle) * spd);
    }

    // ── Block collisions (Step 4) ─────────────────
    let allDead = true;
    for (const b of blocks) {
        if (!b.alive) continue;
        allDead = false;

        if (
            ball.x + ball.r > b.x &&
            ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y &&
            ball.y - ball.r < b.y + b.h
        ) {
            b.alive  = false;
            b.flash  = 3;

            // Determine reflection axis
            const overlapLeft  = (ball.x + ball.r) - b.x;
            const overlapRight = (b.x + b.w) - (ball.x - ball.r);
            const overlapTop   = (ball.y + ball.r) - b.y;
            const overlapBot   = (b.y + b.h) - (ball.y - ball.r);
            const minH = Math.min(overlapLeft, overlapRight);
            const minV = Math.min(overlapTop,  overlapBot);

            if (minH < minV) {
                ball.vx = -ball.vx;
            } else {
                ball.vy = -ball.vy;
            }

            const pts = ROW_POINTS[b.row % ROW_POINTS.length] * level;
            addScore(pts);
            break;
        }
    }

    if (allDead) {
        stageClear();
    }
}

// ── Score & Lives ──────────────────────────────────
function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
    }
}

function updateLivesUI() {
    const lifeSpans = livesEl.querySelectorAll('.life');
    lifeSpans.forEach((span, i) => {
        span.classList.toggle('dead', i >= lives);
    });
}

function loseLife() {
    lives--;
    updateLivesUI();
    if (lives <= 0) {
        gameOver();
    } else {
        initBall();
        initPaddle();
    }
}

// ── Game Flow ─────────────────────────────────────
function startGame() {
    score   = 0;
    lives   = 3;
    level   = 1;
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    updateLivesUI();
    startScreen.classList.add('hidden');
    initPaddle();
    initBall();
    initBlocks();
    state = 'playing';
    loop();
}

function stageClear() {
    state = 'clear';
    cancelAnimationFrame(animId);
    clearScoreEl.textContent = score;
    clearScreen.classList.remove('hidden');
}

function nextLevel() {
    level++;
    levelEl.textContent = level;
    clearScreen.classList.add('hidden');
    initPaddle();
    initBall();
    initBlocks();
    state = 'playing';
    loop();
}

function gameOver() {
    state = 'over';
    cancelAnimationFrame(animId);
    overScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    clearScreen.classList.add('hidden');
    startGame();
}

// ── Main Loop ─────────────────────────────────────
function loop() {
    if (state !== 'playing') return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
}

// ── Keyboard ──────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (state === 'playing') {
            state  = 'paused';
            cancelAnimationFrame(animId);
        } else if (state === 'paused') {
            state  = 'playing';
            loop();
        }
    }
});
document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

// ── Initial static draw (Step 1) ─────────────────
initPaddle();
initBall();
initBlocks();
draw();
