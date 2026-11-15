import * as THREE from 'three';

export const COURSE_LENGTH = 1220; // rider drops from z = 0 to z = -1220
export const TRACK_HALF_WIDTH = 28; // skiable canyon floor width half-extent

/**
 * Deterministic downhill mountain heightfield.
 * Rider travels primarily along -Z.
 */
export function getTerrainHeight(x: number, z: number): number {
  // Base steep mountain descent (~21 deg average, steeper mid-section chutes)
  const forwardDist = Math.max(0, -z);
  const progress = Math.min(1, forwardDist / COURSE_LENGTH);

  // Steep upper drop, screaming mid-mountain chute, sweeping lower apron
  const slopeDrop =
    z * 0.36 -
    Math.sin(progress * Math.PI) * 18 +
    (z > 0 ? z * 0.25 : 0);

  // Gentle winding S-bend mountain chute centerline
  const valleyCenter =
    Math.sin(z * 0.011) * 7.5 + Math.cos(z * 0.0055) * 4.5;

  // Natural rollers & undulations along the slope (no half-pipe walls)
  const rollers =
    Math.sin(z * 0.042) * 1.45 +
    Math.cos(z * 0.085 + x * 0.06) * 0.65 +
    Math.sin(x * 0.14 + z * 0.025) * 0.35;

  // Flatten slightly near the finish movie camp
  const finishFlatten =
    z < -COURSE_LENGTH + 45
      ? THREE.MathUtils.smoothstep(-z, COURSE_LENGTH - 45, COURSE_LENGTH + 20)
      : 0;

  return slopeDrop + rollers * (1 - finishFlatten * 0.8);
}

export function getValleyCenterX(z: number): number {
  return Math.sin(z * 0.011) * 7.5 + Math.cos(z * 0.0055) * 4.5;
}

export function getTerrainNormal(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const eps = 0.6;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  out.set(hL - hR, 2 * eps, hD - hU).normalize();
  return out;
}

export function createSnowTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  // Albedo texture with crisp wind-swept sastrugi, groomed corduroy & subtle blue-shadow ripples
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 512;
  colorCanvas.height = 512;
  const ctx = colorCanvas.getContext('2d')!;
  ctx.fillStyle = '#f3f8fe';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle groomed vertical ski-piste corduroy lines for fast speed perception
  for (let x = 0; x < 512; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? 'rgba(210, 228, 247, 0.22)' : 'rgba(255, 255, 255, 0.26)';
    ctx.fillRect(x, 0, 3, 512);
  }

  // Sculpted wind drifts
  for (let i = 0; i < 480; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 16 + Math.random() * 68;
    const h = 3 + Math.random() * 7;
    ctx.fillStyle =
      Math.random() > 0.48 ? 'rgba(202, 222, 245, 0.36)' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(x, y, w, h);
  }

  // Fine crystalline sparkle specks
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle =
      Math.random() > 0.3 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(186, 214, 244, 0.52)';
    ctx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 120);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  // Roughness & bump maps for glistening packed-powder specular shimmer
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#8f8f8f';
  rCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 6) {
    rCtx.fillStyle = x % 12 === 0 ? '#787878' : '#b2b2b2';
    rCtx.fillRect(x, 0, 2, 256);
  }
  for (let i = 0; i < 2400; i++) {
    const shade = 100 + Math.floor(Math.random() * 125);
    rCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    rCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(16, 120);
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(roughCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 120);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap };
}

function createSkyDomeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Vertical atmospheric gradient: crisp zenith alpine blue -> glacier sky -> warm golden horizon
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1e4273');
  grad.addColorStop(0.24, '#3d72a8');
  grad.addColorStop(0.45, '#7fb0da');
  grad.addColorStop(0.56, '#c4dff3');
  grad.addColorStop(0.64, '#f6dec2');
  grad.addColorStop(0.75, '#c9ddf0');
  grad.addColorStop(1.0, '#8ba6c1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft warm golden sun halo positioned down-mountain ahead-right
  const sunGlow = ctx.createRadialGradient(710, 290, 6, 710, 290, 200);
  sunGlow.addColorStop(0.0, 'rgba(255, 252, 232, 0.95)');
  sunGlow.addColorStop(0.14, 'rgba(255, 236, 186, 0.58)');
  sunGlow.addColorStop(0.45, 'rgba(253, 210, 155, 0.22)');
  sunGlow.addColorStop(1.0, 'rgba(253, 210, 155, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(460, 80, 480, 400);

  // Wispy high-altitude alpine cloud bands
  for (let i = 0; i < 48; i++) {
    const cx = Math.random() * 1024;
    const cy = 140 + Math.random() * 135;
    const rx = 50 + Math.random() * 130;
    const ry = 4 + Math.random() * 12;
    const cGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
    cGrad.addColorStop(0, 'rgba(255, 250, 244, 0.28)');
    cGrad.addColorStop(1, 'rgba(255, 250, 244, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface MountainEnvironment {
  group: THREE.Group;
  skyDome: THREE.Mesh;
  dispose: () => void;
}

export function buildMountainEnvironment(
  renderer: THREE.WebGLRenderer
): MountainEnvironment {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const { map: snowMap, roughnessMap: snowRoughMap, bumpMap: snowBumpMap } = createSnowTextures(maxAniso);
  const skyTex = createSkyDomeTexture(maxAniso);
  disposables.push(snowMap, snowRoughMap, snowBumpMap, skyTex);

  // 0. Atmospheric Alpine Sky Dome
  const skyGeo = new THREE.SphereGeometry(1150, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.renderOrder = -10;
  group.add(skyDome);
  disposables.push(skyGeo, skyMat);

  // 1. Playable mountain piste mesh (92m wide x 1420m long, open mountain face without half-pipe walls)
  const width = 92;
  const length = 1420;
  const segX = 48;
  const segZ = 260;
  const terrainGeo = new THREE.PlaneGeometry(width, length, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -length / 2 + 80);

  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colorSnow = new THREE.Color('#ffffff');
  const colorTrack = new THREE.Color('#ebf3fc');
  const colorIce = new THREE.Color('#c5daef');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Keep mesh centered around the winding valley centerline so playable slope stays smooth
    const center = getValleyCenterX(z);
    const worldX = x + center;
    pos.setX(i, worldX);
    pos.setY(i, getTerrainHeight(worldX, z));

    const edgeMix = THREE.MathUtils.clamp((Math.abs(x) - 19) / 20, 0, 1);
    const rollerShade = THREE.MathUtils.clamp(0.5 + Math.sin(z * 0.042) * 0.5, 0, 1);
    tmpColor.copy(colorTrack).lerp(colorSnow, rollerShade * 0.65).lerp(colorIce, edgeMix * 0.78);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: snowMap,
    roughnessMap: snowRoughMap,
    bumpMap: snowBumpMap,
    bumpScale: 0.09,
    vertexColors: true,
    roughness: 0.52,
    metalness: 0.03,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // 1b. Non-interactable towering side mountain ranges flanking left & right of the piste
  const sideMtnMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.04,
    flatShading: true,
  });
  disposables.push(sideMtnMat);

  const rockSlate = new THREE.Color('#4b586b');
  const graniteDark = new THREE.Color('#354050');
  const snowPeak = new THREE.Color('#eef5fd');

  for (const side of [-1, 1]) {
    const mtnWidth = 220;
    const mtnSegX = 22;
    const mtnSegZ = 140;
    const mtnGeo = new THREE.PlaneGeometry(mtnWidth, length + 80, mtnSegX, mtnSegZ);
    mtnGeo.rotateX(-Math.PI / 2);
    mtnGeo.translate(0, 0, -length / 2 + 80);

    const mPos = mtnGeo.attributes.position;
    const mColors = new Float32Array(mPos.count * 3);

    for (let i = 0; i < mPos.count; i++) {
      const localX = mPos.getX(i); // -110 .. +110
      const z = mPos.getZ(i);
      const center = getValleyCenterX(z);
      // t = 0 right next to piste edge (33m out), t = 1 far mountain ridge (253m out)
      const t = (side > 0 ? localX + mtnWidth / 2 : mtnWidth / 2 - localX) / mtnWidth;
      const worldX = center + side * (32 + t * mtnWidth);
      const baseSlopeY = getTerrainHeight(center + side * 30, z);

      // Dramatic multi-ridge alpine peaks rising on both sides
      const ridgeWave =
        Math.abs(Math.sin(z * 0.014 + side * 1.4)) * 75 +
        Math.abs(Math.cos(z * 0.032 - t * 4.2)) * 42 +
        Math.sin(z * 0.075 + worldX * 0.04) * 14;
      const rise = Math.pow(t, 1.15) * (55 + ridgeWave) - (t < 0.06 ? 2.5 : 0);
      const y = baseSlopeY + rise;

      mPos.setXYZ(i, worldX, y, z);

      // Snow on high ridges & lower foothills, exposed granite rock on steep mid-faces
      if (rise > 95) {
        tmpColor.copy(rockSlate).lerp(snowPeak, THREE.MathUtils.clamp((rise - 95) / 45, 0.25, 0.95));
      } else if (rise < 14) {
        tmpColor.copy(snowPeak).lerp(rockSlate, THREE.MathUtils.clamp(rise / 14, 0, 0.65));
      } else {
        const crag = 0.5 + 0.5 * Math.sin(z * 0.06 + t * 9);
        tmpColor.copy(graniteDark).lerp(rockSlate, crag);
      }
      mColors[i * 3] = tmpColor.r;
      mColors[i * 3 + 1] = tmpColor.g;
      mColors[i * 3 + 2] = tmpColor.b;
    }

    mtnGeo.setAttribute('color', new THREE.BufferAttribute(mColors, 3));
    mtnGeo.computeVertexNormals();
    const mtnMesh = new THREE.Mesh(mtnGeo, sideMtnMat);
    mtnMesh.receiveShadow = true;
    group.add(mtnMesh);
    disposables.push(mtnGeo);
  }

  // 2. Instanced Alpine Pine Trees (3-part composite silhouette merged or 3 InstancedMeshes)
  const treeCount = 460;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.6, 7);
  trunkGeo.translate(0, 1.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#4a3525',
    roughness: 0.9,
    metalness: 0.0,
  });

  const lowerFoliageGeo = new THREE.ConeGeometry(2.3, 4.6, 8);
  lowerFoliageGeo.translate(0, 4.1, 0);
  const upperFoliageGeo = new THREE.ConeGeometry(1.65, 3.8, 8);
  upperFoliageGeo.translate(0, 6.6, 0);
  const snowCapGeo = new THREE.ConeGeometry(1.15, 2.2, 8);
  snowCapGeo.translate(0, 7.6, 0);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: '#234a36',
    roughness: 0.82,
    metalness: 0.0,
  });
  const snowCapMat = new THREE.MeshStandardMaterial({
    color: '#eef5fc',
    roughness: 0.65,
    metalness: 0.02,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const lowers = new THREE.InstancedMesh(lowerFoliageGeo, foliageMat, treeCount);
  const uppers = new THREE.InstancedMesh(upperFoliageGeo, foliageMat, treeCount);
  const caps = new THREE.InstancedMesh(snowCapGeo, snowCapMat, treeCount);
  trunks.castShadow = true;
  lowers.castShadow = true;
  uppers.castShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < treeCount; i++) {
    const z = 40 - Math.random() * (COURSE_LENGTH + 140);
    const center = getValleyCenterX(z);
    const side = i % 2 === 0 ? -1 : 1;
    // Place trees cleanly along the piste shoulders before the flanking mountains
    const dist = 24.5 + Math.random() * 10.5;
    const x = center + side * dist;
    const y = getTerrainHeight(x, z) - 0.35;

    const scale = 0.8 + Math.random() * 0.75;
    dummy.position.set(x, y, z);
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.08,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.08
    );
    dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.25), scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    lowers.setMatrixAt(i, dummy.matrix);
    uppers.setMatrixAt(i, dummy.matrix);
    caps.setMatrixAt(i, dummy.matrix);

    tint.setHSL(0.41 + (Math.random() - 0.5) * 0.04, 0.38, 0.2 + Math.random() * 0.08);
    lowers.setColorAt(i, tint);
    uppers.setColorAt(i, tint);
  }
  trunks.computeBoundingSphere();
  lowers.computeBoundingSphere();
  uppers.computeBoundingSphere();
  caps.computeBoundingSphere();

  group.add(trunks, lowers, uppers, caps);
  disposables.push(
    trunkGeo,
    trunkMat,
    lowerFoliageGeo,
    upperFoliageGeo,
    snowCapGeo,
    foliageMat,
    snowCapMat
  );

  // 3. Instanced Craggy Granite Boulders along ridge shoulders
  const rockCount = 150;
  const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
  // Roughen vertices slightly for natural crag silhouette
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const jitter = 0.85 + Math.sin(vx * 3.1 + vy * 2.7 + vz * 4.3) * 0.22;
    rPos.setXYZ(i, vx * jitter, vy * jitter * 0.78, vz * jitter);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#5c6675',
    roughness: 0.88,
    metalness: 0.08,
    flatShading: true,
  });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const z = 10 - Math.random() * (COURSE_LENGTH + 80);
    const center = getValleyCenterX(z);
    const side = i % 2 === 0 ? -1 : 1;
    const x = center + side * (24 + Math.random() * 11);
    const y = getTerrainHeight(x, z) - 0.4;
    const s = 0.75 + Math.random() * 1.65;
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
    dummy.scale.set(s * 1.2, s * 0.85, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.6, 0.08, 0.34 + Math.random() * 0.14);
    rocks.setColorAt(i, tint);
  }
  rocks.computeBoundingSphere();
  group.add(rocks);
  disposables.push(rockGeo, rockMat);

  // 4. Distant Dramatic Snow-Capped Alpine Peaks (multi-ridge horizon silhouettes)
  const peakGeo = new THREE.ConeGeometry(92, 230, 7);
  // Vertex-color snow caps onto distant peaks
  const pPos = peakGeo.attributes.position;
  const pCols = new Float32Array(pPos.count * 3);
  const peakBaseCol = new THREE.Color('#4d5f75');
  const peakSnowCol = new THREE.Color('#eef5fd');
  for (let i = 0; i < pPos.count; i++) {
    const py = pPos.getY(i);
    const jitter = 0.88 + Math.sin(pPos.getX(i) * 0.09 + py * 0.06) * 0.14;
    pPos.setX(i, pPos.getX(i) * jitter);
    pPos.setZ(i, pPos.getZ(i) * jitter);
    const snowMix = THREE.MathUtils.smoothstep(py, -10, 65);
    tmpColor.copy(peakBaseCol).lerp(peakSnowCol, snowMix);
    pCols[i * 3] = tmpColor.r;
    pCols[i * 3 + 1] = tmpColor.g;
    pCols[i * 3 + 2] = tmpColor.b;
  }
  peakGeo.setAttribute('color', new THREE.BufferAttribute(pCols, 3));
  peakGeo.computeVertexNormals();

  const peakMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    flatShading: true,
  });
  const peakPositions: Array<[number, number, number, number]> = [
    [-260, -220, -450, 1.3],
    [280, -240, -520, 1.4],
    [-310, -420, -980, 1.7],
    [320, -440, -1050, 1.6],
    [-190, -510, -1490, 2.0],
    [210, -505, -1540, 1.9],
    [-40, -535, -1690, 2.5],
    [70, -525, -1620, 2.1],
  ];
  for (const [px, py, pz, s] of peakPositions) {
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.set(px, py, pz);
    peak.scale.set(s, s * 1.15, s);
    peak.rotation.y = px * 0.05;
    group.add(peak);
  }
  disposables.push(peakGeo, peakMat);

  // 5. Movie-Set Start Rig (z = -2) & Finish Film Camp (z = -COURSE_LENGTH)
  const metalDark = new THREE.MeshStandardMaterial({
    color: '#1f252e',
    roughness: 0.42,
    metalness: 0.78,
  });
  const amberEmissive = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 2.0,
    roughness: 0.22,
  });
  const bannerRed = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.55,
    metalness: 0.1,
  });
  const safetyOrange = new THREE.MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.55,
    metalness: 0.08,
  });
  disposables.push(metalDark, amberEmissive, bannerRed, safetyOrange);

  // Start Truss Gate
  const startGroup = createProductionArch(metalDark, amberEmissive, bannerRed, disposables);
  const startX = getValleyCenterX(-2);
  startGroup.position.set(startX, getTerrainHeight(startX, -2), -2);
  group.add(startGroup);

  // Finish Production Arch + Camera Jib Crane
  const finishZ = -COURSE_LENGTH;
  const finishX = getValleyCenterX(finishZ);
  const finishY = getTerrainHeight(finishX, finishZ);
  const finishGroup = createProductionArch(metalDark, amberEmissive, bannerRed, disposables);
  finishGroup.position.set(finishX, finishY, finishZ);
  finishGroup.scale.setScalar(1.25);
  group.add(finishGroup);

  // Director's Camera Crane beside Finish Line
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), metalDark);
  craneBase.position.set(finishX + 9.5, finishY + 0.7, finishZ + 5);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 11), metalDark);
  craneArm.position.set(finishX + 6.5, finishY + 4.4, finishZ + 5);
  craneArm.rotation.z = 0.35;
  craneArm.rotation.y = 0.5;
  const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.5), metalDark);
  cameraBody.position.set(finishX + 2.5, finishY + 6.2, finishZ + 2.8);
  group.add(craneBase, craneArm, cameraBody);
  disposables.push(craneBase.geometry, craneArm.geometry, cameraBody.geometry);

  // Overhead Alpine Ski-Lift Pylons & High Cables spanning across the chute (high clearance >= 28m)
  const liftTowerGeo = new THREE.CylinderGeometry(0.32, 0.58, 28, 8);
  liftTowerGeo.translate(0, 14, 0);
  const liftCrossGeo = new THREE.BoxGeometry(11, 0.55, 0.65);
  const cableGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 6);
  cableGeo.rotateX(Math.PI / 2);
  disposables.push(liftTowerGeo, liftCrossGeo, cableGeo);

  const liftZs = [-180, -490, -820, -1120];
  const prevTops: THREE.Vector3[] = [];
  for (let i = 0; i < liftZs.length; i++) {
    const lz = liftZs[i];
    const side = i % 2 === 0 ? -1 : 1;
    const lx = getValleyCenterX(lz) + side * 26.5;
    const ly = getTerrainHeight(lx, lz) - 0.5;
    const pylon = new THREE.Mesh(liftTowerGeo, metalDark);
    pylon.position.set(lx, ly, lz);
    pylon.castShadow = true;
    const cross = new THREE.Mesh(liftCrossGeo, metalDark);
    cross.position.set(lx - side * 2.2, ly + 27.6, lz);
    group.add(pylon, cross);
    prevTops.push(new THREE.Vector3(lx - side * 4.5, ly + 27.6, lz));
  }
  for (let i = 0; i < prevTops.length - 1; i++) {
    const a = prevTops[i];
    const b = prevTops[i + 1];
    const dist = a.distanceTo(b);
    const cable = new THREE.Mesh(cableGeo, metalDark);
    cable.position.copy(a).lerp(b, 0.5);
    cable.scale.set(1, 1, dist);
    cable.lookAt(b);
    group.add(cable);
  }

  // Trail Boundary Pennant Poles + Course Safety Ribbon Rails (every 38m along edges)
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6);
  poleGeo.translate(0, 1.6, 0);
  const flagGeo = new THREE.BoxGeometry(0.95, 0.48, 0.05);
  flagGeo.translate(0.46, 2.85, 0);
  const bannerStripGeo = new THREE.BoxGeometry(0.14, 0.35, 36);
  const poleCount = 64;
  const poles = new THREE.InstancedMesh(poleGeo, metalDark, poleCount);
  const flags = new THREE.InstancedMesh(flagGeo, bannerRed, poleCount);
  const ribbons = new THREE.InstancedMesh(bannerStripGeo, safetyOrange, poleCount - 2);

  for (let i = 0; i < poleCount; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const z = -22 - row * 38;
    const x = getValleyCenterX(z) + side * (TRACK_HALF_WIDTH - 4.5);
    const y = getTerrainHeight(x, z) - 0.1;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, side > 0 ? Math.PI : 0, side * 0.08);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    flags.setMatrixAt(i, dummy.matrix);

    if (i < poleCount - 2) {
      const nextZ = z - 38;
      const nextX = getValleyCenterX(nextZ) + side * (TRACK_HALF_WIDTH - 4.5);
      const nextY = getTerrainHeight(nextX, nextZ) + 1.25;
      dummy.position.set((x + nextX) * 0.5, (y + 1.25 + nextY) * 0.5, (z + nextZ) * 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.lookAt(nextX, nextY, nextZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ribbons.setMatrixAt(i, dummy.matrix);
    }
  }
  poles.computeBoundingSphere();
  flags.computeBoundingSphere();
  ribbons.computeBoundingSphere();
  group.add(poles, flags, ribbons);
  disposables.push(poleGeo, flagGeo, bannerStripGeo);

  return {
    group,
    skyDome,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

function createProductionArch(
  metalMat: THREE.Material,
  lightMat: THREE.Material,
  bannerMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const arch = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.65, 8.2, 0.65);
  const beamGeo = new THREE.BoxGeometry(16, 0.85, 0.85);
  const bannerGeo = new THREE.BoxGeometry(13.5, 1.4, 0.25);
  const lampGeo = new THREE.BoxGeometry(0.8, 0.5, 0.5);
  disposables.push(postGeo, beamGeo, bannerGeo, lampGeo);

  const leftPost = new THREE.Mesh(postGeo, metalMat);
  leftPost.position.set(-7.5, 4.1, 0);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(postGeo, metalMat);
  rightPost.position.set(7.5, 4.1, 0);
  rightPost.castShadow = true;

  const topBeam = new THREE.Mesh(beamGeo, metalMat);
  topBeam.position.set(0, 8.2, 0);
  topBeam.castShadow = true;

  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 7.1, 0);

  arch.add(leftPost, rightPost, topBeam, banner);

  // Studio floodlights on top truss
  for (let i = -2; i <= 2; i++) {
    const lamp = new THREE.Mesh(lampGeo, lightMat);
    lamp.position.set(i * 2.8, 8.8, 0.2);
    arch.add(lamp);
  }

  return arch;
}
