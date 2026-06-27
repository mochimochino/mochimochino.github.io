// seam.js - Generates a realistic-looking baseball seam curve and 3D rotation helpers.

const SeamGeometry = {
    /**
     * Generates points for the baseball seam curve, projected onto a unit sphere.
     * Based on the classic "tennis ball curve" (Steinhaus curve) parametrization,
     * which produces the same topology as a baseball's figure-eight seam pattern.
     * c controls how "wide" the seam loops are (~0.6 looks close to a real ball).
     */
    generateSeamPoints(numPoints = 240, c = 0.6) {
        const points = [];
        for (let i = 0; i <= numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            let x = Math.cos(t) - 2 * c * Math.cos(3 * t);
            let y = Math.sin(t) + 2 * c * Math.sin(3 * t);
            let z = -2 * Math.sqrt(2) * Math.sqrt(c * (1 - c)) * Math.cos(2 * t);
            const norm = Math.sqrt(x * x + y * y + z * z);
            points.push([x / norm, y / norm, z / norm]);
        }
        return points;
    },

    /** Rotate point [x,y,z] about the X axis by angle (rad) */
    rotateX(p, angle) {
        const [x, y, z] = p;
        const c = Math.cos(angle), s = Math.sin(angle);
        return [x, y * c - z * s, y * s + z * c];
    },

    /** Rotate point [x,y,z] about the Z axis by angle (rad) */
    rotateZ(p, angle) {
        const [x, y, z] = p;
        const c = Math.cos(angle), s = Math.sin(angle);
        return [x * c - y * s, x * s + y * c, z];
    },

    /**
     * Builds a rotation matrix (3x3, row-major flat array) that rotates the
     * world Z axis [0,0,1] onto the target unit vector `axis` (Rodrigues' formula).
     */
    rotationFromZTo(axis) {
        const z = [0, 0, 1];
        const dot = z[0] * axis[0] + z[1] * axis[1] + z[2] * axis[2];

        // Already aligned
        if (dot > 0.999999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
        // Opposite direction: pick any perpendicular axis to flip 180deg
        if (dot < -0.999999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];

        const cx = z[1] * axis[2] - z[2] * axis[1];
        const cy = z[2] * axis[0] - z[0] * axis[2];
        const cz = z[0] * axis[1] - z[1] * axis[0];
        const sinA = Math.sqrt(cx * cx + cy * cy + cz * cz);
        const cosA = dot;
        const kx = cx / sinA, ky = cy / sinA, kz = cz / sinA;

        // Rodrigues rotation matrix: R = I + sinA*K + (1-cosA)*K^2
        const K = [
            0, -kz, ky,
            kz, 0, -kx,
            -ky, kx, 0
        ];
        const K2 = [
            -(ky * ky + kz * kz), kx * ky, kx * kz,
            kx * ky, -(kx * kx + kz * kz), ky * kz,
            kx * kz, ky * kz, -(kx * kx + ky * ky)
        ];

        const R = [];
        for (let i = 0; i < 9; i++) {
            R.push((i % 4 === 0 ? 1 : 0) + sinA * K[i] + (1 - cosA) * K2[i]);
        }
        return R;
    },

    applyMatrix(m, p) {
        return [
            m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
            m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
            m[6] * p[0] + m[7] * p[1] + m[8] * p[2]
        ];
    }
};
