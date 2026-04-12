// physics.js - Baseball fluid dynamics simulation

const PhysicsConstants = {
    M: 0.145,       // Mass of baseball in kg
    R: 0.0365,      // Radius of baseball in m
    RHO: 1.225,     // Air density in kg/m^3
    G: 9.81,        // Gravity in m/s^2
    CD: 0.3,        // Drag coefficient (approximate for baseball)
    DIST: 18.44     // Distance from mound to home plate in m
};

Object.freeze(PhysicsConstants);

class PitchSimulator {
    constructor() {
        this.A = Math.PI * Math.pow(PhysicsConstants.R, 2); // Cross-sectional area
    }

    /**
     * Converts inputs and simulates pitch trajectory using RK4
     */
    simulate(params) {
        // 1. Initial State Setup
        const v0 = params.speed * 1000 / 3600; // km/h to m/s
        const omega = params.spinRate * 2 * Math.PI / 60; // RPM to rad/s
        
        // Spin axis (Convert tilt and gyro to radians)
        const tilt = params.tilt * Math.PI / 180;
        const gyro = params.gyro * Math.PI / 180;
        
        // Calculate angular velocity vector (omega)
        // X = towards home plate, Y = left, Z = up
        // Tilt 0 = Backspin (axis -Y to generate upward lift), Tilt 90 = Side spin (axis -Z to generate rightward lift), Tilt 180 = Topspin (axis +Y)
        // Gyro 90 = Rifle spin (axis +X)
        const wx = omega * Math.sin(gyro);
        const wy = -omega * Math.cos(gyro) * Math.cos(tilt);
        const wz = -omega * Math.cos(gyro) * Math.sin(tilt);
        const wVector = [wx, wy, wz];

        // Initial position
        const x0 = 0.0;
        const y0 = params.releaseY;
        const z0 = params.releaseZ;

        // Target aiming removed: Velocity is directly derived from release angles
        const angleV = params.releaseAngleV * Math.PI / 180;
        const angleH = params.releaseAngleH * Math.PI / 180;

        // Initial velocity vector
        let vx0 = v0 * Math.cos(angleV) * Math.cos(angleH);
        let vy0 = v0 * Math.cos(angleV) * Math.sin(angleH);
        let vz0 = v0 * Math.sin(angleV);

        // Initial State [x, y, z, vx, vy, vz]
        let state = [x0, y0, z0, vx0, vy0, vz0];

        // Simulation parameters
        const dt = 0.005; // 5ms step
        let t = 0;
        const trajectory = {
            t: [t],
            x: [x0],
            y: [y0],
            z: [z0]
        };

        // Runge-Kutta Simulation loop
        while (state[0] < PhysicsConstants.DIST && state[2] > 0 && t < 2.0) {
            state = this.rk4Step(state, wVector, dt, t);
            t += dt;
            trajectory.t.push(t);
            trajectory.x.push(state[0]);
            trajectory.y.push(state[1]);
            trajectory.z.push(state[2]);
        }

        return trajectory;
    }

    /**
     * Compute derivatives: [dx/dt, dy/dt, dz/dt, dvx/dt, dvy/dt, dvz/dt]
     */
    derivatives(state, wVector, t) {
        const [x, y, z, vx, vy, vz] = state;
        const vSq = vx*vx + vy*vy + vz*vz;
        const vMag = Math.sqrt(vSq);
        
        // Stop if ball somehow stops
        if (vMag === 0) return [0,0,0, 0,0,0];

        // Velocity unit vector
        const vHat = [vx/vMag, vy/vMag, vz/vMag];
        
        // Spin magnitude
        const wMag = Math.sqrt(wVector[0]*wVector[0] + wVector[1]*wVector[1] + wVector[2]*wVector[2]);
        
        // Drag Force
        // F_d = -0.5 * rho * Cd * A * v^2 * vHat
        const dragMag = 0.5 * PhysicsConstants.RHO * PhysicsConstants.CD * this.A * vSq;
        const Fdx = -dragMag * vHat[0];
        const Fdy = -dragMag * vHat[1];
        const Fdz = -dragMag * vHat[2];

        // Magnus Force
        let Fmx = 0, Fmy = 0, Fmz = 0;
        if (wMag > 0) {
            // Spin factor S = R * omega / v
            const S = (PhysicsConstants.R * wMag) / vMag;
            // Lift coefficient approximation (Alan Nathan)
            let Cl = 0;
            if (S < 0.1) Cl = 1.5 * S;
            else Cl = 0.09 + 0.6 * S; // simple linear approx
            // Cap Cl
            Cl = Math.min(Cl, 0.4);

            // Magnus cross product: wVector X vVector
            const cx = wVector[1]*vz - wVector[2]*vy;
            const cy = wVector[2]*vx - wVector[0]*vz;
            const cz = wVector[0]*vy - wVector[1]*vx;
            
            // Normalize cross product to get direction
            const cMag = Math.sqrt(cx*cx + cy*cy + cz*cz);
            if (cMag > 0) {
                const magnusForceMag = 0.5 * PhysicsConstants.RHO * Cl * this.A * vSq;
                Fmx = magnusForceMag * (cx / cMag);
                Fmy = magnusForceMag * (cy / cMag);
                Fmz = magnusForceMag * (cz / cMag);
            }
        }

        // Knuckleball Force (Flutter Effect) for very low spin
        let Fkx = 0, Fky = 0, Fkz = 0;
        const rpm = wMag * 60 / (2 * Math.PI);
        if (rpm < 300) {
            // Calculate a knuckle factor (1.0 at 0 rpm, 0.0 at 300 rpm)
            const knuckleFactor = (300 - rpm) / 300;
            // Max lateral/lift coefficient for knuckleball flutter is around 0.15
            const C_k = 0.18 * knuckleFactor;
            const magFk = 0.5 * PhysicsConstants.RHO * C_k * this.A * vSq;
            
            // The seams cause oscillating lift/drag depending on orientation.
            // Simulate random-like oscillation using combination of sine waves.
            // (Time scale is ~0.5s for a pitch, so we want frequencies around 1.5 - 3.5 Hz)
            Fky = magFk * Math.sin(2 * Math.PI * 2.2 * t) * Math.cos(2 * Math.PI * 0.8 * t);
            Fkz = magFk * Math.cos(2 * Math.PI * 1.8 * t) * Math.sin(2 * Math.PI * 1.1 * t);
        }

        // Accelerations
        const ax = (Fdx + Fmx + Fkx) / PhysicsConstants.M;
        const ay = (Fdy + Fmy + Fky) / PhysicsConstants.M;
        const az = ((Fdz + Fmz + Fkz) / PhysicsConstants.M) - PhysicsConstants.G;

        return [vx, vy, vz, ax, ay, az];
    }

    /**
     * 4th-Order Runge-Kutta Step
     */
    rk4Step(state, wVector, dt, t) {
        const k1 = this.derivatives(state, wVector, t);
        
        const stateK2 = state.map((val, i) => val + 0.5 * dt * k1[i]);
        const k2 = this.derivatives(stateK2, wVector, t + 0.5 * dt);
        
        const stateK3 = state.map((val, i) => val + 0.5 * dt * k2[i]);
        const k3 = this.derivatives(stateK3, wVector, t + 0.5 * dt);
        
        const stateK4 = state.map((val, i) => val + dt * k3[i]);
        const k4 = this.derivatives(stateK4, wVector, t + dt);

        return state.map((val, i) => val + (dt / 6.0) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
    }
}
