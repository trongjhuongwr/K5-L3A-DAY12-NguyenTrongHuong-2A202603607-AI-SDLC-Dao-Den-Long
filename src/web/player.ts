import * as THREE from "three";

export class CharacterModel {
  public group: THREE.Group;
  public lanternLight: THREE.PointLight;
  public pulseRing: THREE.Mesh;
  private pulseAnimTime: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // Body (stylized tunic)
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.4, 0.9, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x224466,
      roughness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    this.group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdfc4,
      roughness: 0.6,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.15;
    this.group.add(head);

    // Conical hat (Nón lá)
    const hatGeo = new THREE.ConeGeometry(0.7, 0.28, 24, 1, true);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xd9ba82,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.35;
    this.group.add(hat);

    // Tiny hanging lantern from hat
    const miniLanternGroup = new THREE.Group();
    const miniLanternGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const miniLanternMat = new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: 0xff7700,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const miniLantern = new THREE.Mesh(miniLanternGeo, miniLanternMat);
    miniLanternGroup.add(miniLantern);
    miniLanternGroup.position.set(0.35, 1.1, 0.2);
    this.group.add(miniLanternGroup);

    // Lantern light source
    this.lanternLight = new THREE.PointLight(0xff9922, 1.5, 6.0);
    this.lanternLight.position.set(0.35, 1.1, 0.2);
    this.group.add(this.lanternLight);

    // Pulse shockwave effect ring (initially hidden)
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.pulseRing = new THREE.Mesh(ringGeo, ringMat);
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.position.y = 0.1;
    this.group.add(this.pulseRing);
  }

  triggerPulseEffect(): void {
    this.pulseAnimTime = 0.5; // 0.5 second animation
  }

  update(dt: number, isMoving: boolean): void {
    // Gentle bobbing / swaying
    if (isMoving) {
      this.group.position.y = Math.sin(Date.now() * 0.015) * 0.06;
    } else {
      this.group.position.y = Math.sin(Date.now() * 0.003) * 0.02;
    }

    // Pulse animation
    if (this.pulseAnimTime > 0) {
      this.pulseAnimTime -= dt;
      const progress = 1.0 - this.pulseAnimTime / 0.5;
      const scale = 1.0 + progress * 7.0; // expand up to 5 meters radius
      this.pulseRing.scale.set(scale, scale, 1);
      const ringMat = this.pulseRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, (1.0 - progress) * 0.8);
    } else {
      const ringMat = this.pulseRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0;
    }
  }
}
