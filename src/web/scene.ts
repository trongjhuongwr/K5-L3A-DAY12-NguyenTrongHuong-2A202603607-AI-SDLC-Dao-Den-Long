import * as THREE from "three";
import { LanternState, ShadeState, MoteState, DrifterState, CharmState } from "../core/types.js";
import { MapConfig } from "../core/maps.js";

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private ambientLight: THREE.AmbientLight;
  private moonLight: THREE.DirectionalLight;
  private cloudsMesh: THREE.InstancedMesh;
  private islandGroup: THREE.Group;

  public lanternMeshes: Map<
    string,
    { group: THREE.Group; light: THREE.PointLight; core: THREE.Mesh; beacon: THREE.Mesh }
  > = new Map();
  public moteMeshes: Map<string, THREE.Group> = new Map();
  public shadeMeshes: Map<string, { group: THREE.Group; eye: THREE.Mesh; aura: THREE.PointLight }> = new Map();
  public drifterMeshes: Map<string, THREE.Group> = new Map();
  public charmMeshes: Map<string, THREE.Group> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1430);
    this.scene.fog = new THREE.FogExp2(0x1b2350, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.ambientLight = new THREE.AmbientLight(0x0e1430, 0.2);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0x7080b0, 0.5);
    this.moonLight.position.set(25, 50, 25);
    this.scene.add(this.moonLight);

    this.islandGroup = new THREE.Group();
    this.scene.add(this.islandGroup);

    this.buildStars();
    this.cloudsMesh = this.buildSeaOfClouds();

    window.addEventListener("resize", () => this.onResize());
  }

  loadMapGeometry(mapConfig: MapConfig): void {
    while (this.islandGroup.children.length > 0) {
      this.islandGroup.remove(this.islandGroup.children[0]);
    }
    this.lanternMeshes.clear();
    this.moteMeshes.clear();
    this.shadeMeshes.clear();
    this.drifterMeshes.clear();
    this.charmMeshes.clear();

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2f5d50,
      roughness: 0.9,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a2f,
      roughness: 0.8,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xc9b48a,
      roughness: 0.7,
    });

    if (mapConfig.night === 1) {
      // Đảo Bến: Disc r=40m
      const islandGeo = new THREE.CylinderGeometry(40, 38, 4, 64);
      const island = new THREE.Mesh(islandGeo, grassMat);
      island.position.y = -2;
      this.islandGroup.add(island);

      const rimGeo = new THREE.TorusGeometry(40, 0.5, 16, 64);
      const rim = new THREE.Mesh(rimGeo, stoneMat);
      rim.rotation.x = Math.PI / 2;
      this.islandGroup.add(rim);
    } else if (mapConfig.night === 2) {
      // Đảo Cau: 2 discs r=28m at (0,0) and (70,0)
      const islandAGeo = new THREE.CylinderGeometry(28, 26, 4, 48);
      const islandA = new THREE.Mesh(islandAGeo, grassMat);
      islandA.position.set(0, -2, 0);
      this.islandGroup.add(islandA);

      const islandBGeo = new THREE.CylinderGeometry(28, 26, 4, 48);
      const islandB = new THREE.Mesh(islandBGeo, grassMat);
      islandB.position.set(70, -2, 0);
      this.islandGroup.add(islandB);

      // Bamboo bridge x in [26, 44], z in [-2, 2]
      const bridgeGeo = new THREE.BoxGeometry(18, 0.4, 4);
      const bridge = new THREE.Mesh(bridgeGeo, woodMat);
      bridge.position.set(35, -0.2, 0);
      this.islandGroup.add(bridge);

      this.buildJumpPadVisual(20, 0, 18);
      this.buildJumpPadVisual(50, 0, -18);
    } else if (mapConfig.night === 3) {
      // Đảo Chuông: 3 tiers
      const tier0Geo = new THREE.CylinderGeometry(45, 43, 4, 64);
      const tier0 = new THREE.Mesh(tier0Geo, grassMat);
      tier0.position.y = -2;
      this.islandGroup.add(tier0);

      const tier1Geo = new THREE.CylinderGeometry(24, 24, 3, 32, 1, false, 0, Math.PI);
      const tier1 = new THREE.Mesh(tier1Geo, stoneMat);
      tier1.position.set(0, 1.5, 0);
      this.islandGroup.add(tier1);

      const tier2Geo = new THREE.CylinderGeometry(8, 8, 3, 32);
      const tier2 = new THREE.Mesh(tier2Geo, stoneMat);
      tier2.position.set(0, 4.5, 0);
      this.islandGroup.add(tier2);

      const towerGeo = new THREE.CylinderGeometry(2, 2.2, 8, 16);
      const tower = new THREE.Mesh(towerGeo, woodMat);
      tower.position.set(0, 10, 0);
      this.islandGroup.add(tower);

      this.buildJumpPadVisual(0, 3, 13);
    }
  }

  private buildJumpPadVisual(x: number, y: number, z: number): void {
    const padGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x8fa3b8,
      emissive: 0x2288aa,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(x, y + 0.1, z);
    this.islandGroup.add(pad);
  }

  private buildStars(): void {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 450;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 200;
      posArray[i + 1] = Math.random() * 60 + 20;
      posArray[i + 2] = (Math.random() - 0.5) * 200;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xfff6c2,
      size: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    this.scene.add(starField);
  }

  private buildSeaOfClouds(): THREE.InstancedMesh {
    const cloudGeo = new THREE.DodecahedronGeometry(6, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x12384a,
      roughness: 1.0,
      transparent: true,
      opacity: 0.7,
    });
    const count = 50;
    const mesh = new THREE.InstancedMesh(cloudGeo, cloudMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      const dist = 50 + (i % 4) * 8;
      dummy.position.set(
        Math.cos(angle) * dist,
        -5 - (i % 5),
        Math.sin(angle) * dist
      );
      dummy.scale.set(1.8, 0.6, 1.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  // Sync 3D Lanterns with Beacon Beams
  syncLanterns(lanterns: LanternState[]): void {
    for (const l of lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        const group = new THREE.Group();
        group.position.set(l.pos[0], l.pos[1], l.pos[2]);

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.2, 12);
        const poleMat = new THREE.MeshStandardMaterial({
          color: 0x6b4a2f,
          roughness: 0.9,
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.6;
        group.add(pole);

        // Octagonal Cage
        const cageGeo = new THREE.OctahedronGeometry(0.85, 0);
        const cageMat = new THREE.MeshStandardMaterial({
          color: 0x5b5f6e,
          roughness: 0.6,
          wireframe: true,
        });
        const cage = new THREE.Mesh(cageGeo, cageMat);
        cage.position.y = 3.2;
        group.add(cage);

        // Core flame sphere
        const coreGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x5b5f6e,
          roughness: 0.4,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 3.2;
        group.add(core);

        // Light
        const light = new THREE.PointLight(0xffb347, 0, 22);
        light.position.y = 3.2;
        group.add(light);

        // Safe radius boundary ring (r=6.0m)
        const ringGeo = new THREE.RingGeometry(5.8, 6.0, 36);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf2c14e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        });
        const safeRing = new THREE.Mesh(ringGeo, ringMat);
        safeRing.rotation.x = -Math.PI / 2;
        safeRing.position.y = 0.05;
        group.add(safeRing);

        // BEACON BEAM: Glowing vertical light column shooting into the sky (height 45m)
        const beaconGeo = new THREE.CylinderGeometry(0.18, 0.35, 45, 12, 1, true);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: 0xffe9b0,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 25.0; // reaches up to Y=47.5m
        group.add(beacon);

        this.scene.add(group);
        entry = { group, light, core, beacon };
        this.lanternMeshes.set(l.id, entry);
      }

      entry.group.position.set(l.pos[0], l.pos[1], l.pos[2]);

      // Subtle beacon pulse
      const beaconMat = entry.beacon.material as THREE.MeshBasicMaterial;

      if (l.lit) {
        entry.light.intensity = 3.0;
        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        coreMat.color.setHex(0xffb347);
        coreMat.emissive.setHex(0xffe9b0);
        coreMat.emissiveIntensity = 1.0;

        const safeRing = entry.group.children[4] as THREE.Mesh;
        if (safeRing && safeRing.material) {
          (safeRing.material as THREE.MeshBasicMaterial).opacity = 0.35;
        }

        // Lit lantern beacon turns into steady radiant gold
        beaconMat.color.setHex(0xffb347);
        beaconMat.opacity = 0.15;
      } else {
        const fillRatio = Math.min(1.0, l.deposited / 10.0);
        entry.light.intensity = fillRatio * 1.0;
        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        if (fillRatio > 0) {
          coreMat.color.setHex(0xffb347);
          coreMat.emissive.setHex(0xff7700);
          coreMat.emissiveIntensity = fillRatio * 0.6;
        } else {
          coreMat.color.setHex(0x5b5f6e);
          coreMat.emissive.setHex(0x000000);
        }

        // Unlit beacon pulses brightly so player can spot it from far away
        const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 0.35;
        beaconMat.color.setHex(0xffe58a);
        beaconMat.opacity = pulse;
      }
    }

    const litCount = lanterns.filter((l) => l.lit).length;
    const total = Math.max(1, lanterns.length);
    this.ambientLight.intensity = 0.15 + 0.55 * (litCount / total);
    this.moonLight.intensity = 0.4 + 0.35 * (litCount / total);
  }

  syncMotes(motes: MoteState[]): void {
    const activeIds = new Set<string>();

    for (const m of motes) {
      if (!m.collected) {
        activeIds.add(m.id);
        let meshGroup = this.moteMeshes.get(m.id);
        if (!meshGroup) {
          meshGroup = new THREE.Group();

          const sphereGeo = new THREE.SphereGeometry(0.24, 12, 12);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: m.kind === "dropped" ? 0xff5a5f : 0xfff6c2,
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          meshGroup.add(sphere);

          const light = new THREE.PointLight(0xffe58a, 1.0, 4.0);
          meshGroup.add(light);

          this.scene.add(meshGroup);
          this.moteMeshes.set(m.id, meshGroup);
        }

        const bob = Math.sin(Date.now() * 0.006 + m.pos[0] * 2) * 0.25 + 0.5;
        meshGroup.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
      }
    }

    for (const [id, group] of this.moteMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.moteMeshes.delete(id);
      }
    }
  }

  syncShades(shades: ShadeState[]): void {
    const activeIds = new Set<string>();

    for (const s of shades) {
      activeIds.add(s.id);
      let entry = this.shadeMeshes.get(s.id);
      if (!entry) {
        const group = new THREE.Group();

        const bodyGeo = new THREE.DodecahedronGeometry(0.75, 1);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x120a1a,
          roughness: 0.9,
          emissive: 0x1a0a25,
          emissiveIntensity: 0.5,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        group.add(body);

        const eyeGeo = new THREE.SphereGeometry(0.14, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x7a3cff });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0, 0.9, 0.6);
        group.add(eye);

        const aura = new THREE.PointLight(0x7a3cff, 1.2, 4.5);
        aura.position.y = 0.8;
        group.add(aura);

        this.scene.add(group);
        entry = { group, eye, aura };
        this.shadeMeshes.set(s.id, entry);
      }

      const bob = Math.sin(Date.now() * 0.008 + s.pos[0]) * 0.15;
      entry.group.position.set(s.pos[0], s.pos[1] + bob, s.pos[2]);

      if (s.state === "stunned") {
        entry.eye.material = new THREE.MeshBasicMaterial({ color: 0x3a3450 });
        entry.aura.color.setHex(0x3a3450);
        entry.aura.intensity = 0.3;
      } else {
        entry.eye.material = new THREE.MeshBasicMaterial({ color: 0x7a3cff });
        entry.aura.color.setHex(0x7a3cff);
        entry.aura.intensity = 1.2;
      }
    }

    for (const [id, entry] of this.shadeMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        this.shadeMeshes.delete(id);
      }
    }
  }

  syncDrifters(drifters: DrifterState[]): void {
    const activeIds = new Set<string>();

    for (const d of drifters) {
      if (d.state !== "removed") {
        activeIds.add(d.id);
        let group = this.drifterMeshes.get(d.id);
        if (!group) {
          group = new THREE.Group();

          const ribbonGeo = new THREE.ConeGeometry(0.5, 2.2, 8);
          const ribbonMat = new THREE.MeshStandardMaterial({
            color: 0x8fa3b8,
            roughness: 0.4,
            transparent: true,
            opacity: 0.85,
          });
          const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
          ribbon.rotation.x = Math.PI / 2;
          group.add(ribbon);

          const light = new THREE.PointLight(0x8fa3b8, 1.0, 5.0);
          group.add(light);

          this.scene.add(group);
          this.drifterMeshes.set(d.id, group);
        }

        group.position.set(d.pos[0], d.pos[1], d.pos[2]);
        group.rotation.y += 0.04;
      }
    }

    for (const [id, group] of this.drifterMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.drifterMeshes.delete(id);
      }
    }
  }

  syncCharms(charms: CharmState[]): void {
    const activeIds = new Set<string>();

    for (const c of charms) {
      if (c.available) {
        activeIds.add(c.id);
        let group = this.charmMeshes.get(c.id);
        if (!group) {
          group = new THREE.Group();

          const cardGeo = new THREE.BoxGeometry(0.5, 0.8, 0.06);
          const cardMat = new THREE.MeshStandardMaterial({
            color: 0xc8102e,
            emissive: 0x770515,
            roughness: 0.5,
          });
          const card = new THREE.Mesh(cardGeo, cardMat);
          group.add(card);

          const borderGeo = new THREE.BoxGeometry(0.54, 0.84, 0.04);
          const borderMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e });
          const border = new THREE.Mesh(borderGeo, borderMat);
          group.add(border);

          const light = new THREE.PointLight(0xc8102e, 1.2, 4.0);
          group.add(light);

          this.scene.add(group);
          this.charmMeshes.set(c.id, group);
        }

        const bob = Math.sin(Date.now() * 0.006) * 0.2 + 0.8;
        group.position.set(c.pos[0], c.pos[1] + bob, c.pos[2]);
        group.rotation.y += 0.03;
      }
    }

    for (const [id, group] of this.charmMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.charmMeshes.delete(id);
      }
    }
  }

  updateCamera(
    playerPos: [number, number, number],
    camYawDeg: number,
    camPitchDeg: number,
    camDist: number = 7.5
  ): void {
    const yawRad = (camYawDeg * Math.PI) / 180.0;
    const pitchRad = (camPitchDeg * Math.PI) / 180.0;
    const height = 3.2;

    const camX = playerPos[0] - Math.sin(yawRad) * Math.cos(pitchRad) * camDist;
    const camZ = playerPos[2] - Math.cos(yawRad) * Math.cos(pitchRad) * camDist;
    const camY = playerPos[1] + height + Math.sin(pitchRad) * camDist;

    this.camera.position.set(camX, Math.max(0.5, camY), camZ);
    this.camera.lookAt(playerPos[0], playerPos[1] + 1.2, playerPos[2]);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += 0.0003;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
