// elements
const canvas = document.getElementById('appCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const instructions = document.getElementById('instructions');

const btnDraw = document.getElementById('btnDraw');
const btnEdit = document.getElementById('btnEdit');
const btnClear = document.getElementById('btnClear');

const inputTileW = document.getElementById('tileW');
const inputTileH = document.getElementById('tileH');
const inputJoint = document.getElementById('joint');
const inputOffsetX = document.getElementById('offsetX');
const inputOffsetY = document.getElementById('offsetY');
const FIXED_PX_PER_CM = 10; // 1cm = 10px (référentiel interne fixe)
const inputScale = document.getElementById('scale');
const inputTileShape = document.getElementById('tileShape');
const inputAngle = document.getElementById('angle');
const inputStaggerX = document.getElementById('staggerX');
const inputStaggerY = document.getElementById('staggerY');
const inputStaggerCycle = document.getElementById('staggerCycle');

const preciseInputGroup = document.getElementById('preciseInputGroup');
const inputWallLength = document.getElementById('wallLength');
const btnApplyWall = document.getElementById('btnApplyWall');

const statArea = document.getElementById('statArea');
const statAreaMarge = document.getElementById('statAreaMarge');
const statFullTiles = document.getElementById('statFullTiles');
const statCutTiles = document.getElementById('statCutTiles');
const statTotalTiles = document.getElementById('statTotalTiles');

// État de la vue (Caméra)
let view = {
    x: 0,
    y: 0,
    zoom: 1
};
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };

// State
let mode = 'DRAW'; // DRAW, EDIT
let points = [];
let isClosed = false;
let mousePos = { x: 0, y: 0 };
let isDraggingGrid = false;
let isDraggingPoint = null;
let dragStart = { x: 0, y: 0 };
let initialOffset = { x: 0, y: 0 };

const SNAP_DIST = 15; // pixels to snap to start point
const POINT_RADIUS = 6;

// Convertir coordonnée écran vers coordonnée monde
function screenToWorld(x, y) {
    return {
        x: (x - canvas.width / 2 - view.x) / view.zoom + canvas.width / 2,
        y: (y - canvas.height / 2 - view.y) / view.zoom + canvas.height / 2
    };
}

// Centrer la vue sur la pièce
function centerView() {
    if (points.length === 0) {
        view = { x: 0, y: 0, zoom: 1 };
    } else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        view.x = (canvas.width / 2 - centerX);
        view.y = (canvas.height / 2 - centerY);
        view.zoom = 0.8; // Zoom par défaut pour voir toute la pièce
    }
    draw();
}

// Resize canvas to fill container
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        view.x += dx;
        view.y += dy;
        lastMousePos = { x: e.clientX, y: e.clientY };
        draw();
    }
    // Pour le dessin, on convertit la position de la souris
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    mousePos = screenToWorld(rawX, rawY);

});

window.addEventListener('mouseup', () => {
    isPanning = false;
});

document.getElementById('btnZoomIn').onclick = () => { view.zoom *= 1.2; draw(); };
document.getElementById('btnZoomOut').onclick = () => { view.zoom /= 1.2; draw(); };
document.getElementById('btnCenter').onclick = centerView;
document.getElementById('btnPanUp').onclick = () => { view.y += 50; draw(); };
document.getElementById('btnPanDown').onclick = () => { view.y -= 50; draw(); };
document.getElementById('btnPanLeft').onclick = () => { view.x += 50; draw(); };
document.getElementById('btnPanRight').onclick = () => { view.x -= 50; draw(); };

// Setup UI Events
btnDraw.addEventListener('click', () => setMode('DRAW'));
btnEdit.addEventListener('click', () => setMode('EDIT'));
btnClear.addEventListener('click', () => {
    points = [];
    isClosed = false;
    inputOffsetX.value = 0;
    inputOffsetY.value = 0;
    instructions.classList.remove('hidden');
    updatePreciseInputVisibility();
    draw();
});

[inputTileW, inputTileH, inputJoint, inputOffsetX, inputOffsetY, inputScale, inputTileShape, inputAngle, inputStaggerX, inputStaggerY, inputStaggerCycle].forEach(el => {
    if (el) el.addEventListener('input', draw);
});

if (inputTileShape) {
    inputTileShape.addEventListener('change', () => {
        if (inputTileShape.value === 'hexa') {
            inputTileH.disabled = true;
            inputTileH.value = (parseFloat(inputTileW.value) * 2 / Math.sqrt(3)).toFixed(1);
        } else if (inputTileShape.value === 'octo') {
            inputTileH.disabled = true;
            inputTileH.value = inputTileW.value;
        } else {
            inputTileH.disabled = false;
        }
        draw();
    });
}
inputTileW.addEventListener('input', () => {
    if (inputTileShape && inputTileShape.value === 'hexa') {
        inputTileH.value = (parseFloat(inputTileW.value) * 2 / Math.sqrt(3)).toFixed(1);
    } else if (inputTileShape && inputTileShape.value === 'octo') {
        inputTileH.value = inputTileW.value;
    }
});

function updatePreciseInputVisibility() {
    if (mode === 'DRAW' && points.length > 0 && !isClosed) {
        preciseInputGroup.style.display = 'block';
        inputWallLength.focus();
    } else {
        preciseInputGroup.style.display = 'none';
        inputWallLength.value = '';
    }
}

function setMode(newMode) {
    mode = newMode;
    btnDraw.classList.toggle('active', mode === 'DRAW');
    btnEdit.classList.toggle('active', mode === 'EDIT');
    container.style.cursor = mode === 'DRAW' ? 'crosshair' : 'grab';
    updatePreciseInputVisibility();
    draw();
}

function applyPreciseWall() {
    if (mode !== 'DRAW' || points.length === 0 || isClosed) return;

    const lengthCm = parseFloat(inputWallLength.value);
    if (!lengthCm || lengthCm <= 0) return;

    const pxlScale = FIXED_PX_PER_CM || 3;
    const lengthPx = lengthCm * pxlScale;

    const last = points[points.length - 1];
    const angle = Math.atan2(mousePos.y - last.y, mousePos.x - last.x);

    let p = {
        x: last.x + Math.cos(angle) * lengthPx,
        y: last.y + Math.sin(angle) * lengthPx
    };

    if (points.length > 2) {
        const start = points[0];
        if (Math.hypot(p.x - start.x, p.y - start.y) < SNAP_DIST) {
            isClosed = true;
            updatePreciseInputVisibility();
            draw();
            return;
        }
    }

    points.push(p);
    inputWallLength.value = '';
    updatePreciseInputVisibility();
    draw();
}

btnApplyWall.addEventListener('click', applyPreciseWall);
inputWallLength.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyPreciseWall();
});

// Canvas Mouse Events
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // 1. IMPORTANT : Convertir la position souris en coordonnées "Monde" (prise en compte du zoom/pan)
    mousePos = screenToWorld(sx, sy);

    // Gestion du déplacement de la vue (Panoramique) avec clic milieu
    if (isPanning) {
        view.x += (e.clientX - lastMousePos.x);
        view.y += (e.clientY - lastMousePos.y);
        lastMousePos = { x: e.clientX, y: e.clientY };
        draw();
        return;
    }

    // Contrainte Shift pendant le DESSIN (création de nouveaux points)
    if (e.shiftKey && !isClosed && points.length > 0 && mode === 'DRAW') {
        const last = points[points.length - 1];
        const dx = Math.abs(mousePos.x - last.x);
        const dy = Math.abs(mousePos.y - last.y);
        if (dx > dy) mousePos.y = last.y;
        else mousePos.x = last.x;
    }

    // Logique de Dragging
    if (isDraggingGrid && mode === 'EDIT') {
        const pxlScale = FIXED_PX_PER_CM;
        const dx = (mousePos.x - dragStart.x) / pxlScale;
        const dy = (mousePos.y - dragStart.y) / pxlScale;
        inputOffsetX.value = Math.round(initialOffset.x + dx);
        inputOffsetY.value = Math.round(initialOffset.y + dy);
        draw();
    } 
	else if (isDraggingPoint !== null) {
		const p = mousePos;
		// Récupérer les voisins
		const prev = points[(isDraggingPoint + points.length - 1) % points.length];
		const next = points[(isDraggingPoint + 1) % points.length];

		if (e.shiftKey) {
			let snapX = p.x;
			let snapY = p.y;

			// Seuil de magnétisme (ajusté au zoom pour rester constant à l'écran)
			const threshold = 15 / view.zoom;

			// Alignement X (Vertical) : on s'aligne si on est proche du X de l'un des voisins
			if (Math.abs(p.x - prev.x) < threshold) snapX = prev.x;
			else if (Math.abs(p.x - next.x) < threshold) snapX = next.x;

			// Alignement Y (Horizontal) : on s'aligne si on est proche du Y de l'un des voisins
			if (Math.abs(p.y - prev.y) < threshold) snapY = prev.y;
			else if (Math.abs(p.y - next.y) < threshold) snapY = next.y;

			points[isDraggingPoint].x = snapX;
			points[isDraggingPoint].y = snapY;
		} else {
			points[isDraggingPoint].x = p.x;
			points[isDraggingPoint].y = p.y;
		}
		draw();
	}
    else {
        // Gestion du curseur et prévisualisation
        let hoveringPoint = false;
        if (isClosed) {
            for (let i = 0; i < points.length; i++) {
                // Ajuster la zone de détection au zoom
                if (Math.hypot(points[i].x - mousePos.x, points[i].y - mousePos.y) < (POINT_RADIUS * 2) / view.zoom) {
                    hoveringPoint = true;
                    break;
                }
            }
        }
        
        canvas.style.cursor = hoveringPoint ? 'move' : (mode === 'DRAW' ? 'crosshair' : 'grab');

        // Redessiner pour la ligne de prévisualisation en mode dessin
        if (!isClosed && mode === 'DRAW') {
            draw();
        }
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (mode === 'EDIT' && e.shiftKey)) { 
        isPanning = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
    }
	if (e.button !== 0) return; // only left click

    // Check if clicking a point
    if (isClosed) {
        for (let i = 0; i < points.length; i++) {
            if (Math.hypot(points[i].x - mousePos.x, points[i].y - mousePos.y) < POINT_RADIUS * 2) {
                isDraggingPoint = i;
                return;
            }
        }
    }

    if (mode === 'EDIT' && isClosed) {
        isDraggingGrid = true;
        dragStart = { ...mousePos };
        initialOffset = {
            x: parseFloat(inputOffsetX.value) || 0,
            y: parseFloat(inputOffsetY.value) || 0
        };
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const oldZoom = view.zoom;
    view.zoom = Math.min(Math.max(0.1, view.zoom + delta), 10);
    draw();
}, { passive: false });

canvas.addEventListener('mouseup', (e) => {
    if (isDraggingGrid) {
        isDraggingGrid = false;
        canvas.style.cursor = 'grab';
        return;
    }
    if (isDraggingPoint !== null) {
        isDraggingPoint = null;
        return;
    }

    if (mode === 'DRAW' && !isClosed) {
        instructions.classList.add('hidden');

        let p = { ...mousePos };

        // Orthogonal snap with Shift
        if (e.shiftKey && points.length > 0) {
            const last = points[points.length - 1];
            const dx = Math.abs(p.x - last.x);
            const dy = Math.abs(p.y - last.y);
            if (dx > dy) p.y = last.y;
            else p.x = last.x;
        }

        // Close polygon if near start
        if (points.length > 2) {
            const start = points[0];
            if (Math.hypot(p.x - start.x, p.y - start.y) < SNAP_DIST) {
                isClosed = true;
                updatePreciseInputVisibility();
                draw();
                return;
            }
        }

        points.push(p);
        updatePreciseInputVisibility();
        draw();
    }
});

canvas.addEventListener('mouseleave', () => {
    isDraggingGrid = false;
    isDraggingPoint = null;
    canvas.style.cursor = mode === 'DRAW' ? 'crosshair' : 'grab';
    draw();
});
canvas.addEventListener('dblclick', (e) => {
    const worldP = mousePos; // Déjà converti via screenToWorld dans mousemove

    // 1. Double-clic sur un point existant -> Suppression
    for (let i = 0; i < points.length; i++) {
        if (Math.hypot(points[i].x - worldP.x, points[i].y - worldP.y) < POINT_RADIUS * 2) {
            points.splice(i, 1);
            if (points.length < 3) isClosed = false;
            draw();
            return;
        }
    }

    // 2. Double-clic sur une ligne -> Ajouter point OU modifier longueur
    if (isClosed) {
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            
            if (getDistToSegment(worldP, p1, p2) < 10) {
                const action = confirm("Voulez-vous modifier la longueur de ce mur ?\n(Annuler pour simplement ajouter un point)");
                
                if (action) {
                    const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) / FIXED_PX_PER_CM;
                    const newLen = prompt("Nouvelle longueur (cm) :", Math.round(currentLen));
                    
                    if (newLen && !isNaN(newLen)) {
                        const ratio = (parseFloat(newLen) * FIXED_PX_PER_CM) / Math.hypot(p2.x - p1.x, p2.y - p1.y);
                        const dx = (p2.x - p1.x) * (ratio - 1);
                        const dy = (p2.y - p1.y) * (ratio - 1);
                        
                        // On déplace P2 et tous les points suivants pour conserver la forme
                        for (let j = (i + 1) % points.length; j < points.length; j++) {
                            points[j].x += dx;
                            points[j].y += dy;
                            if (j === 0 && isClosed) break; // Sécurité polygone
                        }
                    }
                } else {
                    // Ajouter un point à l'endroit du clic
                    points.splice(i + 1, 0, { x: worldP.x, y: worldP.y });
                }
                draw();
                return;
            }
        }
    }
});

// Math Helpers
function rotatePoint(p, angleRad) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
    };
}

function polygonArea(pts) {
    let area = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
    }
    return Math.abs(area / 2);
}

// Ray-casting point in polygon
function pointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Line intersection
function lineIntersection(p1, p2, p3, p4) {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (denom === 0) return false;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Check if a tile polygon intersects with room polygon
function testTileIntersection(tilePoly, roomPoly) {
    // 1. Check if any tile corner is inside room
    let allInside = true;
    let anyInside = false;
    for (let pt of tilePoly) {
        if (pointInPolygon(pt, roomPoly)) {
            anyInside = true;
        } else {
            allInside = false;
        }
    }

    // 2. Check if any room corner is inside tile
    let anyRoomInside = false;
    for (let pt of roomPoly) {
        if (pointInPolygon(pt, tilePoly)) {
            anyRoomInside = true;
            break;
        }
    }

    // 3. Check line intersections
    let linesIntersect = false;
    for (let i = 0; i < tilePoly.length; i++) {
        const t1 = tilePoly[i];
        const t2 = tilePoly[(i + 1) % tilePoly.length];
        for (let j = 0; j < roomPoly.length; j++) {
            const r1 = roomPoly[j];
            const r2 = roomPoly[(j + 1) % roomPoly.length];
            if (lineIntersection(t1, t2, r1, r2)) {
                linesIntersect = true;
                break;
            }
        }
        if (linesIntersect) break;
    }

    const intersects = anyInside || anyRoomInside || linesIntersect;
    const isFull = allInside && !linesIntersect; // Strictly inside and edges don't cross boundaries inward

    if (!intersects) return false;
    return isFull ? 'FULL' : 'CUT';
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Appliquer la transformation de vue
    ctx.translate(canvas.width / 2 + view.x, canvas.height / 2 + view.y);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Grid Background
    const drawGrid = false; // Using CSS grid instead for the background

    const pxlScale = FIXED_PX_PER_CM || 3;
    const tW = parseFloat(inputTileW.value) || 60;
    let tH = parseFloat(inputTileH.value) || 60;
    const joint = (parseFloat(inputJoint.value) || 3) / 10; // mm to cm
    const oX = (parseFloat(inputOffsetX.value) || 0);
    const oY = (parseFloat(inputOffsetY.value) || 0);
    const angleRad = (parseFloat(inputAngle?.value) || 0) * Math.PI / 180;
    const shape = inputTileShape?.value || 'rect';

    if (shape === 'hexa') {
        tH = tW * 2 / Math.sqrt(3);
    } else if (shape === 'octo') {
        tH = tW;
    }

    // Draw Room Polygon
    if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (isClosed) {
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        }

        ctx.strokeStyle = "#2c3e50";
        ctx.lineWidth = 3 / view.zoom;;
        ctx.stroke();

        if (!isClosed && mode === 'DRAW') {
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.strokeStyle = "rgba(44, 62, 80, 0.5)";
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]); // Dash divisé
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw current segment length preview
            const last = points[points.length - 1];
            const distPx = Math.hypot(mousePos.x - last.x, mousePos.y - last.y);
            const distCm = distPx / pxlScale;

            ctx.fillStyle = "#e74c3c";
            ctx.font = "bold 14px 'Outfit', sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            const mx = (last.x + mousePos.x) / 2;
            const my = (last.y + mousePos.y) / 2;
            ctx.fillText(`${Math.round(distCm)} cm`, mx + 15, my - 15);
        }

        // Draw vertices
        for (let i = 0; i < points.length; i++) {
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, POINT_RADIUS / view.zoom, 0, Math.PI * 2);
            ctx.fillStyle = (i === 0 && !isClosed) ? "#e74c3c" : "#3498db";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2 / view.zoom;
            ctx.stroke();
        }

        // Draw wall dimensions
        ctx.fillStyle = "#2c3e50";
        ctx.font = `bold ${13 / view.zoom}px 'Outfit', sans-serif`; // Taille police divisée
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 0; i < points.length; i++) {
            if (!isClosed && i === points.length - 1) break;

            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const distCm = distPx / pxlScale;

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;

            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const offX = Math.cos(angle - Math.PI / 2) * (20 / view.zoom);
            const offY = Math.sin(angle - Math.PI / 2) * (20 / view.zoom);

            ctx.save();
            ctx.translate(mx + offX, my + offY);
            let textAngle = angle;
            if (textAngle > Math.PI / 2 || textAngle <= -Math.PI / 2) {
                textAngle += Math.PI;
            }
            ctx.rotate(textAngle);

            const txt = `${Math.round(distCm)} cm`;
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillRect(-tw / 2 - 4 / view.zoom, -10 / view.zoom, tw + 8 / view.zoom, 20 / view.zoom);

            ctx.fillStyle = "#2c3e50";
            ctx.fillText(txt, 0, 0);
            ctx.restore();
        }
    }

    // Tiling Logic
    if (isClosed && points.length > 2) {
        const anchor = points[0];

        // 1. Transform points into local coordinates oriented with tiles
        const localPoints = points.map(p => {
            let rel = { x: p.x - anchor.x, y: p.y - anchor.y };
            return rotatePoint(rel, -angleRad);
        });

        // 2. Calculate Bounding Box of Room in local coords
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        localPoints.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        // Set clipping mask for visual grid
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.clip();

        // Convert tile dims to canvas pixels
        const tileW_px = tW * pxlScale;
        const tileH_px = tH * pxlScale;
        const joint_px = joint * pxlScale;

        // Modulo for seamless dragging grid
        let stepX = tileW_px + joint_px;
        let stepY = tileH_px + joint_px;
        if (shape === 'hexa') {
            stepY = tileH_px * 0.75 + joint_px;
        }

        const offsetX_px = (oX * pxlScale) % stepX;
        const offsetY_px = (oY * pxlScale) % stepY;

        // Generator for tiles 
        let localTiles = [];

		if (shape === 'rect') {
			const staggerX = parseFloat(inputStaggerX?.value || 0) / 100;
			const staggerY = parseFloat(inputStaggerY?.value || 0) / 100;
			const cycle = parseInt(inputStaggerCycle?.value || 2); // Nombre de lignes du cycle

			const startCol = Math.floor((minX - offsetX_px) / stepX) - cycle;
			const endCol = Math.ceil((maxX - offsetX_px) / stepX) + cycle;
			const startRow = Math.floor((minY - offsetY_px) / stepY) - cycle;
			const endRow = Math.ceil((maxY - offsetY_px) / stepY) + cycle;

			for (let iy = startRow; iy <= endRow; iy++) {
				for (let ix = startCol; ix <= endCol; ix++) {
					let tx = ix * stepX + offsetX_px;
					let ty = iy * stepY + offsetY_px;

					// Calcul de la position dans le cycle (0, 1, 2... cycle-1)
					// On utilise un modulo robuste pour les nombres négatifs
					const cycleIndexX = ((iy % cycle) + cycle) % cycle;
					const cycleIndexY = ((ix % cycle) + cycle) % cycle;

					// Application du décalage progressif
					if (staggerX > 0) {
						// Chaque ligne du cycle ajoute une fraction de décalage supplémentaire
						tx += (tileW_px * staggerX) * cycleIndexX;
					} 
					else if (staggerY > 0) {
						// Chaque colonne du cycle ajoute une fraction de décalage supplémentaire
						ty += (tileH_px * staggerY) * cycleIndexY;
					}

					localTiles.push({
						type: 'main', poly: [
							{ x: tx, y: ty }, 
							{ x: tx + tileW_px, y: ty }, 
							{ x: tx + tileW_px, y: ty + tileH_px }, 
							{ x: tx, y: ty + tileH_px }
						]
					});
				}
			}
		}
		
		else if (shape === 'hexa') {
            const startRow = Math.floor((minY - offsetY_px) / stepY);
            const endRow = Math.ceil((maxY - offsetY_px) / stepY);
            const startCol = Math.floor((minX - offsetX_px - stepX / 2) / stepX);
            const endCol = Math.ceil((maxX - offsetX_px) / stepX);

            for (let r = startRow; r <= endRow; r++) {
                const y = r * stepY + offsetY_px;
                const offsetCol = (Math.abs(r) % 2 === 1) ? stepX / 2 : 0;
                for (let c = startCol; c <= endCol; c++) {
                    const x = c * stepX + offsetCol + offsetX_px;
                    localTiles.push({
                        type: 'main', poly: [
                            { x: x + tileW_px / 2, y: y },
                            { x: x + tileW_px, y: y + tileH_px / 4 },
                            { x: x + tileW_px, y: y + tileH_px * 3 / 4 },
                            { x: x + tileW_px / 2, y: y + tileH_px },
                            { x: x, y: y + tileH_px * 3 / 4 },
                            { x: x, y: y + tileH_px / 4 }
                        ]
                    });
                }
            }
        } else if (shape === 'octo') {
            const cx = tileW_px / (2 + Math.SQRT2);
            const cy = tileH_px / (2 + Math.SQRT2);
            const startX = Math.floor((minX - offsetX_px - stepX) / stepX) * stepX + offsetX_px;
            const startY = Math.floor((minY - offsetY_px - stepY) / stepY) * stepY + offsetY_px;

            for (let x = startX; x <= maxX + stepX; x += stepX) {
                for (let y = startY; y <= maxY + stepY; y += stepY) {
                    localTiles.push({
                        type: 'main', poly: [
                            { x: x + cx, y: y }, { x: x + tileW_px - cx, y: y },
                            { x: x + tileW_px, y: y + cy }, { x: x + tileW_px, y: y + tileH_px - cy },
                            { x: x + tileW_px - cx, y: y + tileH_px }, { x: x + cx, y: y + tileH_px },
                            { x: x, y: y + tileH_px - cy }, { x: x, y: y + cy }
                        ]
                    });

                    const cabCenterX = x + tileW_px + joint_px / 2;
                    const cabCenterY = y + tileH_px + joint_px / 2;
                    const dx = cx + joint_px / 2;
                    const dy = cy + joint_px / 2;
                    localTiles.push({
                        type: 'cab', poly: [
                            { x: cabCenterX, y: cabCenterY - dy }, { x: cabCenterX + dx, y: cabCenterY },
                            { x: cabCenterX, y: cabCenterY + dy }, { x: cabCenterX - dx, y: cabCenterY }
                        ]
                    });
                }
            }
		} else if (shape === 'fish') {
			// ── Géométrie de l'écaille ──────────────────────────────────────────
			//
			//  Cellule de dimensions (w × h), coin haut-gauche en (xLeft, yTop) :
			//
			//    A = (xLeft,   yTop)        ← coin haut-gauche
			//    B = (xLeft+w, yTop)        ← coin haut-droit
			//    P = (xLeft+w/2, yTop+h)    ← pointe basse
			//
			//  Arc 1 – demi-ellipse convexe A→B (bombée VERS LE HAUT) :
			//    Centre C1 = (xLeft+w/2, yTop)
			//    Rayons (rX=w/2, rY=h)
			//    Angle 180°→0°  →  y = yTop - sin(a)*h  (sin>0 = monte au-dessus de yTop)
			//
			//  Arc 2 – quart d'ellipse concave B→P :
			//    Centre C2 = (xLeft+w, yTop+h)
			//    Rayons (rX=w/2, rY=h)
			//    Angle 90°→180°  →  part de B (cos=0,sin=−1 → +w/2 décalé → B ✓) vers P
			//
			//  Arc 3 – quart d'ellipse concave P→A :
			//    Centre C3 = (xLeft, yTop+h)
			//    Rayons (rX=w/2, rY=h)
			//    Angle 0°→−90°  →  part de P vers A
			//
			//  Emboîtement : stepX=w, stepY=h, quinconce sur rangées impaires (±w/2)
			// ─────────────────────────────────────────────────────────────────────

			const w  = tileW_px;
			const h  = tileH_px/2;
			const rX = w / 2;
			const rY = h;

			const stepX = w + joint_px;
			const stepY = h + joint_px;

			const startRow = Math.floor((minY - offsetY_px - stepY * 3) / stepY);
			const endRow   = Math.ceil ((maxY - offsetY_px + stepY * 3) / stepY);
			const startCol = Math.floor((minX - offsetX_px - stepX * 2) / stepX);
			const endCol   = Math.ceil ((maxX - offsetX_px + stepX * 2) / stepX);

			const N = 32; // segments par arc

			for (let row = startRow; row <= endRow; row++) {
				const yTop = row * stepY + offsetY_px;
				const colOff = (Math.abs(row) % 2 === 1) ? stepX / 2 : 0;

				for (let col = startCol; col <= endCol; col++) {
					const xLeft = col * stepX + colOff + offsetX_px;

					// Centres des trois arcs
					const c1x = xLeft + rX,  c1y = yTop;       // arc haut convexe
					const c2x = xLeft + w,   c2y = yTop + h;   // arc bas-droit concave
					const c3x = xLeft,        c3y = yTop + h;   // arc bas-gauche concave

					let poly = [];

					// Arc 1 : A→B  (180°→0°, centre C1)
					// y = c1y - sin(a)*rY  → sin(π)=0 donne A=(xLeft,yTop), sin(0)=0 donne B=(xLeft+w,yTop)
					// Au passage, sin(π/2)=1 → point le plus haut = yTop - h
					for (let i = 0; i <= N; i++) {
						const a = Math.PI - (i / N) * Math.PI;
						poly.push({
							x: c1x + Math.cos(a) * rX,
							y: c1y - Math.sin(a) * rY   // négatif = monte au-dessus de yTop ✓
						});
					}
					// Dernier point : a=0 → (c1x+rX, c1y) = (xLeft+w, yTop) = B ✓

					// Arc 2 : B→P  (90°→180°, centre C2)
					// a=90° → (c2x+0, c2y-rY) = (xLeft+w, yTop) = B ✓
					// a=180° → (c2x-rX, c2y+0) = (xLeft+w/2, yTop+h) = P ✓
					for (let i = 0; i <= N; i++) {
						const a = (Math.PI / 2) + (i / N) * (Math.PI / 2);
						poly.push({
							x: c2x + Math.cos(a) * rX,
							y: c2y - Math.sin(a) * rY
						});
					}
					// Dernier point : a=180° → (c2x-rX, c2y) = (xLeft+w/2, yTop+h) = P ✓

					// Arc 3 : P→A  (0°→−90°, centre C3)
					// a=0° → (c3x+rX, c3y) = (xLeft+w/2, yTop+h) = P ✓
					// a=−90° → (c3x+0, c3y+rY) = (xLeft, yTop+h+h) ... ✗
					// Correction : centre C3=(xLeft, yTop+h), a de 0→90° avec y=c3y-sin*rY
					// a=0° → (xLeft+rX, yTop+h) = P ✓
					// a=90° → (xLeft, yTop+h-rY) = (xLeft, yTop) = A ✓
					for (let i = 0; i <= N; i++) {
						const a = (i / N) * (Math.PI / 2);
						poly.push({
							x: c3x + Math.cos(a) * rX,
							y: c3y - Math.sin(a) * rY
						});
					}
					// Dernier point : a=90° → (xLeft, yTop+h-h) = (xLeft, yTop) = A ✓

					localTiles.push({ type: 'main', poly });
				}
			}
		}

        let fullTilesCount = 0;
        let cutTilesCount = 0;
        let cabochonCount = 0;

        ctx.lineWidth = 1;

        for (let tile of localTiles) {
            // Restore coordinates to global
            const globalPoly = tile.poly.map(p => {
                let rot = rotatePoint(p, angleRad);
                return { x: rot.x + anchor.x, y: rot.y + anchor.y };
            });

            const status = testTileIntersection(globalPoly, points);

            if (status) {
                ctx.beginPath();
                ctx.moveTo(globalPoly[0].x, globalPoly[0].y);
                for (let i = 1; i < globalPoly.length; i++) ctx.lineTo(globalPoly[i].x, globalPoly[i].y);
                ctx.closePath();

                if (tile.type === 'main') {
                    if (status === 'FULL') {
                        fullTilesCount++;
                        ctx.fillStyle = "rgba(52, 152, 219, 0.2)";
                    } else {
                        cutTilesCount++;
                        ctx.fillStyle = "rgba(231, 76, 60, 0.3)";
                    }
                    ctx.strokeStyle = "rgba(41, 128, 185, 0.8)";
                } else if (tile.type === 'cab') {
                    cabochonCount++;
                    ctx.fillStyle = (status === 'FULL') ? "rgba(46, 204, 113, 0.6)" : "rgba(230, 126, 34, 0.6)";
                    ctx.strokeStyle = "rgba(39, 174, 96, 0.9)";
                }

                ctx.fill();
                ctx.stroke();
            }
        }

        ctx.restore();

        // Compute Stats
        const areaPx = polygonArea(points);
        const areaM2 = areaPx / (pxlScale * pxlScale) / 10000;

        statArea.innerText = areaM2.toFixed(2) + " m²";
        statAreaMarge.innerText = (areaM2 * 1.1).toFixed(2) + " m²";
        statFullTiles.innerText = fullTilesCount;
        statCutTiles.innerText = cutTilesCount;

        let totalText = (fullTilesCount + cutTilesCount).toString() + (shape !== 'rect' ? " (" + shape + ")" : "");
        if (cabochonCount > 0) {
            totalText += " + " + cabochonCount + " cabochons";
        }
        statTotalTiles.innerText = totalText;
    } else {
        statArea.innerText = "0.00 m²";
        statAreaMarge.innerText = "0.00 m²";
        statFullTiles.innerText = "0";
        statCutTiles.innerText = "0";
        statTotalTiles.innerText = "0";
    }
	ctx.restore();
}
// Calcule la distance entre un point P et un segment [A, B]
function getDistToSegment(p, a, b) {
    let l2 = Math.hypot(a.x - b.x, a.y - b.y)**2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

// Init
resizeCanvas();
