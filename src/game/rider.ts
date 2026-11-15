import * as THREE from 'three';

export interface RiderPoseParams {
  carveLean: number;     // -1 (left) to +1 (right)
  crouch: number;        // 0 (upright athletic) to 1 (deep tuck/charge)
  isAirborne: boolean;
  isBraking: boolean;
  isGrabbing: boolean;
  spinVel: number;
  time: number;
}

export interface RiderRig {
  root: THREE.Group;       // Grounded at bottom-center of board
  spinGroup: THREE.Group;  // Rotates in air for spins/flips
  updatePose: (params: RiderPoseParams, dt: number) => void;
  dispose: () => void;
}

function createBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Carbon-slate metallic weave base
  ctx.fillStyle = '#151921';
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < 512; y += 8) {
    ctx.fillRect(0, y, 256, 3);
  }

  // Diagonal racing stunt stripes (amber & crimson)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, 110);
  ctx.lineTo(256, 210);
  ctx.lineTo(256, 265);
  ctx.lineTo(0, 165);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, 174);
  ctx.lineTo(256, 274);
  ctx.lineTo(256, 312);
  ctx.lineTo(0, 212);
  ctx.closePath();
  ctx.fill();

  // Tail & nose chevron accents
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(120, 0, 16, 512);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(24, 24, 208, 10);
  ctx.fillRect(24, 478, 208, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAdultRider(renderer: THREE.WebGLRenderer): RiderRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();
  const spinGroup = new THREE.Group();
  // Pivot spin around rider's center of mass (~0.95m above board) in air, or offset cleanly
  const boardPivot = new THREE.Group();
  root.add(spinGroup);
  spinGroup.add(boardPivot);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const boardTex = createBoardTexture(maxAniso);
  disposables.push(boardTex);

  // Materials with realistic roughness/metalness contrast
  const boardTopMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.28,
    metalness: 0.25,
  });
  const boardEdgeMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.22,
    metalness: 0.88,
  });
  const bindingMat = new THREE.MeshStandardMaterial({
    color: '#1e242d',
    roughness: 0.6,
    metalness: 0.2,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#252a34',
    roughness: 0.72,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: '#1f2937', // Charcoal snow pants
    roughness: 0.78,
    metalness: 0.04,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: '#b91c1c', // Stunt performer crimson shell
    roughness: 0.62,
    metalness: 0.06,
  });
  const jacketAccentMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b', // High-vis stunt shoulder/stripe trim
    roughness: 0.5,
    metalness: 0.1,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.7,
    metalness: 0.1,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc', // Crisp matte-satin white stunt helmet
    roughness: 0.26,
    metalness: 0.15,
  });
  const goggleVisorMat = new THREE.MeshPhysicalMaterial({
    color: '#f59e0b',
    roughness: 0.08,
    metalness: 0.82,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const skinGaiterMat = new THREE.MeshStandardMaterial({
    color: '#29303b',
    roughness: 0.85,
  });

  disposables.push(
    boardTopMat,
    boardEdgeMat,
    bindingMat,
    bootMat,
    pantsMat,
    jacketMat,
    jacketAccentMat,
    gloveMat,
    helmetMat,
    goggleVisorMat,
    skinGaiterMat
  );

  // 1. Snowboard (1.64m long along Z, 0.28m wide along X, beveled extruded profile)
  const boardShape = new THREE.Shape();
  const hw = 0.14;
  const hl = 0.62;
  boardShape.moveTo(-hw, -hl);
  boardShape.quadraticCurveTo(0, -hl - 0.24, hw, -hl); // Curved nose (-Z after rotateX)
  boardShape.lineTo(hw * 0.92, 0);
  boardShape.lineTo(hw, hl);
  boardShape.quadraticCurveTo(0, hl + 0.24, -hw, hl); // Curved tail
  boardShape.lineTo(-hw * 0.92, 0);
  boardShape.closePath();

  const boardGeo = new THREE.ExtrudeGeometry(boardShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  boardGeo.rotateX(Math.PI / 2);
  boardGeo.translate(0, 0.024, 0);
  disposables.push(boardGeo);

  const boardMesh = new THREE.Mesh(boardGeo, boardTopMat);
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  boardPivot.add(boardMesh);

  // Steel edge trim rail
  const edgeTrimGeo = new THREE.BoxGeometry(0.285, 0.014, 1.24);
  disposables.push(edgeTrimGeo);
  const edgeTrim = new THREE.Mesh(edgeTrimGeo, boardEdgeMat);
  edgeTrim.position.y = 0.015;
  boardPivot.add(edgeTrim);

  // 2. Bindings & Boots (Regular stance: left foot forward at z = -0.27, right foot back at z = +0.27)
  const bindingGeo = new THREE.BoxGeometry(0.24, 0.05, 0.14);
  const highbackGeo = new THREE.BoxGeometry(0.14, 0.16, 0.04);
  const bootGeo = new THREE.BoxGeometry(0.11, 0.16, 0.28);
  disposables.push(bindingGeo, highbackGeo, bootGeo);

  const frontFootAnchor = new THREE.Group();
  frontFootAnchor.position.set(0, 0.032, -0.27);
  frontFootAnchor.rotation.y = THREE.MathUtils.degToRad(-72); // Angled toward nose (-Z)

  const backFootAnchor = new THREE.Group();
  backFootAnchor.position.set(0, 0.032, 0.27);
  backFootAnchor.rotation.y = THREE.MathUtils.degToRad(-102);

  for (const anchor of [frontFootAnchor, backFootAnchor]) {
    const bindBase = new THREE.Mesh(bindingGeo, bindingMat);
    bindBase.rotation.y = Math.PI / 2;
    bindBase.position.y = 0.02;
    const highback = new THREE.Mesh(highbackGeo, bindingMat);
    highback.position.set(0, 0.1, 0.11);
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, 0.09, 0);
    boot.castShadow = true;
    anchor.add(bindBase, highback, boot);
    boardPivot.add(anchor);
  }

  // 3. Articulated Adult Human Rider (~1.82m realistic proportions)
  // Rider stands sideways (chest facing +X / toeside, back toward -X / heelside)
  const bodyCenter = new THREE.Group();
  bodyCenter.position.set(0, 0.88, 0); // Hip/pelvis height in athletic stance
  boardPivot.add(bodyCenter);

  // Pelvis
  const pelvisGeo = new THREE.CapsuleGeometry(0.135, 0.14, 6, 10);
  pelvisGeo.rotateX(Math.PI / 2);
  disposables.push(pelvisGeo);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
  pelvisMesh.castShadow = true;
  bodyCenter.add(pelvisMesh);

  // Legs (built downward from hip joints to approximate boot tops cleanly)
  const thighGeo = new THREE.CapsuleGeometry(0.078, 0.29, 6, 10);
  const shinGeo = new THREE.CapsuleGeometry(0.066, 0.28, 6, 10);
  disposables.push(thighGeo, shinGeo);

  const leftHip = new THREE.Group();
  leftHip.position.set(0.02, -0.04, -0.14);
  const leftThigh = new THREE.Mesh(thighGeo, pantsMat);
  leftThigh.position.y = -0.19;
  leftThigh.castShadow = true;
  const leftKnee = new THREE.Group();
  leftKnee.position.y = -0.38;
  const leftShin = new THREE.Mesh(shinGeo, pantsMat);
  leftShin.position.y = -0.18;
  leftShin.castShadow = true;
  leftKnee.add(leftShin);
  leftHip.add(leftThigh, leftKnee);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.02, -0.04, 0.14);
  const rightThigh = new THREE.Mesh(thighGeo, pantsMat);
  rightThigh.position.y = -0.19;
  rightThigh.castShadow = true;
  const rightKnee = new THREE.Group();
  rightKnee.position.y = -0.38;
  const rightShin = new THREE.Mesh(shinGeo, pantsMat);
  rightShin.position.y = -0.18;
  rightShin.castShadow = true;
  rightKnee.add(rightShin);
  rightHip.add(rightThigh, rightKnee);

  bodyCenter.add(leftHip, rightHip);

  // Torso (realistic adult ~0.52m tall chest + backpack)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.05, 0);
  bodyCenter.add(torsoPivot);

  const torsoGeo = new THREE.CapsuleGeometry(0.155, 0.34, 8, 12);
  torsoGeo.scale(0.88, 1, 1.18); // Realistic adult shoulder-to-depth breadth
  const stripeGeo = new THREE.BoxGeometry(0.28, 0.08, 0.37);
  const packGeo = new THREE.BoxGeometry(0.12, 0.3, 0.22);
  disposables.push(torsoGeo, stripeGeo, packGeo);

  const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
  torsoMesh.position.y = 0.26;
  torsoMesh.castShadow = true;

  const chestStripe = new THREE.Mesh(stripeGeo, jacketAccentMat);
  chestStripe.position.set(0.01, 0.33, 0);

  const harnessGeo = new THREE.BoxGeometry(0.29, 0.34, 0.055);
  disposables.push(harnessGeo);
  const harnessL = new THREE.Mesh(harnessGeo, bindingMat);
  harnessL.position.set(0.01, 0.28, -0.1);
  const harnessR = new THREE.Mesh(harnessGeo, bindingMat);
  harnessR.position.set(0.01, 0.28, 0.1);

  const stuntPack = new THREE.Mesh(packGeo, bindingMat);
  stuntPack.position.set(-0.15, 0.28, 0);
  stuntPack.castShadow = true;

  torsoPivot.add(torsoMesh, chestStripe, harnessL, harnessR, stuntPack);

  // Shoulders & Arms
  const upperArmGeo = new THREE.CapsuleGeometry(0.055, 0.22, 6, 8);
  const forearmGeo = new THREE.CapsuleGeometry(0.046, 0.21, 6, 8);
  const gloveGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const padGeo = new THREE.BoxGeometry(0.09, 0.08, 0.09);
  disposables.push(upperArmGeo, forearmGeo, gloveGeo, padGeo);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(0.02, 0.45, -0.22);
  const leftUpperArm = new THREE.Mesh(upperArmGeo, jacketMat);
  leftUpperArm.position.y = -0.14;
  leftUpperArm.castShadow = true;
  const leftElbow = new THREE.Group();
  leftElbow.position.y = -0.28;
  const leftPad = new THREE.Mesh(padGeo, bindingMat);
  const leftForearm = new THREE.Mesh(forearmGeo, jacketMat);
  leftForearm.position.y = -0.13;
  leftForearm.castShadow = true;
  const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
  leftGlove.position.y = -0.26;
  leftElbow.add(leftPad, leftForearm, leftGlove);
  leftShoulder.add(leftUpperArm, leftElbow);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.02, 0.45, 0.22);
  const rightUpperArm = new THREE.Mesh(upperArmGeo, jacketMat);
  rightUpperArm.position.y = -0.14;
  rightUpperArm.castShadow = true;
  const rightElbow = new THREE.Group();
  rightElbow.position.y = -0.28;
  const rightPad = new THREE.Mesh(padGeo, bindingMat);
  const rightForearm = new THREE.Mesh(forearmGeo, jacketMat);
  rightForearm.position.y = -0.13;
  rightForearm.castShadow = true;
  const rightGlove = new THREE.Mesh(gloveGeo, gloveMat);
  rightGlove.position.y = -0.26;
  rightElbow.add(rightPad, rightForearm, rightGlove);
  rightShoulder.add(rightUpperArm, rightElbow);

  torsoPivot.add(leftShoulder, rightShoulder);

  // Head & Helmet (realistic ~0.23m tall adult head, turned slightly to look downhill -Z)
  const headGroup = new THREE.Group();
  headGroup.position.set(0.02, 0.56, 0);
  headGroup.rotation.y = THREE.MathUtils.degToRad(58); // Head looks forward downhill (-Z)
  torsoPivot.add(headGroup);

  const neckGeo = new THREE.CylinderGeometry(0.056, 0.068, 0.1, 8);
  const helmetGeo = new THREE.SphereGeometry(0.118, 16, 14);
  helmetGeo.scale(0.95, 1.06, 1.08);
  const chinGeo = new THREE.CylinderGeometry(0.088, 0.076, 0.1, 10);
  const goggleGeo = new THREE.BoxGeometry(0.17, 0.065, 0.11);
  const strapGeo = new THREE.CylinderGeometry(0.118, 0.118, 0.036, 16, 1, true);
  const camMountGeo = new THREE.BoxGeometry(0.045, 0.042, 0.075);
  const camLedMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const camLedGeo = new THREE.SphereGeometry(0.011, 6, 6);
  disposables.push(
    neckGeo,
    helmetGeo,
    chinGeo,
    goggleGeo,
    strapGeo,
    camMountGeo,
    camLedMat,
    camLedGeo
  );

  const neckMesh = new THREE.Mesh(neckGeo, skinGaiterMat);
  neckMesh.position.y = 0.02;

  const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
  helmetMesh.position.y = 0.14;
  helmetMesh.castShadow = true;

  const gaiterMesh = new THREE.Mesh(chinGeo, skinGaiterMat);
  gaiterMesh.position.set(0.01, 0.08, 0);

  const goggles = new THREE.Mesh(goggleGeo, goggleVisorMat);
  goggles.position.set(0.0, 0.145, -0.075);

  const strap = new THREE.Mesh(strapGeo, bindingMat);
  strap.position.set(0, 0.145, 0.005);

  const actionCam = new THREE.Mesh(camMountGeo, bindingMat);
  actionCam.position.set(0, 0.275, -0.02);
  const tallyLed = new THREE.Mesh(camLedGeo, camLedMat);
  tallyLed.position.set(0.022, 0.285, -0.05);

  headGroup.add(neckMesh, gaiterMesh, helmetMesh, strap, goggles, actionCam, tallyLed);

  // Smooth internal animation states
  let smoothLean = 0;
  let smoothCrouch = 0.25;
  let smoothGrab = 0;

  const updatePose = (params: RiderPoseParams, dt: number) => {
    const k = 1 - Math.exp(-12 * dt);
    smoothLean = THREE.MathUtils.lerp(smoothLean, params.carveLean, k);
    smoothCrouch = THREE.MathUtils.lerp(smoothCrouch, params.crouch, k);
    smoothGrab = THREE.MathUtils.lerp(smoothGrab, params.isGrabbing ? 1 : 0, k);

    // Edge roll on the board itself
    boardPivot.rotation.z = -smoothLean * 0.42;
    boardPivot.rotation.y = params.isBraking ? 0.55 : smoothLean * 0.14;

    // Athletic knee bend & hip drop
    const kneeFlex = 0.28 + smoothCrouch * 0.65 + (params.isAirborne ? 0.35 : 0);
    bodyCenter.position.y = 0.88 - kneeFlex * 0.22;
    bodyCenter.position.x = smoothLean * 0.12;

    leftHip.rotation.z = -kneeFlex * 0.55;
    leftHip.rotation.x = 0.22;
    leftKnee.rotation.z = kneeFlex * 1.05;

    rightHip.rotation.z = -kneeFlex * 0.55;
    rightHip.rotation.x = -0.22;
    rightKnee.rotation.z = kneeFlex * 1.05;

    // Torso counter-balance & tuck
    torsoPivot.rotation.z = -smoothLean * 0.25 - smoothCrouch * 0.28 - smoothGrab * 0.42;
    torsoPivot.rotation.y = -smoothLean * 0.18 + (params.isBraking ? -0.35 : 0);

    // Arms balance naturally or reach for Indy grab in air
    const armWave = Math.sin(params.time * 5.2) * (params.isAirborne ? 0.08 : 0.03);
    const armOut = 0.55 + (params.isAirborne ? 0.45 : 0) - smoothCrouch * 0.42;

    // Left (lead) arm
    leftShoulder.rotation.x = -armOut - armWave - smoothGrab * 0.4;
    leftShoulder.rotation.z = 0.22 + smoothLean * 0.25 + smoothGrab * 0.7;
    leftElbow.rotation.x = 0.45 + smoothCrouch * 0.5;

    // Right (trail) arm reaches down to board edge on grab
    rightShoulder.rotation.x = armOut + armWave - smoothGrab * 0.85;
    rightShoulder.rotation.z = 0.2 - smoothLean * 0.25 + smoothGrab * 0.95;
    rightElbow.rotation.x = -0.45 - smoothCrouch * 0.5 - smoothGrab * 0.3;

    // Head stays level looking down the fall line
    headGroup.rotation.z = smoothLean * 0.22 + smoothCrouch * 0.18;
  };

  return {
    root,
    spinGroup,
    updatePose,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
