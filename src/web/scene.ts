import * as THREE from "three";
import { LanternState, ShadeState, MoteState } from "../core/types.js";

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private ambientLight: THREE.AmbientLight;
  private moonLight: THREE.DirectionalLight;
  private cloudsMesh: THREE.InstancedMesh;

  public lanternMeshes: Map<string, { group: THREE.Group; light: THREE.PointLight; core: THREE.Mesh }> = new Map();
  public moteMeshes: Map<string, THREE.Group> = new Map();
  public shadeMeshes: Map<string, { group: THREE.Group; eye: THREE.Mesh; aura: THREE.PointLight }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060515);
    this.scene.fog = new THREE.FogExp2(0x0b0922, 0.022);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0x191838, 0.6);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0x7080b0, 0.5);
    this.moonLight.position.set(20, 40, 20);
    this.scene.add(this.moonLight);

    // Build Island and environment
    this.buildIsland();
    this.buildStars();
    this.cloudsMesh = this.buildSeaOfClouds();

    window.addEventListener("resize", () => this.onResize());
  }

  private buildIsland(): void {
    // Island disc
    const islandGeo = new THREE.CylinderGeometry(35, 33, 4, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x1a2e1d, // night grass green
      roughness: 0.9,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -2;
    this.scene.add(island);

    // Island rim border
    const rimGeo = new THREE.TorusGeometry(35, 0.4, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3d352e,
      roughness: 0.8,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0;
    this.scene.add(rim);

    // Central ancient shrine stone
    const shrineGeo = new THREE.CylinderGeometry(2.5, 3.0, 0.3, 16);
    const shrineMat = new THREE.MeshStandardMaterial({
      color: 0x423e4f,
      roughness: 0.7,
    });
    const shrine = new THREE.Mesh(shrineGeo, shrineMat);
    shrine.position.y = 0.15;
    this.scene.add(shrine);
  }

  private buildStars(): void {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 160;
      posArray[i + 1] = Math.random() * 50 + 20;
      posArray[i + 2] = (Math.random() - 0.5) * 160;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xfff9e6,
      size: 0.8,
      transparent: true,
      opacity: 0.8,
    });
    const starField = new THREE.Points(starGeo, starMat);
    this.scene.add(starField);
  }

  private buildSeaOfClouds(): THREE.InstancedMesh {
    const cloudGeo = new THREE.DodecahedronGeometry(5, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x1b1b36,
      roughness: 1.0,
      transparent: true,
      opacity: 0.65,
    });
    const count = 40;
    const mesh = new THREE.InstancedMesh(cloudGeo, cloudMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      const dist = 42 + (i % 3) * 6;
      dummy.position.set(
        Math.cos(angle) * dist,
        -4 - (i % 4),
        Math.sin(angle) * dist
      );
      dummy.scale.set(1.5, 0.5, 1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  // Build 3D Big Lantern
  syncLanterns(lanterns: LanternState[]): void {
    for (const l of lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        const group = new THREE.Group();
        group.position.set(l.pos[0], l.pos[1], l.pos[2]);

        // Pillar base
        const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.2, 12);
        const poleMat = new THREE.MeshStandardMaterial({
          color: 0x3d271d,
          roughness: 0.9,
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.6;
        group.add(pole);

        // Lantern cage
        const cageGeo = new THREE.OctahedronGeometry(0.8, 0);
        const cageMat = new THREE.MeshStandardMaterial({
          color: 0x221510,
          roughness: 0.6,
          wireframe: true,
        });
        const cage = new THREE.Mesh(cageGeo, cageMat);
        cage.position.y = 3.2;
        group.add(cage);

        // Core flame sphere
        const coreGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x554433,
          emissive: 0x000000,
          roughness: 0.4,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 3.2;
        group.add(core);

        // Light source
        const light = new THREE.PointLight(0xffa834, 0, 18);
        light.position.y = 3.2;
        group.add(light);

        // Safe radius boundary ring (subtle circle on ground)
        const ringGeo = new THREE.RingGeometry(4.3, 4.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        });
        const safeRing = new THREE.Mesh(ringGeo, ringMat);
        safeRing.rotation.x = -Math.PI / 2;
        safeRing.position.y = 0.05;
        group.add(safeRing);

        this.scene.add(group);
        entry = { group, light, core };
        this.lanternMeshes.set(l.id, entry);
      }

      // Update position
      entry.group.position.set(l.pos[0], l.pos[1], l.pos[2]);

      // Update lighting state
      if (l.lit) {
        entry.light.intensity = 2.5;
        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        coreMat.color.setHex(0xffaa22);
        coreMat.emissive.setHex(0xff7700);
        coreMat.emissiveIntensity = 1.0;

        // Show safe zone ring
        const safeRing = entry.group.children[4] as THREE.Mesh;
        if (safeRing && safeRing.material) {
          (safeRing.material as THREE.MeshBasicMaterial).opacity = 0.25;
        }
      } else {
        const fillRatio = Math.min(1.0, l.deposited / 5.0);
        entry.light.intensity = fillRatio * 0.8;
        const coreMat = entry.core.material as THREE.MeshStandardMaterial;
        if (fillRatio > 0) {
          coreMat.emissive.setHex(0xaa4400);
          coreMat.emissiveIntensity = fillRatio * 0.5;
        } else {
          coreMat.emissive.setHex(0x000000);
        }
      }
    }

    // Dynamic island illumination as lanterns are lit
    const litCount = lanterns.filter((l) => l.lit).length;
    this.ambientLight.intensity = 0.6 + litCount * 0.12;
    this.moonLight.intensity = 0.5 + litCount * 0.1;
  }

  // Sync fireflies (motes)
  syncMotes(motes: MoteState[]): void {
    const activeIds = new Set<string>();

    for (const m of motes) {
      if (!m.collected) {
        activeIds.add(m.id);
        let meshGroup = this.moteMeshes.get(m.id);
        if (!meshGroup) {
          meshGroup = new THREE.Group();

          const sphereGeo = new THREE.SphereGeometry(0.2, 12, 12);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: 0xffea78,
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          meshGroup.add(sphere);

          const light = new THREE.PointLight(0xffea78, 0.8, 3.5);
          meshGroup.add(light);

          this.scene.add(meshGroup);
          this.moteMeshes.set(m.id, meshGroup);
        }

        // Bobbing floating animation
        const bob = Math.sin(Date.now() * 0.005 + m.pos[0] * 2) * 0.3 + 0.6;
        meshGroup.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
      }
    }

    // Remove collected motes from 3D scene
    for (const [id, group] of this.moteMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.moteMeshes.delete(id);
      }
    }
  }

  // Sync Bóng Mực (shades)
  syncShades(shades: ShadeState[]): void {
    const activeIds = new Set<string>();

    for (const s of shades) {
      activeIds.add(s.id);
      let entry = this.shadeMeshes.get(s.id);
      if (!entry) {
        const group = new THREE.Group();

        // Dark ink body
        const bodyGeo = new THREE.DodecahedronGeometry(0.7, 1);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x11081f,
          roughness: 0.9,
          emissive: 0x220533,
          emissiveIntensity: 0.4,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        group.add(body);

        // Ominous glowing eye
        const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({
          color: 0xcc22ff,
        });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0, 0.9, 0.6);
        group.add(eye);

        // Purple aura light
        const aura = new THREE.PointLight(0x8811cc, 1.0, 4.0);
        aura.position.y = 0.8;
        group.add(aura);

        this.scene.add(group);
        entry = { group, eye, aura };
        this.shadeMeshes.set(s.id, entry);
      }

      // Update position with float bobbing
      const bob = Math.sin(Date.now() * 0.008 + s.pos[0]) * 0.15;
      entry.group.position.set(s.pos[0], s.pos[1] + bob, s.pos[2]);

      // Visual state for stunned
      if (s.state === "stunned") {
        entry.eye.material = new THREE.MeshBasicMaterial({ color: 0x555577 });
        entry.aura.color.setHex(0x444466);
        entry.aura.intensity = 0.3;
      } else {
        entry.eye.material = new THREE.MeshBasicMaterial({ color: 0xcc22ff });
        entry.aura.color.setHex(0x8811cc);
        entry.aura.intensity = 1.0;
      }
    }

    for (const [id, entry] of this.shadeMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        this.shadeMeshes.delete(id);
      }
    }
  }

  updateCamera(playerPos: [number, number, number], camYawDeg: number, camPitchDeg: number): void {
    const yawRad = (camYawDeg * Math.PI) / 180.0;
    const pitchRad = (camPitchDeg * Math.PI) / 180.0;
    const dist = 7.5;
    const height = 3.5;

    // Orbit position around player
    const camX = playerPos[0] - Math.sin(yawRad) * Math.cos(pitchRad) * dist;
    const camZ = playerPos[2] - Math.cos(yawRad) * Math.cos(pitchRad) * dist;
    const camY = playerPos[1] + height + Math.sin(pitchRad) * dist;

    this.camera.position.set(camX, Math.max(0.5, camY), camZ);
    this.camera.lookAt(playerPos[0], playerPos[1] + 1.2, playerPos[2]);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    // Slowly rotate clouds
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += 0.0003;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
