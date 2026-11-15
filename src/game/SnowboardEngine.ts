import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import { createAdultRider, RiderRig } from './rider';
import {
  buildCourseProps,
  CourseProps,
  RampItem,
} from './stunts';
import {
  buildMountainEnvironment,
  COURSE_LENGTH,
  getTerrainHeight,
  getTerrainNormal,
  getValleyCenterX,
  MountainEnvironment,
  TRACK_HALF_WIDTH,
} from './terrain';
import {
  DirectorVerdict,
  GamePhase,
  InputState,
  LandingSafetyState,
  MovementTuning,
  RunTelemetry,
  StuntCallout,
  StuntCardId,
} from './types';
import { buildDirectorVerdict } from './storyboards';

// Pre-allocated math helpers (Zero GC in render loop)
const _normal = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _alignQuat = new THREE.Quaternion();

export interface EngineCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onTelemetry: (telemetry: RunTelemetry) => void;
  onVerdict: (verdict: DirectorVerdict) => void;
  onContextLost: (lost: boolean) => void;
}

export class SnowboardEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private sound = new SoundEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private isSoftwareGl = false;

  private mountain!: MountainEnvironment;
  private rider!: RiderRig;
  private courseProps: CourseProps | null = null;
  private visualDisposables: Array<{ dispose: () => void }> = [];

  // 3D Diegetic Landing Safety Reticle, Contact Shadow & Snow Flurries
  private contactShadow!: THREE.Mesh;
  private landingMarkerGroup!: THREE.Group;
  private landingRingMat!: THREE.MeshBasicMaterial;
  private landingCrossMesh!: THREE.Mesh;
  private snowFlurryPoints!: THREE.Points;
  private flurryPositions!: Float32Array;

  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private simTime = 0;

  // Game loop state
  private phase: GamePhase = 'title';
  private takeNumber = 1;
  private activeStunts: StuntCardId[] = [];
  private tuning: MovementTuning = {
    carveGrip: 1.0,
    turnSpeed: 1.0,
    jumpPop: 1.0,
    gravityScale: 1.0,
    topSpeedScale: 1.0,
    moneyShotSlowMo: true,
  };
  private input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    grab: false,
  };

  // Rider physics state
  private pos = new THREE.Vector3(0, 0, 0);
  private vel = new THREE.Vector3(0, 0, 0);
  private heading = 0; // 0 = -Z downhill; + = left (-X), - = right (+X)
  private carveLean = 0;
  private crouch = 0.25;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHoldTimer = 0;
  private isJumpHolding = false;
  private prevJumpHeld = false;
  private activeRamp: RampItem | null = null;

  // Air tricks & scoring
  private airTime = 0;
  private maxAirTime = 0;
  private airSpin = 0;
  private airFlip = 0;
  private airGrabTime = 0;
  private airUsedRamp = false;
  private spectacleScore = 0;
  private comboCount = 0;
  private rampsHit = 0;
  private hoopsCleared = 0;
  private tricksLanded = 0;
  private nearMisses = 0;
  private moneyShotsCaptured = 0;
  private topSpeedKmh = 0;
  private cleanRun = true;
  private runElapsed = 0;

  // Countdown & slow-mo money shot state
  private countdownTimer = 0;
  private lastCountdownInt = 4;
  private timeScale = 1.0;
  private moneyShotTimer = 0;
  private moneyShotElapsed = 0;
  private moneyShotSide = 1;
  private trickMoneyShotUsed = false;
  private cameraShake = 0;
  private emberTrailTimer = 0;
  private snowEmitAccum = 0;
  private snowWakeAccum = 0;
  private lastTelemetryEmit = 0;
  private calloutCounter = 1;
  private activeCallout: StuntCallout | null = null;
  private calloutTimer = 0;

  // Smooth camera state
  private camPos = new THREE.Vector3(0, 8, 12);
  private camLook = new THREE.Vector3(0, 2, -6);

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initScene();
    this.resetCourse(1, [], 'title');
    this.startLoop();
  }

  private initScene(): void {
    // Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color('#c8dff2');
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2('#c8dff2', 0.0033);

    // Studio/alpine reflection environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      64,
      (this.container.clientWidth || window.innerWidth) /
        (this.container.clientHeight || window.innerHeight),
      0.2,
      1400
    );

    // Warm Golden-Hour Sun + Cool Alpine Sky Hemisphere Fill
    const hemi = new THREE.HemisphereLight('#dceeff', '#4e657d', 0.92);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight('#ffefd2', 2.35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 120;
    const d = 28;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Crisp cool rim light from behind-left to separate rider silhouette against snow
    const rimLight = new THREE.DirectionalLight('#93c5fd', 0.65);
    rimLight.position.set(-40, 30, -80);
    this.scene.add(rimLight);

    // Build mountain terrain & adult rider
    this.mountain = buildMountainEnvironment(this.renderer);
    this.scene.add(this.mountain.group);

    this.rider = createAdultRider(this.renderer);
    this.scene.add(this.rider.root);

    // Soft radial ground contact shadow beneath rider
    const shadowGeo = new THREE.CircleGeometry(0.95, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#1e334d',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.scene.add(this.contactShadow);
    this.visualDisposables.push(shadowGeo, shadowMat);

    // 3D Diegetic Ground Landing Safety Reticle (visible while airborne)
    this.landingMarkerGroup = new THREE.Group();
    const outerRingGeo = new THREE.RingGeometry(1.15, 1.48, 32);
    outerRingGeo.rotateX(-Math.PI / 2);
    this.landingRingMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, this.landingRingMat);

    const crossGeo = new THREE.BoxGeometry(0.18, 0.04, 2.3);
    this.landingCrossMesh = new THREE.Mesh(crossGeo, this.landingRingMat);
    this.landingCrossMesh.position.y = 0.02;

    this.landingMarkerGroup.add(outerRing, this.landingCrossMesh);
    this.landingMarkerGroup.visible = false;
    this.scene.add(this.landingMarkerGroup);
    this.visualDisposables.push(outerRingGeo, crossGeo, this.landingRingMat);

    // Lightweight atmospheric falling alpine snow flurries around the rider
    const flurryCount = 240;
    this.flurryPositions = new Float32Array(flurryCount * 3);
    for (let i = 0; i < flurryCount; i++) {
      this.flurryPositions[i * 3] = (Math.random() - 0.5) * 44;
      this.flurryPositions[i * 3 + 1] = Math.random() * 20;
      this.flurryPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const flurryGeo = new THREE.BufferGeometry();
    flurryGeo.setAttribute('position', new THREE.BufferAttribute(this.flurryPositions, 3));
    const flurryMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.16,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.snowFlurryPoints = new THREE.Points(flurryGeo, flurryMat);
    this.snowFlurryPoints.frustumCulled = false;
    this.scene.add(this.snowFlurryPoints);
    this.visualDisposables.push(flurryGeo, flurryMat);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onContextLost(false);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public unlockAudio(): void {
    this.sound.unlock();
  }

  public setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.sound.isMuted();
  }

  public setInput(partial: Partial<InputState>): void {
    Object.assign(this.input, partial);
  }

  public setTuning(next: MovementTuning): void {
    this.tuning = { ...next };
  }

  public getRequiredScore(take: number): number {
    if (take <= 1) return 1500;
    return 1400 + (take - 1) * 950;
  }

  public startTake(takeNumber: number, stunts: StuntCardId[]): void {
    this.sound.unlock();
    this.resetCourse(takeNumber, stunts, 'countdown');
  }

  public retryCurrentTake(): void {
    this.sound.unlock();
    this.resetCourse(this.takeNumber, this.activeStunts, 'countdown');
  }

  private resetCourse(
    takeNumber: number,
    stunts: StuntCardId[],
    nextPhase: GamePhase
  ): void {
    this.takeNumber = takeNumber;
    this.activeStunts = [...stunts];

    if (this.courseProps) {
      this.scene.remove(this.courseProps.group);
      this.courseProps.dispose();
    }
    this.courseProps = buildCourseProps(this.activeStunts);
    this.scene.add(this.courseProps.group);

    // Position rider at start gate
    const startZ = -1;
    const startX = getValleyCenterX(startZ);
    const startY = getTerrainHeight(startX, startZ);
    this.pos.set(startX, startY, startZ);
    this.vel.set(0, 0, -4);
    this.heading = 0;
    this.carveLean = 0;
    this.crouch = 0.2;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHoldTimer = 0;
    this.isJumpHolding = false;
    this.prevJumpHeld = false;
    this.activeRamp = null;

    this.airTime = 0;
    this.maxAirTime = 0;
    this.airSpin = 0;
    this.airFlip = 0;
    this.airGrabTime = 0;
    this.airUsedRamp = false;
    this.spectacleScore = 0;
    this.comboCount = 0;
    this.rampsHit = 0;
    this.hoopsCleared = 0;
    this.tricksLanded = 0;
    this.nearMisses = 0;
    this.moneyShotsCaptured = 0;
    this.topSpeedKmh = 0;
    this.cleanRun = true;
    this.runElapsed = 0;

    this.timeScale = 1.0;
    this.moneyShotTimer = 0;
    this.moneyShotElapsed = 0;
    this.trickMoneyShotUsed = false;
    this.cameraShake = 0;
    this.emberTrailTimer = 0;
    this.snowEmitAccum = 0;
    this.snowWakeAccum = 0;
    this.activeCallout = null;
    this.calloutTimer = 0;

    this.countdownTimer = 2.6;
    this.lastCountdownInt = 4;

    this.rider.root.position.copy(this.pos);
    this.rider.root.rotation.set(0, 0, 0);
    this.rider.spinGroup.rotation.set(0, 0, 0);

    // Position camera for scenic drop-in establishing shot
    this.camPos.set(startX + 6, startY + 4.5, startZ + 9);
    this.camLook.set(startX, startY + 1.4, startZ - 12);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.setPhase(nextPhase);
    this.emitTelemetryNow();
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.callbacks.onPhaseChange(phase);
  }

  private pushCallout(label: string, points: number, isMoneyShot = false): void {
    this.spectacleScore += points;
    this.activeCallout = {
      id: this.calloutCounter++,
      label,
      points,
      isMoneyShot,
    };
    this.calloutTimer = 1.9;
  }

  private addShake(amount: number): void {
    this.cameraShake = Math.min(1.5, Math.max(this.cameraShake, amount));
  }

  private triggerMoneyShot(duration: number): void {
    if (!this.tuning.moneyShotSlowMo) return;
    if (this.moneyShotTimer <= 0.1) {
      this.moneyShotsCaptured++;
      this.moneyShotSide = Math.random() > 0.5 ? 1 : -1;
      this.moneyShotElapsed = 0;
      this.sound.playMoneyShot();
    }
    this.moneyShotTimer = Math.max(this.moneyShotTimer, duration);
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this.step(rawDt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private step(rawDt: number): void {
    this.simTime += rawDt;

    if (this.calloutTimer > 0) {
      this.calloutTimer -= rawDt;
      if (this.calloutTimer <= 0) this.activeCallout = null;
    }

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - rawDt * 2.4);
    }

    // Keep sky dome centered on rider and animate falling snow crystals
    this.mountain.skyDome.position.copy(this.pos);
    this.updateSnowFlurries(rawDt);

    // Phase handling
    if (this.phase === 'title') {
      this.stepTitlePreview(rawDt);
      return;
    }

    if (this.phase === 'countdown') {
      this.stepCountdown(rawDt);
      return;
    }

    if (this.phase === 'riding') {
      this.stepRiding(rawDt);
      return;
    }

    if (this.phase === 'wipeout' || this.phase === 'verdict') {
      // Keep particles & chopper alive softly in background
      this.courseProps?.updateAnimatedProps(this.simTime, rawDt * 0.45, this.pos);
      this.sound.updateContinuous({
        active: false,
        speed: 0,
        grounded: false,
        carveAmount: 0,
        braking: false,
        timeScale: 1,
      });
      // Slow orbit around finish or wipeout
      const angle = this.simTime * 0.35;
      _camTargetPos.set(
        this.pos.x + Math.sin(angle) * 10,
        this.pos.y + 4.2,
        this.pos.z + Math.cos(angle) * 10
      );
      this.camPos.lerp(_camTargetPos, 1 - Math.exp(-3 * rawDt));
      _camLookAt.set(this.pos.x, this.pos.y + 1.1, this.pos.z);
      this.camLook.lerp(_camLookAt, 1 - Math.exp(-5 * rawDt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.updateSunFollow();
    }
  }

  private stepTitlePreview(dt: number): void {
    const t = this.simTime * 0.45;
    const x = this.pos.x + Math.sin(t) * 6.5;
    const z = this.pos.z + 5.5 + Math.cos(t) * 3.0;
    const y = this.pos.y + 3.2;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.pos.x, this.pos.y + 1.2, this.pos.z - 8);
    this.rider.updatePose(
      {
        carveLean: Math.sin(this.simTime * 1.1) * 0.12,
        crouch: 0.15,
        isAirborne: false,
        isBraking: false,
        isGrabbing: false,
        spinVel: 0,
        time: this.simTime,
      },
      dt
    );
    this.updateSunFollow();
  }

  private stepCountdown(dt: number): void {
    this.countdownTimer -= dt;
    const currentInt = Math.ceil(this.countdownTimer);
    if (currentInt < this.lastCountdownInt && currentInt >= 1 && currentInt <= 3) {
      this.lastCountdownInt = currentInt;
      this.sound.playClapper();
      this.emitTelemetryNow();
    }

    // Cinematic camera sweep from side-front to behind rider
    const progress = THREE.MathUtils.clamp(1 - this.countdownTimer / 2.6, 0, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const angle = (1 - ease) * 1.45;
    const dist = THREE.MathUtils.lerp(11, 7.2, ease);
    const height = THREE.MathUtils.lerp(4.2, 3.0, ease);

    _camTargetPos.set(
      this.pos.x + Math.sin(angle) * dist,
      this.pos.y + height,
      this.pos.z + Math.cos(angle) * dist
    );
    this.camPos.copy(_camTargetPos);
    _camLookAt.set(this.pos.x, this.pos.y + 1.3, this.pos.z - 6 * ease);
    this.camLook.copy(_camLookAt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.rider.updatePose(
      {
        carveLean: 0,
        crouch: 0.25 + ease * 0.25,
        isAirborne: false,
        isBraking: false,
        isGrabbing: false,
        spinVel: 0,
        time: this.simTime,
      },
      dt
    );
    this.updateSunFollow();

    if (this.countdownTimer <= 0) {
      this.sound.playClapper();
      this.vel.set(0, -2, -16);
      this.setPhase('riding');
      this.emitTelemetryNow();
    }
  }

  private stepRiding(rawDt: number): void {
    // Money Shot slow-mo management (automatically returns to 1.0x before landing!)
    const groundAtRider = this.sampleSurfaceHeight(this.pos.x, this.pos.z);
    const heightAboveGround = this.pos.y - groundAtRider;
    const approachingGround = !this.grounded && this.vel.y < -1 && heightAboveGround < 3.6;

    if (this.moneyShotTimer > 0 && !approachingGround && !this.grounded) {
      this.moneyShotTimer -= rawDt;
      this.moneyShotElapsed += rawDt;
      this.timeScale = THREE.MathUtils.damp(this.timeScale, 0.28, 12, rawDt);
    } else {
      if (approachingGround || this.grounded) {
        this.moneyShotTimer = 0;
      }
      this.timeScale = THREE.MathUtils.damp(this.timeScale, 1.0, 10, rawDt);
    }

    const dt = rawDt * this.timeScale;
    this.runElapsed += rawDt;

    // Rider ember spark trail after flaming hoops or pyro kickers
    if (this.emberTrailTimer > 0) {
      this.emberTrailTimer = Math.max(0, this.emberTrailTimer - rawDt);
      if (Math.random() < Math.min(1, rawDt * 42)) {
        this.courseProps?.particles.emitEmber(
          this.pos.x + (Math.random() - 0.5) * 0.6,
          this.pos.y + 0.5 + Math.random() * 0.9,
          this.pos.z + 0.4,
          -this.vel.x * 0.15,
          0.8 + Math.random() * 1.8,
          -this.vel.z * 0.15 + 2.5
        );
      }
    }

    // 1. Update jump buffering & coyote time
    if (this.grounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    const jumpJustPressed = this.input.jump && !this.prevJumpHeld;
    this.prevJumpHeld = this.input.jump;

    if (jumpJustPressed) {
      this.jumpBufferTimer = 0.14;
    }

    // Two clean jump variations:
    // 1) Tapped -> short hop
    // 2) Held -> increases height smoothly up to max hold duration (0.28s) or until released
    const wantsJump =
      (jumpJustPressed && this.coyoteTimer > 0) ||
      (this.jumpBufferTimer > 0 && this.grounded);

    if (wantsJump) {
      const shortHopPop = 7.4 * this.tuning.jumpPop;
      this.vel.y = Math.max(this.vel.y + shortHopPop * 0.65, shortHopPop);
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpHoldTimer = 0.28;
      this.isJumpHolding = this.input.jump;
      this.airUsedRamp = false;
      this.sound.playJump();
      this.emitSnowBurst(10, 4.5);
    }

    // Stop extending jump height immediately on release
    if (!this.input.jump) {
      this.isJumpHolding = false;
    }

    // 2. Steering / Carving / Braking / Tricks
    const steerInput = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    const isBraking = this.grounded && this.input.down;
    const isTucking = this.grounded && this.input.up && !isBraking;

    if (this.grounded) {
      // Crisp, responsive carving turn rate
      const turnRate = (2.15 * this.tuning.turnSpeed) * (isBraking ? 1.25 : 1.0);
      this.heading = THREE.MathUtils.clamp(
        this.heading + steerInput * turnRate * dt,
        -1.15,
        1.15
      );

      // Gentle return toward center fall-line when no steering input
      if (steerInput === 0) {
        this.heading = THREE.MathUtils.damp(this.heading, 0, 0.85, dt);
      }

      this.carveLean = THREE.MathUtils.damp(this.carveLean, steerInput, 11, dt);
      const targetCrouch = isTucking
        ? 0.85
        : isBraking
        ? 0.55
        : 0.22 + Math.abs(this.carveLean) * 0.2;
      this.crouch = THREE.MathUtils.damp(this.crouch, targetCrouch, 10, dt);

      // Forward direction along heading in XZ
      _forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
      _right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));

      // Terrain slope gravity projection
      getTerrainNormal(this.pos.x, this.pos.z, _normal);
      const grav = 28.5 * this.tuning.gravityScale;
      // Slope acceleration vector projected onto XZ
      const slopeAccelX = _normal.x * grav;
      const slopeAccelZ = _normal.z * grav;

      this.vel.x += slopeAccelX * dt;
      this.vel.z += slopeAccelZ * dt;

      // Extra downhill drive when tucking
      if (isTucking) {
        this.vel.x += _forward.x * 11.5 * dt;
        this.vel.z += _forward.z * 11.5 * dt;
      }

      // Edge carve traction: eliminate lateral drift perpendicular to board
      const forwardSpeed = this.vel.x * _forward.x + this.vel.z * _forward.z;
      const lateralSpeed = this.vel.x * _right.x + this.vel.z * _right.z;
      const gripRate = (isBraking ? 3.5 : 8.8) * this.tuning.carveGrip;
      const dampedLateral = lateralSpeed * Math.exp(-gripRate * dt);

      // Braking friction vs aerodynamic snow glide drag
      const maxSpeed = (isTucking ? 45 : 37) * this.tuning.topSpeedScale;
      let newForward = forwardSpeed;
      if (isBraking) {
        newForward = Math.max(4.5, forwardSpeed - 24 * dt);
      } else {
        const drag = isTucking ? 0.004 : 0.009;
        newForward -= newForward * Math.abs(newForward) * drag * dt;
        newForward = Math.min(maxSpeed, Math.max(7.5, newForward));
      }

      this.vel.x = _forward.x * newForward + _right.x * dampedLateral;
      this.vel.z = _forward.z * newForward + _right.z * dampedLateral;

      // Carving & high-speed snow spray particles
      const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
      const carveIntensity = Math.abs(this.carveLean);
      if (carveIntensity > 0.22 || isBraking) {
        this.snowEmitAccum += dt * (isBraking ? 75 : 46 * carveIntensity);
        while (this.snowEmitAccum >= 1) {
          this.snowEmitAccum -= 1;
          const sideSign = isBraking ? (Math.random() > 0.5 ? 1 : -1) : -Math.sign(this.carveLean);
          this.courseProps?.particles.emitSnow(
            this.pos.x + _right.x * sideSign * 0.25,
            this.pos.y + 0.1,
            this.pos.z + _right.z * sideSign * 0.25,
            _right.x * sideSign * (3.2 + Math.random() * 4.5),
            2.4 + Math.random() * 2.8,
            _right.z * sideSign * (3.2 + Math.random() * 4.5) + horizSpeed * 0.14,
            isBraking ? 1.55 : 1.05
          );
        }
      }

      // Continuous subtle powder wake at speed
      if (horizSpeed > 15) {
        this.snowWakeAccum += dt * (horizSpeed * 0.85);
        while (this.snowWakeAccum >= 1) {
          this.snowWakeAccum -= 1;
          this.courseProps?.particles.emitSnow(
            this.pos.x + (Math.random() - 0.5) * 0.45,
            this.pos.y + 0.08,
            this.pos.z + 0.7,
            (Math.random() - 0.5) * 2.2,
            1.1 + Math.random() * 1.4,
            2.5 + Math.random() * 2.0,
            0.72
          );
        }
      }
    } else {
      // Airborne physics & tricks!
      this.airTime += dt;
      this.maxAirTime = Math.max(this.maxAirTime, this.airTime);

      const grav = 24.5 * this.tuning.gravityScale;
      this.vel.y -= grav * dt;

      // Held jump extends height smoothly until max hold time (0.28s) or release
      if (this.isJumpHolding && this.input.jump && this.jumpHoldTimer > 0 && !this.airUsedRamp) {
        const boostStep = Math.min(dt, this.jumpHoldTimer);
        this.vel.y += 28.0 * this.tuning.jumpPop * boostStep;
        this.jumpHoldTimer -= dt;
        if (this.jumpHoldTimer <= 0) {
          this.isJumpHolding = false;
        }
      }

      // Mid-air subtle steering control & trick rotations
      this.airSpin += steerInput * 5.6 * dt;
      const flipInput = (this.input.up ? 1 : 0) - (this.input.down ? 1 : 0);
      this.airFlip += flipInput * 4.8 * dt;

      if (this.input.grab) {
        this.airGrabTime += dt;
      }

      // Trigger dramatic slow-mo action pan mid-air on big committed aerial spins or flips
      if (
        !this.trickMoneyShotUsed &&
        heightAboveGround > 3.6 &&
        this.vel.y > -5 &&
        (Math.abs(this.airSpin) >= 4.2 || Math.abs(this.airFlip) >= 3.8)
      ) {
        this.trickMoneyShotUsed = true;
        this.triggerMoneyShot(0.95);
      }

      this.crouch = THREE.MathUtils.damp(this.crouch, this.input.grab ? 0.88 : 0.65, 9, dt);
      this.carveLean = THREE.MathUtils.damp(this.carveLean, 0, 5, dt);
    }

    // 3. Integrate Position & Check Ramp/Ground Contact
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Keep rider inside playable mountain slope before flanking non-interactable mountains
    const center = getValleyCenterX(this.pos.z);
    const maxOffset = TRACK_HALF_WIDTH + 2;
    if (Math.abs(this.pos.x - center) > maxOffset) {
      const sign = Math.sign(this.pos.x - center);
      this.pos.x = center + sign * maxOffset;
      this.vel.x *= -0.35;
      this.heading *= 0.6;
    }

    // Check Ramps
    let onRampNow: RampItem | null = null;
    if (this.courseProps) {
      for (const ramp of this.courseProps.ramps) {
        const halfW = ramp.width * 0.54;
        const halfL = ramp.length * 0.5;
        const dx = Math.abs(this.pos.x - ramp.x);
        // Ramp spans from z = ramp.z + halfL (entry) to z = ramp.z - halfL (lip)
        if (dx <= halfW && this.pos.z <= ramp.z + halfL && this.pos.z >= ramp.z - halfL) {
          const rampProgress = (ramp.z + halfL - this.pos.z) / ramp.length; // 0..1
          const rampSurfaceY = ramp.y + rampProgress * ramp.height;
          if (this.pos.y <= rampSurfaceY + 0.65 && prevY >= rampSurfaceY - 1.4) {
            this.pos.y = rampSurfaceY;
            onRampNow = ramp;
            this.grounded = true;
            this.activeRamp = ramp;
          }
        }
      }

      // Just exited ramp lip -> LAUNCH!
      if (!onRampNow && this.activeRamp && this.pos.z < this.activeRamp.z - this.activeRamp.length * 0.45) {
        const ramp = this.activeRamp;
        this.activeRamp = null;
        if (!ramp.triggered) {
          ramp.triggered = true;
          this.rampsHit++;
          const horizSpd = Math.hypot(this.vel.x, this.vel.z);
          const launchBoost = ramp.isMega
            ? 18.5
            : ramp.isExplosive
            ? 14.5
            : ramp.isHoopRamp
            ? 13.5
            : 11.2;
          this.vel.y = Math.max(this.vel.y, launchBoost + horizSpd * 0.14);
          // Boost forward slightly off pyro kicker or hoop ramp
          if (ramp.isExplosive) {
            this.vel.z -= 4.5;
            const ex = ramp.x;
            const ey = ramp.y + ramp.height;
            const ez = ramp.z - ramp.length * 0.4;
            this.courseProps.particles.emitExplosion(
              ex,
              ey,
              ez,
              ramp.isMega ? 58 : 40,
              ramp.isMega ? 18 : 13
            );
            this.courseProps.particles.emitShockwave(ex, ey, ez, ramp.isMega ? 18 : 11);
            this.emitSnowBurstAt(ex, ey, ez, ramp.isMega ? 28 : 18, 9.5);
            this.emberTrailTimer = 1.65;
            this.sound.playExplosion();
            this.addShake(ramp.isMega ? 1.35 : 0.95);
            this.pushCallout(
              ramp.isMega ? 'MEGA WRECK LAUNCH!' : 'PYRO KICKER BLAST!',
              ramp.isMega ? 950 : 450,
              true
            );
            this.triggerMoneyShot(ramp.isMega ? 1.8 : 1.25);
          } else if (ramp.isHoopRamp) {
            this.vel.z -= 2.2;
            this.sound.playJump();
            this.emitSnowBurst(14, 5.5);
            this.addShake(0.42);
            this.pushCallout('HOOP LAUNCH!', 220);
            this.triggerMoneyShot(0.95);
          } else {
            this.sound.playJump();
            this.emitSnowBurst(12, 5.0);
            this.addShake(0.32);
            this.pushCallout('CLEAN KICKER AIR', 200);
          }
          this.grounded = false;
          this.isJumpHolding = false;
          this.jumpHoldTimer = 0;
          this.airUsedRamp = true;
        }
      }
    }

    // Check Terrain Height
    const terrainY = getTerrainHeight(this.pos.x, this.pos.z);
    if (!onRampNow) {
      if (this.pos.y <= terrainY) {
        const impactVel = -this.vel.y;
        this.pos.y = terrainY;
        this.vel.y = Math.min(0, -Math.hypot(this.vel.x, this.vel.z) * 0.25);

        if (!this.grounded) {
          this.handleLanding(impactVel);
        }
        this.grounded = true;
      } else if (this.grounded && this.pos.y - terrainY < 0.45 && this.vel.y <= 1.5) {
        // Stick smoothly to convex terrain rollers unless jumping/launching
        this.pos.y = terrainY;
      } else if (this.pos.y > terrainY + 0.55) {
        this.grounded = false;
      }
    }

    // 4. Check Stunt Interactions (Flaming Hoops, Barrels, Mortars, Rock Hazards)
    if (this.courseProps) {
      this.checkCourseInteractions();
    }

    // 5. Update Rider Mesh Transform & Articulated Pose
    this.rider.root.position.copy(this.pos);
    if (this.grounded) {
      getTerrainNormal(this.pos.x, this.pos.z, _normal);
      const slopePitch = Math.atan2(_normal.z, _normal.y);
      this.rider.root.rotation.set(
        onRampNow ? Math.atan2(onRampNow.height, onRampNow.length) * 0.7 : slopePitch * 0.65,
        this.heading,
        -_normal.x * 0.45
      );
      this.rider.spinGroup.rotation.set(0, 0, 0);
    } else {
      this.rider.root.rotation.set(0, this.heading, 0);
      this.rider.spinGroup.rotation.set(-this.airFlip, this.airSpin, 0);
    }

    this.rider.updatePose(
      {
        carveLean: this.carveLean,
        crouch: this.crouch,
        isAirborne: !this.grounded,
        isBraking,
        isGrabbing: !this.grounded && this.input.grab,
        spinVel: 0,
        time: this.simTime,
      },
      rawDt
    );

    // 6. Update Props, Particles, Audio, Camera
    this.courseProps?.updateAnimatedProps(this.simTime, dt, this.pos);

    const speedMs = Math.hypot(this.vel.x, this.vel.z);
    const speedKmh = Math.round(speedMs * 3.6);
    this.topSpeedKmh = Math.max(this.topSpeedKmh, speedKmh);

    this.sound.updateContinuous({
      active: true,
      speed: speedMs,
      grounded: this.grounded,
      carveAmount: Math.abs(this.carveLean),
      braking: isBraking,
      timeScale: this.timeScale,
    });

    this.updateRidingCamera(rawDt, speedMs);
    this.updateGroundIndicators(terrainY, Math.max(0, this.pos.y - terrainY));
    this.updateSunFollow();

    // 7. Check Finish Line
    if (this.pos.z <= -COURSE_LENGTH) {
      this.finishTake();
      return;
    }

    // Throttled HUD telemetry update (~20 Hz)
    if (this.simTime - this.lastTelemetryEmit >= 0.05) {
      this.lastTelemetryEmit = this.simTime;
      this.emitTelemetryNow();
    }
  }

  private evaluateLandingSafety(): {
    state: LandingSafetyState;
    offsetDeg: number;
  } {
    if (this.grounded) {
      return { state: 'grounded', offsetDeg: 0 };
    }
    const normAngle = (rad: number) => {
      let deg = THREE.MathUtils.radToDeg(rad) % 360;
      if (deg > 180) deg -= 360;
      if (deg < -180) deg += 360;
      return Math.abs(deg);
    };
    const spinErr = normAngle(this.airSpin);
    const flipErr = normAngle(this.airFlip);
    const worstErr = Math.max(spinErr, flipErr);

    if (worstErr > 84 && this.airTime > 0.2) {
      return { state: 'unsafe', offsetDeg: Math.round(worstErr) };
    }
    if (worstErr > 52) {
      return { state: 'sketchy', offsetDeg: Math.round(worstErr) };
    }
    return { state: 'safe', offsetDeg: Math.round(worstErr) };
  }

  private updateGroundIndicators(terrainY: number, heightAboveGround: number): void {
    getTerrainNormal(this.pos.x, this.pos.z, _normal);
    _alignQuat.setFromUnitVectors(_up, _normal);

    // Contact shadow grounded right on the snow beneath rider
    this.contactShadow.position.set(this.pos.x, terrainY + 0.05, this.pos.z);
    this.contactShadow.quaternion.copy(_alignQuat);
    const shadowScale = Math.max(0.45, 1.0 - heightAboveGround * 0.055);
    this.contactShadow.scale.set(shadowScale * 0.85, 1, shadowScale * 1.35);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity =
      Math.max(0.1, 0.34 - heightAboveGround * 0.025);

    // Airborne landing safety reticle projected onto snow surface
    if (!this.grounded && this.phase === 'riding' && this.airTime > 0.14) {
      this.landingMarkerGroup.visible = true;
      this.landingMarkerGroup.position.set(this.pos.x, terrainY + 0.11, this.pos.z);
      this.landingMarkerGroup.quaternion.copy(_alignQuat);

      const { state, offsetDeg } = this.evaluateLandingSafety();
      const baseScale = 0.85 + Math.min(0.65, heightAboveGround * 0.06);
      if (state === 'unsafe') {
        this.landingRingMat.color.set('#ef4444');
        const warnScale = baseScale * (1 + Math.sin(this.simTime * 18) * 0.12);
        this.landingMarkerGroup.scale.setScalar(warnScale);
      } else if (state === 'sketchy') {
        this.landingRingMat.color.set('#f59e0b');
        this.landingMarkerGroup.scale.setScalar(baseScale);
      } else {
        this.landingRingMat.color.set('#34d399');
        this.landingMarkerGroup.scale.setScalar(baseScale);
      }
      this.landingCrossMesh.rotation.y = THREE.MathUtils.degToRad(offsetDeg);
    } else {
      this.landingMarkerGroup.visible = false;
    }
  }

  private updateSnowFlurries(rawDt: number): void {
    this.snowFlurryPoints.position.set(this.pos.x, this.pos.y, this.pos.z - 8);
    const count = this.flurryPositions.length / 3;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      this.flurryPositions[idx + 1] -= (3.2 + (i % 5) * 0.4) * rawDt;
      this.flurryPositions[idx] += Math.sin(this.simTime * 1.4 + i) * 0.65 * rawDt;
      if (this.flurryPositions[idx + 1] < -4) {
        this.flurryPositions[idx + 1] = 16;
      }
    }
    this.snowFlurryPoints.geometry.attributes.position.needsUpdate = true;
  }

  private sampleSurfaceHeight(x: number, z: number): number {
    return getTerrainHeight(x, z);
  }

  private handleLanding(impactVel: number): void {
    // Evaluate spin & flip alignment readability
    const normAngle = (rad: number) => {
      let deg = THREE.MathUtils.radToDeg(rad) % 360;
      if (deg > 180) deg -= 360;
      if (deg < -180) deg += 360;
      return Math.abs(deg);
    };

    const spinErr = normAngle(this.airSpin);
    const flipErr = normAngle(this.airFlip);
    const worstErr = Math.max(spinErr, flipErr);

    const fullSpins = Math.round(Math.abs(THREE.MathUtils.radToDeg(this.airSpin)) / 360);
    const fullFlips = Math.round(Math.abs(THREE.MathUtils.radToDeg(this.airFlip)) / 360);
    const didGrab = this.airGrabTime > 0.25;

    if (worstErr > 84 && this.airTime > 0.45) {
      // Wipeout!
      this.cleanRun = false;
      this.comboCount = 0;
      this.emitSnowBurst(28, 8.5);
      this.sound.playLand(1.2);
      this.addShake(1.1);
      this.setPhase('wipeout');
      this.emitTelemetryNow();
      return;
    }

    const landStrength = Math.min(1, impactVel / 14);
    this.sound.playLand(landStrength);
    this.emitSnowBurst(Math.round(14 + landStrength * 14), 4.5 + landStrength * 3.5);
    this.addShake(Math.min(0.85, impactVel / 18 + (this.airTime > 0.8 ? 0.18 : 0)));

    if (fullSpins > 0 || fullFlips > 0 || didGrab || this.airTime > 0.85) {
      const parts: string[] = [];
      if (fullFlips >= 2) parts.push('DOUBLE FLIP');
      else if (fullFlips === 1) parts.push('BACKFLIP');
      if (fullSpins >= 2) parts.push(`${fullSpins * 360}°`);
      else if (fullSpins === 1) parts.push('360°');
      if (didGrab) parts.push('INDY GRAB');
      if (parts.length === 0) parts.push('BIG AIR');

      const sketchy = worstErr > 52;
      const basePts =
        fullSpins * 350 +
        fullFlips * 500 +
        (didGrab ? 220 : 0) +
        Math.round(this.airTime * 160);
      const pts = Math.round(basePts * (sketchy ? 0.55 : 1 + this.comboCount * 0.2));

      if (!sketchy) {
        this.comboCount++;
        this.tricksLanded++;
      } else {
        this.comboCount = 0;
        this.vel.x *= 0.8;
        this.vel.z *= 0.8;
      }

      this.pushCallout(
        sketchy ? `SKETCHY ${parts.join(' ')}` : `${parts.join(' ')}!`,
        pts
      );
    }

    this.airTime = 0;
    this.airSpin = 0;
    this.airFlip = 0;
    this.airGrabTime = 0;
    this.airUsedRamp = false;
    this.trickMoneyShotUsed = false;
  }

  private checkCourseInteractions(): void {
    if (!this.courseProps) return;

    // 1. Flaming Hoops
    for (const hoop of this.courseProps.hoops) {
      if (hoop.cleared) continue;
      if (Math.abs(this.pos.z - hoop.z) < 2.2) {
        const dx = this.pos.x - hoop.x;
        const dy = this.pos.y + 0.9 - hoop.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= hoop.radius) {
          hoop.cleared = true;
          this.hoopsCleared++;
          this.comboCount++;
          this.sound.playHoopWhoosh();
          this.courseProps.particles.emitExplosion(hoop.x, hoop.y, hoop.z, 34, 11);
          this.courseProps.particles.emitShockwave(hoop.x, hoop.y - 0.5, hoop.z, 9.5);
          this.emberTrailTimer = 1.6;
          this.addShake(0.78);
          this.pushCallout('RING OF FIRE CLEARED!', 750, true);
          this.triggerMoneyShot(1.2);
        }
      }
    }

    // 2. Volatile Fuel Barrels (Near Miss vs Explosion Hit)
    for (const barrel of this.courseProps.barrels) {
      if (barrel.hit) continue;
      const dist = Math.hypot(this.pos.x - barrel.x, this.pos.z - barrel.z);
      const dy = Math.abs(this.pos.y - barrel.y);
      if (dist < 1.35 && dy < 1.8) {
        barrel.hit = true;
        barrel.mesh.visible = false;
        this.cleanRun = false;
        this.comboCount = 0;
        this.vel.x *= 0.65;
        this.vel.z *= 0.65;
        this.vel.y = Math.max(this.vel.y, 7.5);
        this.grounded = false;
        this.addShake(1.15);
        this.sound.playExplosion();
        this.courseProps.particles.emitExplosion(barrel.x, barrel.y + 0.6, barrel.z, 44, 15);
        this.courseProps.particles.emitShockwave(barrel.x, barrel.y + 0.2, barrel.z, 12);
        this.emitSnowBurstAt(barrel.x, barrel.y + 0.2, barrel.z, 16, 8);
        this.emberTrailTimer = 1.1;
        this.pushCallout('BARREL DETONATION!', 250);
      } else if (!barrel.nearMissed && dist < 3.1 && this.pos.z < barrel.z) {
        barrel.nearMissed = true;
        this.nearMisses++;
        this.addShake(0.18);
        this.pushCallout('DRUM NEAR MISS!', 220);
      }
    }

    // 3. Avalanche Mortars
    for (const mortar of this.courseProps.mortars) {
      if (mortar.triggered) continue;
      if (this.pos.z < mortar.z + 24) {
        mortar.triggered = true;
        mortar.marker.visible = false;
        this.sound.playExplosion();
        this.courseProps.particles.emitExplosion(mortar.x, mortar.y, mortar.z, 40, 16);
        this.courseProps.particles.emitShockwave(mortar.x, mortar.y, mortar.z, 14);
        this.emitSnowBurstAt(mortar.x, mortar.y, mortar.z, 24, 13);
        const d = Math.hypot(this.pos.x - mortar.x, this.pos.z - mortar.z);
        this.addShake(Math.max(0.35, 0.95 - d * 0.025));
        if (d < 8) {
          this.pushCallout('MORTAR SHOCKWAVE!', 320);
        }
      }
    }

    // 4. Natural Rock Hazards
    for (const haz of this.courseProps.hazards) {
      const dist = Math.hypot(this.pos.x - haz.x, this.pos.z - haz.z);
      const dy = Math.abs(this.pos.y - haz.y);
      if (dist < haz.radius && dy < 1.55) {
        // Knock speed & trigger wipeout if slamming straight into boulder at high speed
        const speed = Math.hypot(this.vel.x, this.vel.z);
        if (speed > 20) {
          this.cleanRun = false;
          this.emitSnowBurst(26, 8);
          this.sound.playLand(1.3);
          this.addShake(1.05);
          this.setPhase('wipeout');
          this.emitTelemetryNow();
          return;
        } else {
          // Glancing bump at slower speed
          const pushX = Math.sign(this.pos.x - haz.x) || 1;
          this.pos.x = haz.x + pushX * (haz.radius + 0.3);
          this.vel.x = pushX * 6;
          this.vel.z *= 0.6;
        }
      }
    }
  }

  private updateRidingCamera(rawDt: number, speedMs: number): void {
    const isMoneyShot = this.moneyShotTimer > 0 && !this.grounded;

    // Smoothly widen FOV with speed (compressed slightly during money shot for hero framing)
    const targetFov = isMoneyShot
      ? 52
      : THREE.MathUtils.clamp(62 + (speedMs - 14) * 0.55, 62, 79);
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      1 - Math.exp(-5.5 * rawDt)
    );
    this.camera.updateProjectionMatrix();

    if (isMoneyShot) {
      // Dynamic low-angle action pan orbiting smoothly from behind-side to a 3/4 hero profile
      const sweep = Math.min(1.65, this.moneyShotElapsed * 1.35);
      const panAngle = this.moneyShotSide * (0.48 + sweep);
      const radius = 6.5 - Math.min(1.15, this.moneyShotElapsed * 0.65);

      _camTargetPos.set(
        this.pos.x + Math.sin(panAngle) * radius,
        this.pos.y + 1.45,
        this.pos.z + Math.cos(panAngle) * radius
      );
      const camGround = getTerrainHeight(_camTargetPos.x, _camTargetPos.z);
      _camTargetPos.y = Math.max(_camTargetPos.y, camGround + 1.05);

      _camLookAt.set(this.pos.x, this.pos.y + 0.95, this.pos.z - 1.4);
    } else {
      // Steady downhill-oriented chase camera with subtle carve follow (never extreme sideways pan)
      const chaseDist = 6.8 + Math.min(2.0, speedMs * 0.045);
      const chaseHeight = 2.9;
      const subtlePan = Math.sin(this.heading) * 0.22;

      _camTargetPos.set(
        this.pos.x + subtlePan * chaseDist,
        this.pos.y + chaseHeight,
        this.pos.z + chaseDist * 0.96
      );
      // Prevent camera from dipping below snow terrain
      const camGround = getTerrainHeight(_camTargetPos.x, _camTargetPos.z);
      _camTargetPos.y = Math.max(_camTargetPos.y, camGround + 1.35);

      _camLookAt.set(
        this.pos.x - subtlePan * 5.2,
        this.pos.y + 1.25,
        this.pos.z - 9.0
      );
    }

    const posRate = isMoneyShot ? 7.8 : 9.5;
    this.camPos.lerp(_camTargetPos, 1 - Math.exp(-posRate * rawDt));
    this.camLook.lerp(_camLookAt, 1 - Math.exp(-11.5 * rawDt));

    this.camera.position.copy(this.camPos);

    // Multi-frequency stunt camera shake + subtle high-speed snow rumble
    const speedRumble =
      this.grounded && speedMs > 28 ? ((speedMs - 28) / 18) * 0.055 : 0;
    const totalShake = this.cameraShake + speedRumble;
    let shakeRoll = 0;

    if (totalShake > 0.001) {
      const trauma = totalShake * totalShake;
      const t = this.simTime;
      const sx =
        (Math.sin(t * 53.1) * 0.65 + Math.cos(t * 31.7) * 0.35) * trauma * 0.42;
      const sy =
        (Math.cos(t * 61.3) * 0.65 + Math.sin(t * 27.9) * 0.35) * trauma * 0.36;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      shakeRoll = Math.sin(t * 47.3) * trauma * 0.038;
    }

    this.camera.lookAt(this.camLook);

    // Subtle carve bank + stunt dutch tilt during slow-mo action pan + rotational shake
    const baseRoll = isMoneyShot
      ? this.moneyShotSide * 0.065
      : this.carveLean * 0.02;
    this.camera.rotateZ(baseRoll + shakeRoll);
  }

  private updateSunFollow(): void {
    this.sunLight.position.set(this.pos.x + 28, this.pos.y + 42, this.pos.z + 18);
    this.sunLight.target.position.set(this.pos.x, this.pos.y, this.pos.z - 12);
    this.sunLight.target.updateMatrixWorld();
  }

  private emitSnowBurst(count: number, power: number): void {
    this.emitSnowBurstAt(this.pos.x, this.pos.y + 0.15, this.pos.z, count, power);
  }

  private emitSnowBurstAt(x: number, y: number, z: number, count: number, power: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.8) * power;
      this.courseProps?.particles.emitSnow(
        x + (Math.random() - 0.5) * 0.6,
        y,
        z + (Math.random() - 0.5) * 0.6,
        Math.cos(a) * spd,
        2.0 + Math.random() * power * 0.7,
        Math.sin(a) * spd,
        1.15
      );
    }
  }

  private finishTake(): void {
    this.setPhase('verdict');
    const requiredScore = this.getRequiredScore(this.takeNumber);
    const verdict = buildDirectorVerdict({
      takeNumber: this.takeNumber,
      spectacleScore: this.spectacleScore,
      requiredScore,
      topSpeedKmh: this.topSpeedKmh,
      maxAirTime: Number(this.maxAirTime.toFixed(2)),
      tricksLanded: this.tricksLanded,
      hoopsCleared: this.hoopsCleared,
      rampsExploded: this.rampsHit,
      moneyShots: this.moneyShotsCaptured,
      cleanRun: this.cleanRun,
    });
    this.emitTelemetryNow();
    this.callbacks.onVerdict(verdict);
  }

  private emitTelemetryNow(): void {
    const speedMs = Math.hypot(this.vel.x, this.vel.z);
    const progress = THREE.MathUtils.clamp(-this.pos.z / COURSE_LENGTH, 0, 1);
    const groundAtRider = this.sampleSurfaceHeight(this.pos.x, this.pos.z);
    const heightAboveGround = Math.max(0, Number((this.pos.y - groundAtRider).toFixed(1)));
    const landing = this.evaluateLandingSafety();

    this.callbacks.onTelemetry({
      speedKmh: Math.round(speedMs * 3.6),
      airTime: Number(this.airTime.toFixed(2)),
      maxAirTime: Number(this.maxAirTime.toFixed(2)),
      distanceProgress: progress,
      elapsedTime: this.runElapsed,
      spectacleScore: this.spectacleScore,
      requiredScore: this.getRequiredScore(this.takeNumber),
      comboCount: this.comboCount,
      rampsHit: this.rampsHit,
      hoopsCleared: this.hoopsCleared,
      tricksLanded: this.tricksLanded,
      nearMisses: this.nearMisses,
      moneyShotsCaptured: this.moneyShotsCaptured,
      isAirborne: !this.grounded,
      isBraking: this.grounded && this.input.down,
      isTucking: this.grounded && this.input.up && !this.input.down,
      isMoneyShotActive: this.moneyShotTimer > 0 && !this.grounded,
      jumpCharge: this.isJumpHolding ? Math.max(0, this.jumpHoldTimer / 0.28) : 0,
      activeSpinDeg: Math.round(Math.abs(THREE.MathUtils.radToDeg(this.airSpin))),
      activeFlipDeg: Math.round(Math.abs(THREE.MathUtils.radToDeg(this.airFlip))),
      landingState: landing.state,
      landingOffsetDeg: landing.offsetDeg,
      heightAboveGround,
      isGrabbing: !this.grounded && this.input.grab,
      countdownStep: Math.max(0, Math.ceil(this.countdownTimer)),
      callout: this.activeCallout,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.sound.dispose();
    this.mountain.dispose();
    this.rider.dispose();
    this.courseProps?.dispose();
    this.visualDisposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
