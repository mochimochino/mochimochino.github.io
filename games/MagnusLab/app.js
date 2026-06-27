// app.js - UI wiring and canvas rendering for MagnusLab.

(function () {
    const canvas = document.getElementById('flowCanvas');
    const ctx = canvas.getContext('2d');

    const sliders = {
        speed: document.getElementById('speed'),
        rpm: document.getElementById('rpm'),
        tilt: document.getElementById('tilt'),
        gyro: document.getElementById('gyro'),
        seamOffset: document.getElementById('seamOffset'),
        seamPhase: document.getElementById('seamPhase')
    };
    const valueLabels = {
        speed: document.getElementById('speed-val'),
        rpm: document.getElementById('rpm-val'),
        tilt: document.getElementById('tilt-val'),
        gyro: document.getElementById('gyro-val'),
        seamOffset: document.getElementById('seamOffset-val'),
        seamPhase: document.getElementById('seamPhase-val')
    };

    const statForce = document.getElementById('stat-force');
    const statForceSub = document.getElementById('stat-force-sub');
    const statDisp = document.getElementById('stat-disp');
    const statS = document.getElementById('stat-S');
    const statCl = document.getElementById('stat-cl');
    const statActiveSpin = document.getElementById('stat-activespin');
    const knuckleWarning = document.getElementById('knuckleWarning');
    const animateToggle = document.getElementById('animateToggle');

    const seamPointsRaw = SeamGeometry.generateSeamPoints(220, 0.6);

    let animating = false;
    let lastTime = null;

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function readParams() {
        return {
            speedKmh: Number(sliders.speed.value),
            rpm: Number(sliders.rpm.value),
            tiltDeg: Number(sliders.tilt.value),
            gyroDeg: Number(sliders.gyro.value),
            seamOffsetDeg: Number(sliders.seamOffset.value),
            seamPhaseDeg: Number(sliders.seamPhase.value)
        };
    }

    function describeDirection(state) {
        // ey, expressed back in world frame, tells us which way the force pushes
        // (e.g. up, down, glove-side, arm-side) in plain terms.
        const f = state.fVec;
        const ax = Math.abs(f[0]), ay = Math.abs(f[1]), az = Math.abs(f[2]);
        if (ax < 1e-4 && ay < 1e-4 && az < 1e-4) return 'なし(ジャイロ成分のみ)';
        const parts = [];
        if (az > 1e-4) parts.push(f[2] > 0 ? '上' : '下');
        if (ay > 1e-4) parts.push(f[1] > 0 ? '左' : '右');
        return parts.join('・') || '-';
    }

    function updateStats(state) {
        statForce.textContent = state.fMagnitude.toFixed(2) + ' N';
        statForceSub.textContent = '方向: ' + describeDirection(state);
        statDisp.textContent = state.displacementCm.toFixed(0) + ' cm';
        statS.textContent = state.S.toFixed(3);
        statCl.textContent = state.Cl.toFixed(3);

        const gyroRad = Number(sliders.gyro.value) * Math.PI / 180;
        const activeSpinPct = Math.cos(gyroRad) * 100;
        statActiveSpin.textContent = activeSpinPct.toFixed(0) + '%';

        knuckleWarning.classList.toggle('show', state.isKnuckleRegime);
    }

    function project(p, ex, ey, ez) {
        return {
            x: MagnusPhysics.dot(p, ex),
            y: MagnusPhysics.dot(p, ey),
            depth: MagnusPhysics.dot(p, ez)
        };
    }

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        ctx.clearRect(0, 0, w, h);

        const params = readParams();
        const state = MagnusPhysics.computeState(params);
        updateStats(state);

        const cx = w / 2, cy = h / 2;
        const Rpx = Math.min(w, h) * 0.27;
        const a = MagnusConstants.R;
        const scale = Rpx / a; // px per meter

        const { ex, ey, ez, U, fy } = state;

        // --- Streamlines ---
        const Gamma = FlowField.computeCirculation(fy, U);
        const bound = a * 3.4;
        const lines = FlowField.generateStreamlines(a, U, Gamma, bound, 16);

        ctx.lineWidth = 1.3;
        ctx.strokeStyle = 'rgba(77, 159, 255, 0.55)';
        lines.forEach(line => {
            if (line.length < 2) return;
            ctx.beginPath();
            line.forEach((pt, i) => {
                const sx = cx + pt[0] * scale;
                const sy = cy - pt[1] * scale;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            });
            ctx.stroke();

            // arrowhead at ~60% along the line to show flow direction
            const idx = Math.min(line.length - 2, Math.floor(line.length * 0.6));
            const p0 = line[idx], p1 = line[idx + 1];
            if (p0 && p1) {
                const sx0 = cx + p0[0] * scale, sy0 = cy - p0[1] * scale;
                const sx1 = cx + p1[0] * scale, sy1 = cy - p1[1] * scale;
                const ang = Math.atan2(sy1 - sy0, sx1 - sx0);
                drawArrowHead(sx1, sy1, ang, 5, 'rgba(77, 159, 255, 0.75)');
            }
        });

        // --- Ball circle ---
        ctx.beginPath();
        ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(226,234,248,0.35)';
        ctx.stroke();

        // --- Seam curve ---
        const seamOffsetRad = params.seamOffsetDeg * Math.PI / 180;
        const seamPhaseRad = params.seamPhaseDeg * Math.PI / 180;
        const Rmat = SeamGeometry.rotationFromZTo(state.wHat);

        const projected = seamPointsRaw.map(p0 => {
            const p1 = SeamGeometry.rotateX(p0, seamOffsetRad);
            const p2 = SeamGeometry.rotateZ(p1, seamPhaseRad);
            const p3 = SeamGeometry.applyMatrix(Rmat, p2);
            return project(p3, ex, ey, ez);
        });

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < projected.length - 1; i++) {
            const A = projected[i], B = projected[i + 1];
            const avgDepth = (A.depth + B.depth) / 2;
            const alpha = 0.22 + 0.65 * ((avgDepth + 1) / 2);
            ctx.beginPath();
            ctx.moveTo(cx + A.x * Rpx, cy - A.y * Rpx);
            ctx.lineTo(cx + B.x * Rpx, cy - B.y * Rpx);
            ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();

        // --- Spin direction indicator (rotation is always CCW about ez by convention) ---
        drawSpinIndicator(cx, cy, Rpx);

        // --- Magnus force arrow ---
        const fMaxRef = 3.0; // N, for scaling arrow length
        const arrowLen = Math.min(1, state.fMagnitude / fMaxRef) * Rpx * 1.4 + 14;
        const dirSign = fy >= 0 ? 1 : -1;
        const ax2 = cx; // arrow starts at center
        const ay2 = cy;
        const bx2 = cx;
        const by2 = cy - dirSign * arrowLen; // ey maps to screen "up" by our basis construction
        if (state.fMagnitude > 1e-3) {
            ctx.beginPath();
            ctx.moveTo(ax2, ay2);
            ctx.lineTo(bx2, by2);
            ctx.strokeStyle = '#f97373';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            drawArrowHead(bx2, by2, Math.atan2(by2 - ay2, bx2 - ax2), 9, '#f97373');
        }

        // --- Incoming flow label ---
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = 'rgba(226,234,248,0.5)';
        ctx.textAlign = 'left';
        ctx.fillText('← 相対的な空気の流れ (U = ' + U.toFixed(1) + ' m/s)', 14, h - 14);
    }

    function drawArrowHead(x, y, angle, size, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 1.6, size * 0.8);
        ctx.lineTo(-size * 1.6, -size * 0.8);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    function drawSpinIndicator(cx, cy, Rpx) {
        const r = Rpx * 1.18;
        const startAngle = -Math.PI * 0.35;
        const endAngle = Math.PI * 0.25;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle, false); // CCW visual cue
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        const tipAngle = endAngle;
        const tipX = cx + r * Math.cos(tipAngle);
        const tipY = cy + r * Math.sin(tipAngle);
        drawArrowHead(tipX, tipY, tipAngle - Math.PI / 2, 6, 'rgba(167, 139, 250, 0.8)');

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('回転方向(軸は奥→手前)', cx, cy - r - 10);
    }

    function syncLabels() {
        Object.keys(sliders).forEach(key => {
            valueLabels[key].textContent = sliders[key].value;
        });
    }

    Object.values(sliders).forEach(s => {
        s.addEventListener('input', () => { syncLabels(); draw(); });
    });

    animateToggle.addEventListener('click', () => {
        animating = !animating;
        animateToggle.classList.toggle('active', animating);
        animateToggle.textContent = animating ? '■ 停止' : '▶ 回転をアニメーション';
        if (animating) {
            lastTime = null;
            requestAnimationFrame(tick);
        }
    });

    function tick(now) {
        if (!animating) return;
        if (lastTime === null) lastTime = now;
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        const rpm = Number(sliders.rpm.value);
        const degPerSec = (rpm / 60) * 360 * 0.12; // slowed down for visibility
        let phase = (Number(sliders.seamPhase.value) + degPerSec * dt) % 360;
        sliders.seamPhase.value = phase.toFixed(1);
        syncLabels();
        draw();
        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', () => { resizeCanvas(); draw(); });

    resizeCanvas();
    syncLabels();
    draw();
})();
