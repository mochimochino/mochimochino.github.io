// flow.js - Simplified 2D potential-flow visualization of the Magnus effect.
// We view the ball along its own spin axis. In that plane the situation reduces
// to the textbook problem of uniform flow + rotating cylinder (cylinder = the
// ball's silhouette), which is the standard simplified picture of the Magnus
// effect. The circulation strength/sign is derived from the real 3D Magnus
// force (physics.js) so the bend direction always matches the physics,
// but the circulation magnitude is exaggerated (kVis) purely for legibility.

const FlowField = {
    kVis: 18,
    minSpeed: 8, // m/s floor used only to keep circulation finite when U ~ 0

    /** Circulation Gamma (m^2/s) consistent with Kutta-Joukowski: Fy = rho*U*Gamma */
    computeCirculation(fy, U) {
        const Usafe = Math.max(U, this.minSpeed);
        return this.kVis * fy / (MagnusConstants.RHO * Usafe);
    },

    /**
     * Velocity field for uniform flow U (along +x) past a rotating cylinder of
     * radius a centered at the origin, with circulation Gamma.
     * Returns null if (x,y) is inside the cylinder.
     */
    velocityAt(x, y, a, U, Gamma) {
        const r2 = x * x + y * y;
        if (r2 < a * a) return null;
        const r = Math.sqrt(r2);
        const theta = Math.atan2(y, x);
        const cosT = Math.cos(theta), sinT = Math.sin(theta);

        const vr = U * cosT * (1 - (a * a) / r2);
        const vTheta = -U * sinT * (1 + (a * a) / r2) - Gamma / (2 * Math.PI * r);

        const vx = vr * cosT - vTheta * sinT;
        const vy = vr * sinT + vTheta * cosT;
        return [vx, vy];
    },

    /**
     * Traces one streamline starting at (x0, y0), integrated with RK2 across
     * the window [-bound, bound] in both axes. Stops early if it enters the
     * cylinder. Returns an array of [x, y] points.
     */
    traceStreamline(x0, y0, a, U, Gamma, bound, steps = 220) {
        const pts = [];
        let x = x0, y = y0;
        const dt = (2 * bound) / steps / Math.max(U, this.minSpeed * 0.5);
        pts.push([x, y]);
        for (let i = 0; i < steps; i++) {
            const v1 = this.velocityAt(x, y, a, U, Gamma);
            if (!v1) break;
            const xm = x + v1[0] * dt * 0.5;
            const ym = y + v1[1] * dt * 0.5;
            const v2 = this.velocityAt(xm, ym, a, U, Gamma);
            if (!v2) break;
            x += v2[0] * dt;
            y += v2[1] * dt;
            pts.push([x, y]);
            if (Math.abs(x) > bound * 1.05 || Math.abs(y) > bound * 1.5) break;
        }
        return pts;
    },

    /** Generates a family of streamlines starting from the left edge of the window. */
    generateStreamlines(a, U, Gamma, bound, lineCount = 14) {
        const lines = [];
        for (let i = 0; i < lineCount; i++) {
            const y0 = -bound * 1.2 + (i / (lineCount - 1)) * bound * 2.4;
            if (Math.abs(y0) < a * 0.15) continue; // skip lines that would graze dead-center
            lines.push(this.traceStreamline(-bound, y0, a, U, Gamma, bound));
        }
        return lines;
    }
};
