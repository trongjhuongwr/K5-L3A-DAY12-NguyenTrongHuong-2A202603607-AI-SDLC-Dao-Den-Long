import * as THREE from "three";
import { LanternState, ShadeState, MoteState, DrifterState, CharmState } from "../core/types.js";
import { MapConfig } from "../core/maps.js";

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private ambientLight: THREE.AmbientLight;
  private moonLight: THREE.DirectionalLight;
  private cloudsMesh: any;
  private islandGroup: THREE.Group;

  public colorblindMode: boolean = false;

  public lanternMeshes: Map<
    string,
    {
      group: THREE.Group;
      light: THREE.PointLight;
      core: THREE.Mesh;
      beacon: THREE.Mesh;
      safeRing: THREE.Mesh;
      billboard: THREE.Group;
      fuelBarBg: THREE.Mesh;
      fuelBar: THREE.Mesh;
    }
  > = new Map();

  public moteMeshes: Map<string, THREE.Group> = new Map();
  public shadeMeshes: Map<string, { group: THREE.Group; eye: THREE.Mesh }> = new Map();
  public drifterMeshes: Map<string, THREE.Group> = new Map();
  public charmMeshes: Map<string, THREE.Group> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e172e);
    // Remove murky fog so the island, stars, lanterns and fireflies are crystal clear
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Crisp, vivid ambient night lighting
    this.ambientLight = new THREE.AmbientLight(0x7090c5, 1.35);
    this.scene.add(this.ambientLight);

    // Warm moonlight
    this.moonLight = new THREE.DirectionalLight(0xe5f0ff, 1.45);
    this.moonLight.position.set(35, 65, 30);
    this.scene.add(this.moonLight);

    // Hemisphere light: gentle sky/ground bounce
    const hemiLight = new THREE.HemisphereLight(0x84aadc, 0x244234, 0.8);
    this.scene.add(hemiLight);

    this.islandGroup = new THREE.Group();
    this.scene.add(this.islandGroup);

    this.buildStars();
    this.buildMoon();
    this.cloudsMesh = this.buildSeaOfClouds();

    window.addEventListener("resize", () => this.onResize());
  }

  private buildMoon(): void {
    const moonGeo = new THREE.SphereGeometry(6, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xfff8d6,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(60, 90, 80);
    this.scene.add(moon);
  }

  setColorblindMode(enabled: boolean): void {
    this.colorblindMode = enabled;
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
      color: 0x3aa876,
      roughness: 0.65,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x9c653d,
      roughness: 0.65,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xecdcb6,
      roughness: 0.55,
      emissive: 0x221c10,
      emissiveIntensity: 0.2,
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

      // 2 Jump pads
      for (const pad of mapConfig.jumpPads) {
        const padGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 16);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0xf2c14e,
          roughness: 0.5,
          emissive: 0xffb347,
          emissiveIntensity: 0.6,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.position.set(pad.pos[0], pad.pos[1] + 0.15, pad.pos[2]);
        this.islandGroup.add(padMesh);
      }
    } else if (mapConfig.night === 3) {
      // Đảo Chuông: 3 tiers
      // Tier 0: r=42m, Y=0
      const t0Geo = new THREE.CylinderGeometry(42, 40, 3, 64);
      const t0 = new THREE.Mesh(t0Geo, grassMat);
      t0.position.y = -1.5;
      this.islandGroup.add(t0);

      // Tier 1: ring 12 <= r <= 24, z > 0, Y=3
      const t1Geo = new THREE.CylinderGeometry(24, 24, 3, 48, 1, false, 0, Math.PI);
      const t1 = new THREE.Mesh(t1Geo, grassMat);
      t1.position.set(0, 1.5, 0);
      t1.rotation.y = Math.PI;
      this.islandGroup.add(t1);

      // Tier 2: disc r=8m, Y=6
      const t2Geo = new THREE.CylinderGeometry(8, 8, 3, 32);
      const t2 = new THREE.Mesh(t2Geo, stoneMat);
      t2.position.set(0, 4.5, 0);
      this.islandGroup.add(t2);

      // Center Bell Tower: cylinder r=2m, height 12m, Y=6 to 18
      const towerGeo = new THREE.CylinderGeometry(2, 2.4, 12, 16);
      const tower = new THREE.Mesh(towerGeo, stoneMat);
      tower.position.set(0, 12, 0);
      this.islandGroup.add(tower);

      // Jump pad at (0, 3, 13)
      for (const pad of mapConfig.jumpPads) {
        const padGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 16);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0xf2c14e,
          roughness: 0.5,
          emissive: 0xffb347,
          emissiveIntensity: 0.6,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.position.set(pad.pos[0], pad.pos[1] + 0.15, pad.pos[2]);
        this.islandGroup.add(padMesh);
      }
    }
  }

  private buildStars(): void {
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 180 + Math.random() * 60;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 15;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.95,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(starPoints);
  }

  private buildSeaOfClouds(): any {
    // Smooth calm reflective night sea beneath the floating archipelago
    const seaGeo = new THREE.CylinderGeometry(260, 260, 2, 64);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x060f1c,
      roughness: 0.35,
      metalness: 0.15,
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.position.y = -3.8;
    this.scene.add(sea);
    return sea;
  }

  // Sync Lanterns (includes Phase 3 Fuel bar, 1Hz blinking, 20% collapsed when unlit)
  syncLanterns(lanterns: LanternState[]): void {
    for (const l of lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        const group = new THREE.Group();

        // Lantern stone base
        const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.2, 12);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0xc9b48a,
          roughness: 0.7,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        group.add(base);

        // Wooden pillar
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.0, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x6b4a2f,
          roughness: 0.8,
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = 2.0;
        group.add(pillar);

        // Lantern cage
        const cageGeo = new THREE.OctahedronGeometry(1.1, 0);
        const cageMat = new THREE.MeshStandardMaterial({
          color: 0x6b4a2f,
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
        beacon.position.y = 25.0;
        group.add(beacon);

        // Fuel Gauge Bar Billboard (facing camera)
        const billboard = new THREE.Group();
        billboard.position.y = 4.4;

        const barBgGeo = new THREE.PlaneGeometry(1.5, 0.22);
        const barBgMat = new THREE.MeshBasicMaterial({
          color: 0x111424,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const fuelBarBg = new THREE.Mesh(barBgGeo, barBgMat);
        billboard.add(fuelBarBg);

        const barGeo = new THREE.PlaneGeometry(1.44, 0.16);
        const barMat = new THREE.MeshBasicMaterial({
          color: 0x20e377,
          side: THREE.DoubleSide,
        });
        const fuelBar = new THREE.Mesh(barGeo, barMat);
        fuelBar.position.z = 0.01;
        billboard.add(fuelBar);

        group.add(billboard);

        this.scene.add(group);
        entry = { group, light, core, beacon, safeRing, billboard, fuelBarBg, fuelBar };
        this.lanternMeshes.set(l.id, entry);
      }

      entry.group.position.set(l.pos[0], l.pos[1], l.pos[2]);

      // Orient billboard directly to face camera
      entry.billboard.quaternion.copy(this.camera.quaternion);

      const beaconMat = entry.beacon.material as THREE.MeshBasicMaterial;

      if (l.lit) {
        entry.group.scale.y = 1.0;
        entry.billboard.visible = true;

        const fuelRatio = Math.max(0.01, l.fuel / 100.0);
        entry.fuelBar.scale.x = fuelRatio;
        entry.fuelBar.position.x = -0.72 + 0.72 * fuelRatio;

        const barMat = entry.fuelBar.material as THREE.MeshBasicMaterial;
        if (l.fuel >= 50) {
          barMat.color.setHex(0x20e377); // Green
        } else if (l.fuel >= 30) {
          barMat.color.setHex(0xf2c14e); // Yellow
        } else {
          barMat.color.setHex(0xff5a5f); // Red
        }

        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        coreMat.color.setHex(0xffb347);
        coreMat.emissive.setHex(0xffe9b0);

        // Low fuel (<30): Lost safe zone, 1Hz blinking
        if (l.fuel < 30) {
          const blink = Math.sin(Date.now() * 0.006) > 0;
          entry.light.intensity = blink ? 2.5 : 0.5;
          coreMat.emissiveIntensity = blink ? 1.0 : 0.2;
          (entry.safeRing.material as THREE.MeshBasicMaterial).opacity = 0;
          beaconMat.color.setHex(0xff5a5f);
          beaconMat.opacity = blink ? 0.35 : 0.08;
        } else {
          entry.light.intensity = 3.0;
          coreMat.emissiveIntensity = 1.0;
          (entry.safeRing.material as THREE.MeshBasicMaterial).opacity = 0.35;
          beaconMat.color.setHex(0xffb347);
          beaconMat.opacity = 0.15;
        }
      } else {
        // Unlit: 20% collapsed in Y
        entry.group.scale.y = 0.8;
        entry.billboard.visible = false;
        (entry.safeRing.material as THREE.MeshBasicMaterial).opacity = 0;

        const cost = l.ever_lit ? 5.0 : 10.0;
        const fillRatio = Math.min(1.0, l.deposited / cost);
        entry.light.intensity = fillRatio * 1.0;

        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        if (fillRatio > 0) {
          coreMat.color.setHex(0xffb347);
          coreMat.emissive.setHex(0xff7700);
          coreMat.emissiveIntensity = fillRatio * 0.6;
        } else {
          coreMat.color.setHex(0x3a3f50);
          coreMat.emissive.setHex(0x000000);
        }

        const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 0.35;
        beaconMat.color.setHex(0xffe58a);
        beaconMat.opacity = pulse;
      }
    }

    const litCount = lanterns.filter((l) => l.lit).length;
    const total = Math.max(1, lanterns.length);
    this.ambientLight.intensity = 1.1 + 0.45 * (litCount / total);
    this.moonLight.intensity = 1.3 + 0.5 * (litCount / total);
  }

  // Sync Motes (Lightweight self-illuminating meshes, zero PointLight cost)
  syncMotes(motes: MoteState[]): void {
    const activeIds = new Set<string>();

    for (const m of motes) {
      if (!m.collected) {
        activeIds.add(m.id);
        let meshGroup = this.moteMeshes.get(m.id);
        if (!meshGroup) {
          meshGroup = new THREE.Group();

          // Bright glowing core
          const sphereGeo = new THREE.SphereGeometry(0.3, 10, 10);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: m.kind === "dropped" ? 0xff4433 : 0xffea78,
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          meshGroup.add(sphere);

          // Soft translucent outer halo for ethereal firefly look
          const haloGeo = new THREE.SphereGeometry(0.55, 10, 10);
          const haloMat = new THREE.MeshBasicMaterial({
            color: m.kind === "dropped" ? 0xff3322 : 0xfffaab,
            transparent: true,
            opacity: 0.35,
          });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          meshGroup.add(halo);

          this.scene.add(meshGroup);
          this.moteMeshes.set(m.id, meshGroup);
        }

        const bob = Math.sin(Date.now() * 0.006 + m.pos[0] * 2) * 0.25 + 0.5;
        meshGroup.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
      }
    }

    for (const [id, mesh] of this.moteMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.moteMeshes.delete(id);
      }
    }
  }

  // Sync Shades (includes Colorblind mode & Drain animation, zero PointLight cost)
  syncShades(shades: ShadeState[]): void {
    const activeIds = new Set<string>();
    const baseColor = this.colorblindMode ? 0x00b3ff : 0x7a3cff;

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

        const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: baseColor });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0, 0.9, 0.6);
        group.add(eye);

        this.scene.add(group);
        entry = { group, eye };
        this.shadeMeshes.set(s.id, entry);
      }

      const bob = Math.sin(Date.now() * 0.008 + s.pos[0]) * 0.15;
      entry.group.position.set(s.pos[0], s.pos[1] + bob, s.pos[2]);

      const eyeMat = entry.eye.material as THREE.MeshBasicMaterial;
      if (s.state === "stunned") {
        eyeMat.color.setHex(0x3a3450);
      } else if (s.state === "drain") {
        const drainBlink = Math.sin(Date.now() * 0.02) > 0;
        eyeMat.color.setHex(drainBlink ? 0xff5a5f : baseColor);
      } else {
        eyeMat.color.setHex(baseColor);
      }
    }

    for (const [id, entry] of this.shadeMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        this.shadeMeshes.delete(id);
      }
    }
  }

  // Sync Drifters
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
            emissive: 0x3a4b60,
            emissiveIntensity: 0.4,
          });
          const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
          ribbon.rotation.x = Math.PI / 2;
          group.add(ribbon);

          this.scene.add(group);
          this.drifterMeshes.set(d.id, group);
        }

        const flutter = Math.sin(Date.now() * 0.015 + d.pos[0]) * 0.3;
        group.position.set(d.pos[0], d.pos[1] + flutter, d.pos[2]);
      }
    }

    for (const [id, group] of this.drifterMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.drifterMeshes.delete(id);
      }
    }
  }

  // Sync Charms
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
            roughness: 0.5,
            emissive: 0xff3344,
            emissiveIntensity: 0.5,
          });
          const card = new THREE.Mesh(cardGeo, cardMat);
          group.add(card);

          this.scene.add(group);
          this.charmMeshes.set(c.id, group);
        }

        const spin = Date.now() * 0.003;
        const bob = Math.sin(spin * 2) * 0.2 + 1.2;
        group.position.set(c.pos[0], c.pos[1] + bob, c.pos[2]);
        group.rotation.y = spin;
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

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
