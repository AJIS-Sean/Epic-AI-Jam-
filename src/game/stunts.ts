import * as THREE from 'three';
import { getTerrainHeight, getValleyCenterX } from './terrain';
import { StuntCardId } from './types';

export interface RampItem {
  id: number;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  isExplosive: boolean;
  isMega: boolean;
  isHoopRamp?: boolean;
  triggered: boolean;
  mesh: THREE.Group;
}

export interface HoopItem {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  cleared: boolean;
  mesh: THREE.Group;
  flameRing: THREE.Mesh;
}

export interface BarrelItem {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  hit: boolean;
  nearMissed: boolean;
  mesh: THREE.Group;
}

export interface HazardItem {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface MortarZone {
  x: number;
  y: number;
  z: number;
  triggered: boolean;
  marker: THREE.Mesh;
}

export interface ChopperRig {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Mesh;
  spotLight: THREE.PointLight;
  nextFlareZ: number;
  active: boolean;
}

export interface ParticlePool {
  snowMesh: THREE.InstancedMesh;
  fireMesh: THREE.InstancedMesh;
  emitSnow: (x: number, y: number, z: number, vx: number, vy: number, vz: number, scale?: number) => void;
  emitExplosion: (x: number, y: number, z: number, count: number, power: number) => void;
  emitShockwave: (x: number, y: number, z: number, scale?: number) => void;
  emitEmber: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void;
  emitFlare: (x: number, y: number, z: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export interface CourseProps {
  group: THREE.Group;
  ramps: RampItem[];
  hoops: HoopItem[];
  barrels: BarrelItem[];
  hazards: HazardItem[];
  mortars: MortarZone[];
  chopper: ChopperRig;
  particles: ParticlePool;
  updateAnimatedProps: (time: number, dt: number, riderPos: THREE.Vector3) => void;
  dispose: () => void;
}

interface ParticleData {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

export function createParticlePool(sceneGroup: THREE.Group): ParticlePool {
  const snowMax = 420;
  const fireMax = 380;

  const snowGeo = new THREE.DodecahedronGeometry(0.24, 0);
  const snowMat = new THREE.MeshStandardMaterial({
    color: '#f8fbff',
    roughness: 0.72,
    metalness: 0.0,
  });
  const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, snowMax);
  snowMesh.frustumCulled = false;

  const fireGeo = new THREE.DodecahedronGeometry(0.38, 0);
  const fireMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
  });
  const fireMesh = new THREE.InstancedMesh(fireGeo, fireMat, fireMax);
  fireMesh.frustumCulled = false;

  // Expanding shockwave ring pool (up to 6 concurrent blasts)
  const waveMax = 6;
  const waveGeo = new THREE.RingGeometry(0.8, 1.35, 28);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMat = new THREE.MeshBasicMaterial({
    color: '#fb923c',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const waves: Array<{ mesh: THREE.Mesh; life: number; maxLife: number; targetScale: number; active: boolean }> = [];
  for (let i = 0; i < waveMax; i++) {
    const m = new THREE.Mesh(waveGeo, waveMat.clone());
    m.visible = false;
    sceneGroup.add(m);
    waves.push({ mesh: m, life: 0, maxLife: 0.55, targetScale: 10, active: false });
  }
  let waveIdx = 0;

  const snowParticles: ParticleData[] = Array.from({ length: snowMax }, () => ({
    active: false,
    x: 0,
    y: -999,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    scale: 1,
  }));

  const fireParticles: ParticleData[] = Array.from({ length: fireMax }, () => ({
    active: false,
    x: 0,
    y: -999,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    scale: 1,
  }));

  let snowIdx = 0;
  let fireIdx = 0;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Initialize hidden matrices
  dummy.position.set(0, -9999, 0);
  dummy.scale.setScalar(0.001);
  dummy.updateMatrix();
  for (let i = 0; i < snowMax; i++) snowMesh.setMatrixAt(i, dummy.matrix);
  for (let i = 0; i < fireMax; i++) {
    fireMesh.setMatrixAt(i, dummy.matrix);
    fireMesh.setColorAt(i, color.set('#ff6b00'));
  }

  sceneGroup.add(snowMesh, fireMesh);

  const emitSnow = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    scale = 1
  ) => {
    const p = snowParticles[snowIdx];
    snowIdx = (snowIdx + 1) % snowMax;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = 0.45 + Math.random() * 0.35;
    p.scale = scale * (0.7 + Math.random() * 0.6);
  };

  const emitExplosion = (x: number, y: number, z: number, count: number, power: number) => {
    for (let i = 0; i < count; i++) {
      const p = fireParticles[fireIdx];
      const idx = fireIdx;
      fireIdx = (fireIdx + 1) % fireMax;
      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.48;
      const spd = (0.4 + Math.random() * 0.95) * power;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 1.3;
      p.y = y + 0.4 + Math.random() * 0.8;
      p.z = z + (Math.random() - 0.5) * 1.3;
      p.vx = Math.cos(angle) * Math.cos(elev) * spd;
      p.vy = Math.sin(elev) * spd * 1.4 + 4.5;
      p.vz = Math.sin(angle) * Math.cos(elev) * spd;
      p.life = 0;
      p.maxLife = 0.65 + Math.random() * 0.6;
      p.scale = 1.15 + Math.random() * 2.0;

      const t = Math.random();
      if (t < 0.3) color.set('#fef08a'); // bright yellow core
      else if (t < 0.68) color.set('#f97316'); // orange fireball
      else if (t < 0.88) color.set('#dc2626'); // deep crimson flame
      else color.set('#334155'); // dark pyro smoke plume
      fireMesh.setColorAt(idx, color);
    }
    if (fireMesh.instanceColor) fireMesh.instanceColor.needsUpdate = true;
  };

  const emitShockwave = (x: number, y: number, z: number, scale = 10) => {
    const w = waves[waveIdx];
    waveIdx = (waveIdx + 1) % waveMax;
    w.active = true;
    w.life = 0;
    w.maxLife = 0.48;
    w.targetScale = scale;
    w.mesh.position.set(x, y + 0.35, z);
    w.mesh.scale.setScalar(0.5);
    w.mesh.visible = true;
    (w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
  };

  const emitEmber = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number
  ) => {
    const p = fireParticles[fireIdx];
    const idx = fireIdx;
    fireIdx = (fireIdx + 1) % fireMax;
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 0.4;
    p.y = y + (Math.random() - 0.5) * 0.4;
    p.z = z + (Math.random() - 0.5) * 0.4;
    p.vx = vx + (Math.random() - 0.5) * 2.5;
    p.vy = vy + 1.2 + Math.random() * 2.5;
    p.vz = vz + (Math.random() - 0.5) * 2.5;
    p.life = 0;
    p.maxLife = 0.32 + Math.random() * 0.25;
    p.scale = 0.45 + Math.random() * 0.55;
    color.set(Math.random() > 0.45 ? '#fbbf24' : '#f97316');
    fireMesh.setColorAt(idx, color);
    if (fireMesh.instanceColor) fireMesh.instanceColor.needsUpdate = true;
  };

  const emitFlare = (x: number, y: number, z: number) => {
    for (let i = 0; i < 6; i++) {
      const p = fireParticles[fireIdx];
      const idx = fireIdx;
      fireIdx = (fireIdx + 1) % fireMax;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + 0.2;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = (Math.random() - 0.5) * 2.2;
      p.vy = 2.5 + Math.random() * 3.5;
      p.vz = (Math.random() - 0.5) * 2.2;
      p.life = 0;
      p.maxLife = 0.85 + Math.random() * 0.4;
      p.scale = 0.9 + Math.random() * 0.8;
      color.set(i % 2 === 0 ? '#ef4444' : '#fca5a5');
      fireMesh.setColorAt(idx, color);
    }
    if (fireMesh.instanceColor) fireMesh.instanceColor.needsUpdate = true;
  };

  const update = (dt: number) => {
    let snowDirty = false;
    for (let i = 0; i < snowMax; i++) {
      const p = snowParticles[i];
      if (!p.active) continue;
      snowDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        dummy.position.set(0, -9999, 0);
        dummy.scale.setScalar(0.001);
      } else {
        p.vy -= 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const s = p.scale * (1 - p.life / p.maxLife);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(Math.max(0.01, s));
      }
      dummy.updateMatrix();
      snowMesh.setMatrixAt(i, dummy.matrix);
    }
    if (snowDirty) snowMesh.instanceMatrix.needsUpdate = true;

    let fireDirty = false;
    for (let i = 0; i < fireMax; i++) {
      const p = fireParticles[i];
      if (!p.active) continue;
      fireDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        dummy.position.set(0, -9999, 0);
        dummy.scale.setScalar(0.001);
      } else {
        p.vy += 4.5 * dt; // Fire rises buoyantly
        p.vx *= 1 - 1.2 * dt;
        p.vz *= 1 - 1.2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = p.life / p.maxLife;
        const s = p.scale * Math.sin((1 - t) * Math.PI * 0.5) * 1.4;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.life * 3, p.life * 2, 0);
        dummy.scale.setScalar(Math.max(0.01, s));
      }
      dummy.updateMatrix();
      fireMesh.setMatrixAt(i, dummy.matrix);
    }
    if (fireDirty) fireMesh.instanceMatrix.needsUpdate = true;

    for (const w of waves) {
      if (!w.active) continue;
      w.life += dt;
      if (w.life >= w.maxLife) {
        w.active = false;
        w.mesh.visible = false;
      } else {
        const t = w.life / w.maxLife;
        const ease = 1 - Math.pow(1 - t, 3);
        w.mesh.scale.setScalar(0.5 + ease * w.targetScale);
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      }
    }
  };

  return {
    snowMesh,
    fireMesh,
    emitSnow,
    emitExplosion,
    emitShockwave,
    emitEmber,
    emitFlare,
    update,
    dispose: () => {
      snowGeo.dispose();
      snowMat.dispose();
      fireGeo.dispose();
      fireMat.dispose();
      waveGeo.dispose();
      waveMat.dispose();
      waves.forEach((w) => (w.mesh.material as THREE.Material).dispose());
    },
  };
}

export function buildCourseProps(activeStunts: StuntCardId[]): CourseProps {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const ramps: RampItem[] = [];
  const hoops: HoopItem[] = [];
  const barrels: BarrelItem[] = [];
  const hazards: HazardItem[] = [];
  const mortars: MortarZone[] = [];

  const hasExplodingRamps = activeStunts.includes('exploding_ramps');
  const hasFlamingHoops = activeStunts.includes('flaming_hoops');
  const hasBarrels = activeStunts.includes('fuel_barrels');
  const hasChopper = activeStunts.includes('chopper_chase');
  const hasMortars = activeStunts.includes('mortar_barrage');
  const hasMegaWreck = activeStunts.includes('mega_wreck_gap');

  // Shared materials
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.84 });
  const pyroStripeMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#7f1d1d',
    emissiveIntensity: 0.45,
    roughness: 0.42,
  });
  const cautionYellowMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.38,
    metalness: 0.2,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.35,
    metalness: 0.8,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#ff6a00',
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: '#fef08a',
  });
  const rockHazardMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.9,
    flatShading: true,
  });
  const barrelRedMat = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.4,
    metalness: 0.45,
  });
  disposables.push(
    woodMat,
    pyroStripeMat,
    cautionYellowMat,
    steelMat,
    flameMat,
    innerFlameMat,
    rockHazardMat,
    barrelRedMat
  );

  // Helper to build a wedge ramp with crisp chevron deck markings & entry beacons
  const buildRampMesh = (w: number, h: number, l: number, isExplosive: boolean) => {
    const rampGrp = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(l, 0);
    shape.lineTo(l, h);
    shape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: w,
      bevelEnabled: false,
    });
    // Orient so ramp rises along -Z (entry at +l/2, lip at -l/2)
    wedgeGeo.rotateY(Math.PI / 2);
    wedgeGeo.translate(-w / 2, 0, l / 2);
    disposables.push(wedgeGeo);

    const deckMat = isExplosive ? pyroStripeMat : woodMat;
    const wedge = new THREE.Mesh(wedgeGeo, deckMat);
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    rampGrp.add(wedge);

    // Top-surface directional launch stripes so players spot ramp alignment from far uphill
    const slopeLen = Math.hypot(l, h);
    const slopeAngle = Math.atan2(h, l);
    const deckTrackGeo = new THREE.BoxGeometry(w * 0.62, 0.06, slopeLen * 0.94);
    disposables.push(deckTrackGeo);
    const deckTrack = new THREE.Mesh(
      deckTrackGeo,
      isExplosive ? cautionYellowMat : steelMat
    );
    deckTrack.position.set(0, h * 0.5 + 0.03, 0);
    deckTrack.rotation.x = slopeAngle;
    rampGrp.add(deckTrack);

    // Center glowing speed line
    const centerLineGeo = new THREE.BoxGeometry(w * 0.16, 0.08, slopeLen * 0.9);
    disposables.push(centerLineGeo);
    const centerLine = new THREE.Mesh(
      centerLineGeo,
      isExplosive ? innerFlameMat : cautionYellowMat
    );
    centerLine.position.set(0, h * 0.5 + 0.05, 0);
    centerLine.rotation.x = slopeAngle;
    rampGrp.add(centerLine);

    // Side caution rails
    const railGeo = new THREE.BoxGeometry(0.24, 0.35, slopeLen * 0.96);
    disposables.push(railGeo);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, isExplosive ? cautionYellowMat : steelMat);
      rail.position.set(side * (w / 2 + 0.08), h * 0.48, 0);
      rail.rotation.x = slopeAngle;
      rampGrp.add(rail);
    }

    if (isExplosive) {
      // C4 pyro canisters & glowing amber entry beacons
      const canisterGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 8);
      const beaconGeo = new THREE.SphereGeometry(0.24, 8, 8);
      disposables.push(canisterGeo, beaconGeo);
      for (const offset of [-w * 0.3, 0, w * 0.3]) {
        const can = new THREE.Mesh(canisterGeo, cautionYellowMat);
        can.position.set(offset, h + 0.12, -l / 2 + 0.2);
        can.rotation.z = Math.PI / 2;
        rampGrp.add(can);
      }
      for (const side of [-1, 1]) {
        const beacon = new THREE.Mesh(beaconGeo, innerFlameMat);
        beacon.position.set(side * (w / 2 + 0.25), 0.55, l / 2 - 0.15);
        rampGrp.add(beacon);
      }
    }

    return rampGrp;
  };

  // 1. Place Ramps along the mountain (5 natural/stunt ramps, upgraded to Exploding if card active)
  const rampSpecs = [
    { z: -155, offsetX: -2.5, w: 5.5, h: 2.3, l: 7.5 },
    { z: -345, offsetX: 3.5, w: 6.0, h: 2.6, l: 8.2 },
    { z: -530, offsetX: -3.0, w: 6.2, h: 2.8, l: 8.5 },
    { z: -780, offsetX: 2.2, w: 6.2, h: 2.9, l: 8.5 },
    { z: -990, offsetX: -1.5, w: 6.5, h: 3.1, l: 9.0 },
  ];

  rampSpecs.forEach((spec, idx) => {
    const x = getValleyCenterX(spec.z) + spec.offsetX;
    const y = getTerrainHeight(x, spec.z) - 0.15;
    const mesh = buildRampMesh(spec.w, spec.h, spec.l, hasExplodingRamps);
    mesh.position.set(x, y, spec.z);
    group.add(mesh);

    ramps.push({
      id: idx,
      x,
      y,
      z: spec.z,
      width: spec.w,
      length: spec.l,
      height: spec.h,
      isExplosive: hasExplodingRamps,
      isMega: false,
      triggered: false,
      mesh,
    });
  });

  // 2. Mega Gondola Wreckage Gap (if card unlocked) at z = -645
  if (hasMegaWreck) {
    const gz = -645;
    const gx = getValleyCenterX(gz);
    const gy = getTerrainHeight(gx, gz) - 0.2;
    const megaW = 8.4;
    const megaH = 4.6;
    const megaL = 12.0;
    const megaMesh = buildRampMesh(megaW, megaH, megaL, true);
    megaMesh.position.set(gx, gy, gz);
    group.add(megaMesh);

    ramps.push({
      id: 99,
      x: gx,
      y: gy,
      z: gz,
      width: megaW,
      length: megaL,
      height: megaH,
      isExplosive: true,
      isMega: true,
      triggered: false,
      mesh: megaMesh,
    });

    // Wrecked Ski-Lift Gondola Cabin & Tower 22m downrange so player flies OVER it!
    const wreckZ = gz - 22;
    const wreckY = getTerrainHeight(gx, wreckZ);
    const wreckGrp = new THREE.Group();
    wreckGrp.position.set(gx, wreckY, wreckZ);

    const cabinGeo = new THREE.BoxGeometry(4.4, 3.2, 3.8);
    const roofGeo = new THREE.BoxGeometry(4.8, 0.4, 4.2);
    const towerGeo = new THREE.CylinderGeometry(0.4, 0.65, 9.5, 8);
    disposables.push(cabinGeo, roofGeo, towerGeo);

    const cabin = new THREE.Mesh(cabinGeo, barrelRedMat);
    cabin.position.set(0, 1.5, 0);
    cabin.rotation.set(0.12, 0.25, -0.18);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(roofGeo, cautionYellowMat);
    roof.position.set(0, 3.1, 0);
    roof.rotation.copy(cabin.rotation);

    const fallenTower = new THREE.Mesh(towerGeo, steelMat);
    fallenTower.position.set(5.2, 1.8, -1);
    fallenTower.rotation.z = 1.18;
    fallenTower.castShadow = true;

    wreckGrp.add(cabin, roof, fallenTower);
    group.add(wreckGrp);
  }

  // Helper to build a dedicated custom launch ramp fitted to a Ring of Fire
  const buildHoopRampMesh = (w: number, h: number, l: number) => {
    const rampGrp = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(l, 0);
    shape.quadraticCurveTo(l * 0.72, h * 0.25, l, h); // Slight curved kicker transition
    shape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: w,
      bevelEnabled: false,
    });
    wedgeGeo.rotateY(Math.PI / 2);
    wedgeGeo.translate(-w / 2, 0, l / 2);
    disposables.push(wedgeGeo);

    const deck = new THREE.Mesh(wedgeGeo, steelMat);
    deck.castShadow = true;
    deck.receiveShadow = true;
    rampGrp.add(deck);

    // Flame-orange approach strips & side guide rails matching the hoop diameter
    const stripGeo = new THREE.BoxGeometry(w * 0.78, 0.08, l * 0.92);
    const railGeo = new THREE.BoxGeometry(0.28, 0.42, l * 0.98);
    disposables.push(stripGeo, railGeo);

    const centerStrip = new THREE.Mesh(stripGeo, flameMat);
    centerStrip.position.set(0, h * 0.52, 0);
    centerStrip.rotation.x = Math.atan2(h, l);
    rampGrp.add(centerStrip);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, cautionYellowMat);
      rail.position.set(side * (w / 2 + 0.1), h * 0.52, 0);
      rail.rotation.x = Math.atan2(h, l);
      rampGrp.add(rail);
    }

    return rampGrp;
  };

  // 3. Flaming Stunt Hoops — each obstacle you jump through gets its own custom fitted ramp
  if (hasFlamingHoops) {
    const hoopRadius = 3.5;
    const hoopRingGeo = new THREE.TorusGeometry(hoopRadius, 0.24, 12, 32);
    const flameHaloGeo = new THREE.TorusGeometry(hoopRadius, 0.46, 8, 28);
    const innerHaloGeo = new THREE.TorusGeometry(hoopRadius - 0.18, 0.2, 8, 28);
    const pylonGeo = new THREE.CylinderGeometry(0.16, 0.22, 9.5, 6);
    const baseFootGeo = new THREE.BoxGeometry(0.95, 0.4, 0.95);
    disposables.push(hoopRingGeo, flameHaloGeo, innerHaloGeo, pylonGeo, baseFootGeo);

    const hoopSpecs = [
      { hz: -245, offsetX: 2.2 },
      { hz: -445, offsetX: -3.4 },
      { hz: -715, offsetX: 3.0 },
      { hz: -905, offsetX: -2.6 },
      { hz: -1100, offsetX: 1.8 },
    ];

    hoopSpecs.forEach(({ hz, offsetX }, idx) => {
      const hx = getValleyCenterX(hz) + offsetX;
      const groundY = getTerrainHeight(hx, hz);
      const hy = groundY + 5.5;

      // Custom Hoop Launch Ramp placed directly in front of the hoop (+Z is uphill approach)
      const rampW = hoopRadius * 1.75; // 6.125m wide, matched to hoop span
      const rampH = 2.75;
      const rampL = 8.4;
      const rampZ = hz + 15.5;
      const rampY = getTerrainHeight(hx, rampZ) - 0.15;
      const rampMesh = buildHoopRampMesh(rampW, rampH, rampL);
      rampMesh.position.set(hx, rampY, rampZ);
      group.add(rampMesh);

      ramps.push({
        id: 200 + idx,
        x: hx,
        y: rampY,
        z: rampZ,
        width: rampW,
        length: rampL,
        height: rampH,
        isExplosive: false,
        isMega: false,
        isHoopRamp: true,
        triggered: false,
        mesh: rampMesh,
      });

      const hoopGrp = new THREE.Group();
      hoopGrp.position.set(hx, hy, hz);

      const steelRing = new THREE.Mesh(hoopRingGeo, steelMat);
      const flameRing = new THREE.Mesh(flameHaloGeo, flameMat);
      const innerFlameRing = new THREE.Mesh(innerHaloGeo, innerFlameMat);
      flameRing.add(innerFlameRing);

      const leftPylon = new THREE.Mesh(pylonGeo, steelMat);
      leftPylon.position.set(-hoopRadius - 0.18, -4.2, 0);
      const rightPylon = new THREE.Mesh(pylonGeo, steelMat);
      rightPylon.position.set(hoopRadius + 0.18, -4.2, 0);

      const leftBase = new THREE.Mesh(baseFootGeo, cautionYellowMat);
      leftBase.position.set(-hoopRadius - 0.18, -5.4, 0);
      const rightBase = new THREE.Mesh(baseFootGeo, cautionYellowMat);
      rightBase.position.set(hoopRadius + 0.18, -5.4, 0);

      hoopGrp.add(steelRing, flameRing, leftPylon, rightPylon, leftBase, rightBase);
      group.add(hoopGrp);

      hoops.push({
        id: idx,
        x: hx,
        y: hy,
        z: hz,
        radius: hoopRadius + 0.35,
        cleared: false,
        mesh: hoopGrp,
        flameRing,
      });
    });
  }

  // Helper: ensure no rock or barrel spawns in front of a ramp (uphill approach) or in its landing corridor
  const isClearOfAllRamps = (x: number, z: number, extraLateral = 4.5): boolean => {
    for (const ramp of ramps) {
      const halfL = ramp.length * 0.5;
      const frontClearZ = ramp.z + halfL + 30; // 30m clean approach in front of ramp
      const backClearZ = ramp.z - halfL - (ramp.isMega ? 36 : 26); // clean landing zone behind ramp
      const clearX = ramp.width * 0.5 + extraLateral;
      if (z <= frontClearZ && z >= backClearZ && Math.abs(x - ramp.x) <= clearX) {
        return false;
      }
    }
    return true;
  };

  // 4. Natural Rock Obstacles along the run (guaranteed clear of all ramp approaches & landings)
  const rockGeo = new THREE.DodecahedronGeometry(1.45, 1);
  disposables.push(rockGeo);
  for (let i = 0; i < 18; i++) {
    const rz = -95 - i * 58;
    const center = getValleyCenterX(rz);
    let rx = center + ((i % 3) - 1) * 7.5 + (i % 2 === 0 ? 3.2 : -3.2);

    if (!isClearOfAllRamps(rx, rz, 5.2)) {
      // Try moving rock cleanly to the opposite flank away from the ramp lane
      const sideSign = rx >= center ? -1 : 1;
      const altX = center + sideSign * 14.5;
      if (!isClearOfAllRamps(altX, rz, 5.2)) {
        continue;
      }
      rx = altX;
    }

    const ry = getTerrainHeight(rx, rz);

    const rock = new THREE.Mesh(rockGeo, rockHazardMat);
    rock.position.set(rx, ry + 0.55, rz);
    rock.scale.set(1.15, 0.85, 1.05);
    rock.rotation.set(i * 0.7, i * 1.1, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    hazards.push({ x: rx, y: ry, z: rz, radius: 1.55 });
  }

  // 5. Volatile Fuel Barrels (if card unlocked, also kept clear of ramp approaches)
  if (hasBarrels) {
    const drumGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.45, 12);
    const bandGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.2, 12);
    disposables.push(drumGeo, bandGeo);

    for (let i = 0; i < 16; i++) {
      const bz = -115 - i * 64;
      const center = getValleyCenterX(bz);
      let bx = center + (i % 2 === 0 ? -4.2 : 4.2) + Math.sin(i * 2.1) * 2.5;

      if (!isClearOfAllRamps(bx, bz, 3.8)) {
        const sideSign = bx >= center ? -1 : 1;
        const altX = center + sideSign * 13.5;
        if (!isClearOfAllRamps(altX, bz, 3.8)) continue;
        bx = altX;
      }

      const by = getTerrainHeight(bx, bz);

      const barrelGrp = new THREE.Group();
      barrelGrp.position.set(bx, by, bz);

      const drum = new THREE.Mesh(drumGeo, barrelRedMat);
      drum.position.y = 0.72;
      drum.castShadow = true;
      const stripe = new THREE.Mesh(bandGeo, cautionYellowMat);
      stripe.position.y = 0.75;
      barrelGrp.add(drum, stripe);
      group.add(barrelGrp);

      barrels.push({
        id: i,
        x: bx,
        y: by,
        z: bz,
        radius: 0.9,
        hit: false,
        nearMissed: false,
        mesh: barrelGrp,
      });
    }
  }

  // 6. Avalanche Mortar Zones (if card unlocked)
  if (hasMortars) {
    const markerGeo = new THREE.RingGeometry(1.8, 2.4, 16);
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      side: THREE.DoubleSide,
    });
    disposables.push(markerGeo, markerMat);

    for (let i = 0; i < 8; i++) {
      const mz = -195 - i * 115;
      const mx = getValleyCenterX(mz) + (i % 2 === 0 ? -5.5 : 5.5);
      const my = getTerrainHeight(mx, mz) + 0.08;

      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(mx, my, mz);
      group.add(marker);

      mortars.push({
        x: mx,
        y: my,
        z: mz,
        triggered: false,
        marker,
      });
    }
  }

  // 7. Film-Crew Stunt Helicopter (composite 7-part model, visible if card unlocked)
  const heliGrp = new THREE.Group();
  const heliBodyMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.38,
    metalness: 0.6,
  });
  const heliGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    roughness: 0.1,
    metalness: 0.7,
    clearcoat: 1.0,
  });
  disposables.push(heliBodyMat, heliGlassMat);

  const hullGeo = new THREE.CapsuleGeometry(1.15, 2.6, 8, 12);
  hullGeo.rotateX(Math.PI / 2);
  const cockpitGeo = new THREE.SphereGeometry(1.05, 12, 10);
  const boomGeo = new THREE.CylinderGeometry(0.2, 0.35, 4.4, 8);
  boomGeo.rotateX(Math.PI / 2);
  const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.8, 6);
  skidGeo.rotateX(Math.PI / 2);
  const bladeGeo = new THREE.BoxGeometry(9.2, 0.06, 0.36);
  const tailBladeGeo = new THREE.BoxGeometry(0.08, 1.8, 0.2);
  const camPodGeo = new THREE.SphereGeometry(0.45, 10, 10);
  disposables.push(hullGeo, cockpitGeo, boomGeo, skidGeo, bladeGeo, tailBladeGeo, camPodGeo);

  const hull = new THREE.Mesh(hullGeo, heliBodyMat);
  const cockpit = new THREE.Mesh(cockpitGeo, heliGlassMat);
  cockpit.position.set(0, -0.05, 1.05);
  const boom = new THREE.Mesh(boomGeo, heliBodyMat);
  boom.position.set(0, 0.3, -3.2);
  const leftSkid = new THREE.Mesh(skidGeo, steelMat);
  leftSkid.position.set(-0.9, -1.25, 0.2);
  const rightSkid = new THREE.Mesh(skidGeo, steelMat);
  rightSkid.position.set(0.9, -1.25, 0.2);
  const camPod = new THREE.Mesh(camPodGeo, cautionYellowMat);
  camPod.position.set(0, -0.95, 1.4);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.35, 0);
  const b1 = new THREE.Mesh(bladeGeo, steelMat);
  const b2 = new THREE.Mesh(bladeGeo, steelMat);
  b2.rotation.y = Math.PI / 2;
  mainRotor.add(b1, b2);

  const tailRotor = new THREE.Mesh(tailBladeGeo, cautionYellowMat);
  tailRotor.position.set(0.28, 0.45, -5.2);

  const heliLight = new THREE.PointLight('#fbbf24', 0, 45, 1.5);
  heliLight.position.set(0, -1.4, 1.5);

  heliGrp.add(hull, cockpit, boom, leftSkid, rightSkid, camPod, mainRotor, tailRotor, heliLight);
  heliGrp.visible = hasChopper;
  group.add(heliGrp);

  const chopper: ChopperRig = {
    group: heliGrp,
    mainRotor,
    tailRotor,
    spotLight: heliLight,
    nextFlareZ: -110,
    active: hasChopper,
  };

  const particles = createParticlePool(group);

  const updateAnimatedProps = (time: number, dt: number, riderPos: THREE.Vector3) => {
    particles.update(dt);

    // Pulse flaming hoops & emit live rising embers when rider is nearby
    for (const h of hoops) {
      if (h.cleared) continue;
      const pulse = 1 + Math.sin(time * 14 + h.id) * 0.06;
      h.flameRing.scale.set(pulse, pulse, 1);

      if (Math.abs(riderPos.z - h.z) < 90 && Math.random() < Math.min(1, dt * 18)) {
        const angle = Math.random() * Math.PI * 2;
        const r = h.radius - 0.35;
        particles.emitEmber(
          h.x + Math.cos(angle) * r,
          h.y + Math.sin(angle) * r,
          h.z + (Math.random() - 0.5) * 0.4,
          Math.cos(angle) * 0.8,
          2.2 + Math.random() * 2.5,
          (Math.random() - 0.5) * 1.2
        );
      }
    }

    // Track stunt helicopter overhead
    if (chopper.active) {
      const targetZ = riderPos.z - 28;
      const targetX = getValleyCenterX(targetZ) + Math.sin(time * 0.9) * 11;
      const targetY = getTerrainHeight(targetX, targetZ) + 14.5 + Math.sin(time * 1.7) * 1.5;

      chopper.group.position.x = THREE.MathUtils.lerp(chopper.group.position.x, targetX, 1 - Math.exp(-3 * dt));
      chopper.group.position.y = THREE.MathUtils.lerp(chopper.group.position.y, targetY, 1 - Math.exp(-3 * dt));
      chopper.group.position.z = THREE.MathUtils.lerp(chopper.group.position.z, targetZ, 1 - Math.exp(-4 * dt));
      chopper.group.lookAt(riderPos.x, riderPos.y + 1.2, riderPos.z);

      chopper.mainRotor.rotation.y += 28 * dt;
      chopper.tailRotor.rotation.x += 34 * dt;
      chopper.spotLight.intensity = 18;

      // Drop red smoke flares ahead of the rider
      if (riderPos.z < chopper.nextFlareZ + 55 && chopper.nextFlareZ > -1150) {
        const fx = getValleyCenterX(chopper.nextFlareZ) + (Math.random() - 0.5) * 14;
        const fy = getTerrainHeight(fx, chopper.nextFlareZ);
        particles.emitFlare(fx, fy, chopper.nextFlareZ);
        chopper.nextFlareZ -= 85;
      }
    }
  };

  return {
    group,
    ramps,
    hoops,
    barrels,
    hazards,
    mortars,
    chopper,
    particles,
    updateAnimatedProps,
    dispose: () => {
      particles.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
