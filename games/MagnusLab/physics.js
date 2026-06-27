// physics.js - Magnus effect core calculations for MagnusLab.
// Coordinate convention (world frame): X = direction of travel (mound -> plate),
// Y = left/right, Z = up. Same convention as games/Baseball/physics.js.

const MagnusConstants = {
    M: 0.145,      // kg
    R: 0.0365,     // m
    RHO: 1.225,    // kg/m^3
    DIST: 18.44,   // m, mound to plate
    G: 9.81
};
Object.freeze(MagnusConstants);

const MagnusPhysics = {
    A: Math.PI * MagnusConstants.R * MagnusConstants.R,

    /** Vector helpers */
    dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    },
    norm(a) { return Math.sqrt(this.dot(a, a)); },
    scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    normalize(a) {
        const n = this.norm(a);
        return n > 1e-9 ? this.scale(a, 1 / n) : [0, 0, 0];
    },

    /**
     * Lift coefficient approximation as a function of spin factor S = R*omega/v.
     * Same piecewise model used in games/Baseball/physics.js (Alan Nathan style).
     */
    liftCoefficient(S) {
        let Cl = S < 0.1 ? 1.5 * S : 0.09 + 0.6 * S;
        return Math.min(Cl, 0.4);
    },

    /**
     * Computes the full Magnus state for the instantaneous release condition.
     * params: { speedKmh, rpm, tiltDeg, gyroDeg }
     * Returns geometry (basis vectors, omega, v) plus derived scalars.
     */
    computeState(params) {
        const v0 = params.speedKmh * 1000 / 3600;
        const omega = params.rpm * 2 * Math.PI / 60;
        const tilt = params.tiltDeg * Math.PI / 180;
        const gyro = params.gyroDeg * Math.PI / 180;

        // Angular velocity vector (matches games/Baseball/physics.js convention)
        const wx = omega * Math.sin(gyro);
        const wy = -omega * Math.cos(gyro) * Math.cos(tilt);
        const wz = -omega * Math.cos(gyro) * Math.sin(tilt);
        const wVec = [wx, wy, wz];
        const wMag = this.norm(wVec);
        const wHat = wMag > 1e-9 ? this.scale(wVec, 1 / wMag) : [0, 0, 1];

        // Velocity purely along +X at release
        const vVec = [v0, 0, 0];
        const vMag = v0;

        // Decompose velocity relative to spin axis: only the perpendicular
        // ("active spin") component contributes to Magnus lift.
        const vPar = this.scale(wHat, this.dot(vVec, wHat));
        const vPerp = this.sub(vVec, vPar);
        const U = this.norm(vPerp);

        const wPerpMag = wMag * (vMag > 1e-9 ? Math.sqrt(Math.max(0, 1 - (this.dot(vVec, wHat) / vMag) ** 2)) : 1);

        const S = vMag > 1e-9 ? (MagnusConstants.R * wPerpMag) / vMag : 0;
        const Cl = this.liftCoefficient(S);

        const cross = this.cross(wVec, vVec);
        const crossMag = this.norm(cross);
        const fDir = crossMag > 1e-9 ? this.scale(cross, 1 / crossMag) : [0, 0, 0];
        const fMagnitude = 0.5 * MagnusConstants.RHO * Cl * this.A * vMag * vMag;
        const fVec = this.scale(fDir, fMagnitude);

        // Screen basis: ez = spin axis (toward viewer), ex = flow direction
        // (unit vector of v_perp), ey = ez x ex (right-handed).
        const ez = wHat;
        const ex = U > 1e-9 ? this.scale(vPerp, 1 / U) : [1, 0, 0];
        const ey = this.cross(ez, ex);

        // By construction F is perpendicular to both v_perp and the spin axis,
        // so it lies (almost) purely along ey. fy carries the sign.
        const fy = this.dot(fVec, ey);

        // Rough displacement estimate at the plate, assuming constant velocity
        // and constant transverse acceleration (a common first-order approximation).
        const t = vMag > 1e-9 ? MagnusConstants.DIST / vMag : 0;
        const aMag = fMagnitude / MagnusConstants.M;
        const displacementCm = 0.5 * aMag * t * t * 100;

        // Knuckle regime: below this RPM, real seam-airflow interaction (not
        // captured by the smooth Magnus model) dominates and movement becomes
        // sensitive/unpredictable rather than a clean curve.
        const isKnuckleRegime = params.rpm < 300;

        return {
            v0, omega, wVec, wMag, wHat, vVec, vMag, vPerp, U,
            S, Cl, fVec, fMagnitude, fy, ex, ey, ez,
            t, aMag, displacementCm, isKnuckleRegime
        };
    }
};
