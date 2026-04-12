// app.js - UI Controller and Plot.ly Integration

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Simulation engine
    const simulator = new PitchSimulator();

    // DOM Elements
    const elements = {
        speed: document.getElementById('speed'),
        spinRate: document.getElementById('spinRate'),
        tiltAngle: document.getElementById('tiltAngle'),
        gyroAngle: document.getElementById('gyroAngle'),
        releaseY: document.getElementById('releaseY'),
        releaseZ: document.getElementById('releaseZ'),
        releaseAngleV: document.getElementById('releaseAngleV'),
        releaseAngleH: document.getElementById('releaseAngleH'),
        
        // Visualizers
        tiltVis: document.getElementById('tiltAngle-vis'),
        gyroVis: document.getElementById('gyroAngle-vis'),
        releaseVVis: document.getElementById('releaseAngleV-vis'),
        releaseHVis: document.getElementById('releaseAngleH-vis'),

        simulateBtn: document.getElementById('simulateBtn'),
        animateBtn: document.getElementById('animateBtn'), // Added animate button
        statsOutput: document.getElementById('statsOutput')
    };

    // Update Value bubbles & Visualizers
    const bindVal = (inputId, valId) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(valId);
        
        const updateVisuals = () => {
            if(display) display.textContent = input.value;
            
            // Visualizer logic based on inputId
            const val = parseFloat(input.value);
            if(inputId === 'tiltAngle' && elements.tiltVis) {
                // Tilt: 0 is Up, 90 is Right, 180 is Down
                elements.tiltVis.style.transform = `rotate(${val}deg)`;
            } else if(inputId === 'gyroAngle' && elements.gyroVis) {
                // Gyro: 0 is true spin (looks flat), 90 points the rifle axis at you
                const scale = Math.cos(val * Math.PI / 180);
                elements.gyroVis.style.transform = `scaleX(${scale})`;
            } else if(inputId === 'releaseAngleV' && elements.releaseVVis) {
                // Vertical angle: Rotate a side-view horizontal arrow
                // Negative (downward) = rotate clockwise
                elements.releaseVVis.style.transform = `rotate(${-val}deg)`;
            } else if(inputId === 'releaseAngleH' && elements.releaseHVis) {
                // Horizontal angle: Rotate a top-down vertical arrow
                // Positive (left) = rotate counter-clockwise (since Y points left, typical math axis)
                // But from pitcher perspective looking away, positive Y is left. Left is - rotate.
                elements.releaseHVis.style.transform = `rotate(${-val}deg)`;
            }
        };

        input.addEventListener('input', updateVisuals);
        // Initialize state
        updateVisuals();
    };

    ['speed', 'spinRate', 'tiltAngle', 'gyroAngle', 'releaseY', 'releaseZ', 'releaseAngleV', 'releaseAngleH'].forEach(id => bindVal(id, id + '-val'));

    // Initial Camera View 
    let currentCameraEye = {x: -1.4, y: -1.4, z: 0.4};
    let animationId = null;

    // Plot initial empty state
    initPlot();

    // Event Listener for Simulation
    elements.simulateBtn.addEventListener('click', () => runSimulation(false));
    elements.animateBtn.addEventListener('click', () => runSimulation(true));
    
    // Auto-run once at startup
    runSimulation(false);

    function getParams() {
        return {
            speed: parseFloat(elements.speed.value),
            spinRate: parseFloat(elements.spinRate.value),
            tilt: parseFloat(elements.tiltAngle.value),
            gyro: parseFloat(elements.gyroAngle.value),
            releaseY: parseFloat(elements.releaseY.value),
            releaseZ: parseFloat(elements.releaseZ.value),
            releaseAngleV: parseFloat(elements.releaseAngleV.value),
            releaseAngleH: parseFloat(elements.releaseAngleH.value)
        };
    }

    function runSimulation(animate = false) {
        if(animationId) cancelAnimationFrame(animationId);
        
        const params = getParams();
        const trajectory = simulator.simulate(params);
        
        if (animate) {
            animateTrajectory(trajectory);
        } else {
            plotTrajectory(trajectory);
            updateStats(trajectory);
        }
    }

    function animateTrajectory(traj) {
        let currentIdx = 0;
        const totalPoints = traj.x.length;
        
        const partialTraj = {
            t: [traj.t[0]],
            x: [traj.x[0]],
            y: [traj.y[0]],
            z: [traj.z[0]]
        };
        
        plotTrajectory(partialTraj);
        elements.statsOutput.innerHTML = "Animating (Slow Motion)...";
        elements.statsOutput.style.color = '#e2e8f0';

        function step() {
            // Advance by a few points per frame to create slow-motion effect
            const pointsToAdvance = 2; 
            currentIdx += pointsToAdvance;
            
            if(currentIdx >= totalPoints) {
                currentIdx = totalPoints - 1;
            }
            
            partialTraj.t = traj.t.slice(0, currentIdx + 1);
            partialTraj.x = traj.x.slice(0, currentIdx + 1);
            partialTraj.y = traj.y.slice(0, currentIdx + 1);
            partialTraj.z = traj.z.slice(0, currentIdx + 1);
            
            plotTrajectory(partialTraj);

            if(currentIdx < totalPoints - 1) {
                animationId = requestAnimationFrame(step);
            } else {
                updateStats(traj);
            }
        }
        
        animationId = requestAnimationFrame(step);
    }

    function initPlot() {
        const layout = getPlotLayout();
        const data = [{
            type: 'scatter3d',
            mode: 'lines',
            x: [], y: [], z: [],
            line: { width: 6, color: '#3b82f6' }
        }];

        Plotly.newPlot('plot-container', data, layout, {responsive: true});
    }

    function getPlotLayout() {
        // Read current camera if plot exists to prevent snapping during animation
        const plotDiv = document.getElementById('plot-container');
        let camera = currentCameraEye;
        if (plotDiv && plotDiv._fullLayout && plotDiv._fullLayout.scene) {
            camera = plotDiv._fullLayout.scene.camera.eye;
        }

        return {
            margin: { l: 0, r: 0, b: 0, t: 0 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            scene: {
                xaxis: { 
                    title: 'X (Distance m)', 
                    range: [0, 19], 
                    backgroundcolor: "rgba(15,23,42,0.5)",
                    gridcolor: "rgba(255,255,255,0.1)",
                    showbackground: true,
                    zerolinecolor: "rgba(255,255,255,0.2)"
                },
                yaxis: { 
                    title: 'Y (Horizontal m)', 
                    range: [-2, 2],
                    backgroundcolor: "rgba(15,23,42,0.5)",
                    gridcolor: "rgba(255,255,255,0.1)",
                    showbackground: true,
                    zerolinecolor: "rgba(255,255,255,0.2)"
                },
                zaxis: { 
                    title: 'Z (Height m)', 
                    range: [0, 2.5],
                    backgroundcolor: "rgba(15,23,42,0.5)",
                    gridcolor: "rgba(255,255,255,0.1)",
                    showbackground: true,
                    zerolinecolor: "rgba(255,255,255,0.2)"
                },
                camera: {
                    eye: camera
                },
                aspectratio: { x: 3, y: 1, z: 1 } // Stretch the X axis so it looks like a baseball field
            }
        };
    }

    function plotTrajectory(traj) {
        
        // Add strike zone box for visual reference
        // Zone: X=18.44, Y=[-0.21, 0.21], Z=[0.45, 1.05]
        const zoneX = [18.44, 18.44, 18.44, 18.44, 18.44];
        const zoneY = [-0.21, 0.21, 0.21, -0.21, -0.21];
        const zoneZ = [0.45, 0.45, 1.05, 1.05, 0.45];

        const data = [
            {
                type: 'scatter3d',
                mode: 'lines',
                name: 'Pitch Trajectory',
                x: traj.x,
                y: traj.y,
                z: traj.z,
                line: { width: 8, color: traj.z, colorscale: 'Viridis' }
            },
            {
                type: 'scatter3d',
                mode: 'lines',
                name: 'Strike Zone',
                x: zoneX,
                y: zoneY,
                z: zoneZ,
                line: { width: 4, color: 'rgba(239, 68, 68, 0.8)' }
            }
        ];

        Plotly.react('plot-container', data, getPlotLayout(), {responsive: true});
    }

    function updateStats(traj) {
        const lastIdx = traj.x.length - 1;
        const finalTime = traj.t[lastIdx].toFixed(3);
        const finalX = traj.x[lastIdx];
        
        if (finalX < 18.44) {
            elements.statsOutput.innerHTML = `Bounced in dirt at ${finalX.toFixed(2)}m (Time: ${finalTime}s)`;
            elements.statsOutput.style.color = '#f87171'; // red
        } else {
            const finalY = traj.y[lastIdx]*100; // cm
            const finalZ = traj.z[lastIdx]*100; // cm
            elements.statsOutput.innerHTML = `Crossed plate at Y: ${finalY.toFixed(1)}cm, Z: ${finalZ.toFixed(1)}cm (Flight time: ${finalTime}s)`;
            elements.statsOutput.style.color = '#a78bfa'; // match original stats string
        }
    }
});
