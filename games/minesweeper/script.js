// ===================================================
//  MINESWEEPER  –  script.js
//  Step 1: Board Data Structure & Logic
//  Step 2: UI Rendering & Data Binding
//  Step 3: Recursive Open Logic (Chaining)
//  Step 4: Flagging & Win/Lose Conditions
// ===================================================

// ── Settings & Elements ───────────────────────────
const LEVELS = {
    easy:   { r: 9,  c: 9,  m: 10,  label: "9×9, 10 Mines" },
    normal: { r: 16, c: 16, m: 40,  label: "16×16, 40 Mines" },
    hard:   { r: 16, c: 30, m: 99,  label: "30×16, 99 Mines" }
};

let currentLevel = 'easy';
let R, C, MINES;

// Data Structure (Step 1)
// gridData[r][c] = { mine: bool, value: int, state: 'hidden'|'open'|'flag' }
let gridData = [];
let firstClick = true;
let state = 'idle'; // idle | playing | over | clear

// DOM
const gridEl      = document.getElementById('grid');
const resetBtn    = document.getElementById('resetBtn');
const diffBtns    = document.querySelectorAll('.diff-btn');
const diffDesc    = document.getElementById('diffDesc');
const mineCountEl = document.getElementById('mineCount');
const timerEl     = document.getElementById('timer');

const resultScreen = document.getElementById('resultScreen');
const resultTitle  = document.getElementById('resultTitle');
const finalTime    = document.getElementById('finalTime');

let flagsPlaced = 0;
let cellsOpened = 0;
let timeElapsed = 0;
let timerId     = null;

// ── Initialisation ────────────────────────────────
function init() {
    R     = LEVELS[currentLevel].r;
    C     = LEVELS[currentLevel].c;
    MINES = LEVELS[currentLevel].m;

    gridData    = [];
    firstClick  = true;
    state       = 'idle';
    flagsPlaced = 0;
    cellsOpened = 0;
    timeElapsed = 0;

    clearInterval(timerId);
    updateLCD(mineCountEl, MINES);
    updateLCD(timerEl, 0);
    resetBtn.textContent = '🙂';
    resultScreen.classList.add('hidden');

    diffBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.diff === currentLevel);
    });
    diffDesc.textContent = LEVELS[currentLevel].label;

    buildGrid();
}

function buildGrid() {
    gridEl.innerHTML = '';
    // Use dynamic CSS grid columns
    gridEl.style.gridTemplateColumns = `repeat(${C}, 2rem)`;

    for (let r = 0; r < R; r++) {
        let rowData = [];
        for (let c = 0; c < C; c++) {
            rowData.push({
                r: r, c: c,
                mine: false,
                value: 0,
                state: 'hidden' // 'hidden', 'open', 'flag'
            });

            // Create DOM Cell
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');
            cellEl.dataset.r = r;
            cellEl.dataset.c = c;
            
            // Events
            cellEl.addEventListener('mousedown', (e) => handleMouse(e, r, c));
            // Prevent context menu
            cellEl.addEventListener('contextmenu', e => e.preventDefault());
            
            gridEl.appendChild(cellEl);
        }
        gridData.push(rowData);
    }
}

// ── Data Generation (Step 1) ──────────────────────
function placeMines(firstR, firstC) {
    let minesToPlace = MINES;
    while (minesToPlace > 0) {
        let r = Math.floor(Math.random() * R);
        let c = Math.floor(Math.random() * C);
        
        // Prevent mine on first click & already placed
        if (!gridData[r][c].mine && !(r === firstR && c === firstC)) {
            // Check adjacent to first click also (optional, usually done for fair start, here just exact cell is safe)
            gridData[r][c].mine = true;
            gridData[r][c].value = -1;
            minesToPlace--;
        }
    }
    calcValues();
}

function calcValues() {
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            if (gridData[r][c].mine) continue;
            let count = 0;
            // Check 8 neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    let nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
                        if (gridData[nr][nc].mine) count++;
                    }
                }
            }
            gridData[r][c].value = count;
        }
    }
}

// ── Interactions ──────────────────────────────────
function handleMouse(e, r, c) {
    if (state === 'over' || state === 'clear') return;
    
    // Left Click
    if (e.button === 0) {
        if (gridData[r][c].state === 'hidden') {
            openCell(r, c);
        }
    } 
    // Right Click
    else if (e.button === 2) {
        toggleFlag(r, c);
    }
}

function startTimer() {
    state = 'playing';
    timerId = setInterval(() => {
        timeElapsed++;
        if (timeElapsed > 999) timeElapsed = 999;
        updateLCD(timerEl, timeElapsed);
    }, 1000);
}

function toggleFlag(r, c) {
    const cell = gridData[r][c];
    if (cell.state === 'open') return;

    if (cell.state === 'hidden') {
        if (flagsPlaced >= MINES) return;
        cell.state = 'flag';
        flagsPlaced++;
    } else if (cell.state === 'flag') {
        cell.state = 'hidden';
        flagsPlaced--;
    }
    
    updateLCD(mineCountEl, MINES - flagsPlaced);
    renderCell(r, c);
}

// ── Recursive Opening (Step 3) ────────────────────
function openCell(r, c) {
    let cell = gridData[r][c];
    if (cell.state === 'open' || cell.state === 'flag') return;

    if (firstClick) {
        placeMines(r, c);
        startTimer();
        firstClick = false;
    }

    cell.state = 'open';
    cellsOpened++;
    renderCell(r, c);

    if (cell.mine) {
        gameOver(r, c);
        return;
    }

    // Step 3: Recursive Opening if value is 0
    if (cell.value === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
                    if (gridData[nr][nc].state === 'hidden') {
                        openCell(nr, nc);
                    }
                }
            }
        }
    }

    checkWin();
}

// ── Rendering (Step 2) ────────────────────────────
function renderCell(r, c) {
    const idx = r * C + c;
    const cellEl = gridEl.children[idx];
    const data = gridData[r][c];

    // Reset classes
    cellEl.className = 'cell';

    if (data.state === 'hidden') {
        cellEl.textContent = '';
    } else if (data.state === 'flag') {
        cellEl.textContent = '🚩';
        cellEl.classList.add('flag');
    } else if (data.state === 'open') {
        cellEl.classList.add('open');
        if (data.mine) {
            cellEl.textContent = '💣';
            cellEl.classList.add('mine');
        } else if (data.value > 0) {
            cellEl.textContent = data.value;
            cellEl.classList.add(`val-${data.value}`);
        } else {
            cellEl.textContent = '';
        }
    }
}

// ── End Game (Step 4) ─────────────────────────────
function gameOver(r, c) {
    state = 'over';
    clearInterval(timerId);
    resetBtn.textContent = '😵';

    // Highlight clicked mine
    const idx = r * C + c;
    gridEl.children[idx].classList.add('exploded');

    // Reveal all remaining
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            const data = gridData[r][c];
            if (data.state === 'hidden' && data.mine) {
                data.state = 'open';
                renderCell(r, c);
            } else if (data.state === 'flag' && !data.mine) {
                // False flag
                const cellEl = gridEl.children[r * C + c];
                cellEl.textContent = '❌';
                cellEl.classList.add('false-flag');
            }
        }
    }

    showResult('GAME OVER', 'title-over');
}

function checkWin() {
    const cellsToOpen = (R * C) - MINES;
    if (cellsOpened === cellsToOpen) {
        state = 'clear';
        clearInterval(timerId);
        resetBtn.textContent = '😎';

        // Flag remaining mines
        updateLCD(mineCountEl, 0);
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                if (gridData[r][c].state === 'hidden') {
                    gridData[r][c].state = 'flag';
                    renderCell(r, c);
                }
            }
        }

        showResult('CLEAR!', 'title-clear');
    }
}

// ── UI Utils ──────────────────────────────────────
function updateLCD(el, num) {
    let str = Math.max(0, num).toString().padStart(3, '0');
    el.textContent = str;
}

function showResult(text, colorClass) {
    setTimeout(() => {
        resultTitle.textContent = text;
        resultTitle.className = `overlay-title ${colorClass}`;
        finalTime.textContent = timeElapsed.toString().padStart(3, '0');
        
        resultScreen.classList.remove('hidden');
        resultScreen.style.opacity = '1';
        resultScreen.style.pointerEvents = 'auto';

        // Click overlay to dismiss
        resultScreen.onclick = () => {
            resultScreen.classList.add('hidden');
        };
    }, 1500);
}

// Events
resetBtn.addEventListener('click', init);
diffBtns.forEach(b => {
    b.addEventListener('click', (e) => {
        currentLevel = e.target.dataset.diff;
        init();
    });
});

// Start
init();
