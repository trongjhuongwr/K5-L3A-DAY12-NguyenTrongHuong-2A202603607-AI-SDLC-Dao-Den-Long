import * as THREE from "three";

export class CharacterModel {
  public group: THREE.Group;
  public modelRoot: THREE.Group;
  public lanternLight: THREE.PointLight;
  public pulseRing: THREE.Mesh;
  public leftLeg: THREE.Mesh;
  public rightLeg: THREE.Mesh;
  public leftArm: THREE.Mesh;
  public rightArm: THREE.Mesh;
  private pulseAnimTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.group.add(this.modelRoot);

    // Body (Áo Mây: #E8E2D0)
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.85, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe8e2d0,
      roughness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    this.modelRoot.add(body);

    // Red scarf (Khăn Mây: #C8102E)
    const scarfGeo = new THREE.TorusGeometry(0.24, 0.08, 8, 16);
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0xc8102e,
      roughness: 0.6,
    });
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.05;
    this.modelRoot.add(scarf);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdfc4,
      roughness: 0.6,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    this.modelRoot.add(head);

    // Conical hat (Nón lá: #D9BA82)
    const hatGeo = new THREE.ConeGeometry(0.72, 0.3, 24, 1, true);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xd9ba82,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.48;
    this.modelRoot.add(hat);

    // Tiny hanging lantern from hat
    const miniLanternGroup = new THREE.Group();
    const miniLanternGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const miniLanternMat = new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xffe9b0,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const miniLantern = new THREE.Mesh(miniLanternGeo, miniLanternMat);
    miniLanternGroup.add(miniLantern);
    miniLanternGroup.position.set(0.38, 1.2, 0.22);
    this.modelRoot.add(miniLanternGroup);

    // Lantern light source (Warm, wide radius around Mây)
    this.lanternLight = new THREE.PointLight(0xffbe55, 2.5, 14.0);
    this.lanternLight.position.set(0.38, 1.2, 0.22);
    this.modelRoot.add(this.lanternLight);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.8 });

    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.14, 0.22, 0);
    this.modelRoot.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.14, 0.22, 0);
    this.modelRoot.add(this.rightLeg);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.8 });

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.32, 0.75, 0);
    this.modelRoot.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.32, 0.75, 0);
    this.modelRoot.add(this.rightArm);

    // Pulse shockwave effect ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf2c14e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.pulseRing = new THREE.Mesh(ringGeo, ringMat);
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.position.y = 0.05;
    this.group.add(this.pulseRing);
  }

  triggerPulseEffect(): void {
    this.pulseAnimTime = 0.5;
  }

  update(dt: number, isMoving: boolean, isGrounded: boolean): void {
    // Leg/arm walking swing animation
    if (isMoving && isGrounded) {
      const walkTime = Date.now() * 0.012;
      const swing = Math.sin(walkTime) * 0.55;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;

      // Gentle vertical bobbing applied to modelRoot ONLY
      this.modelRoot.position.y = Math.abs(Math.sin(walkTime)) * 0.08;
    } else if (!isGrounded) {
      // In the air (jump or fall pose)
      this.leftLeg.rotation.x = 0.4;
      this.rightLeg.rotation.x = -0.3;
      this.leftArm.rotation.x = -0.5;
      this.rightArm.rotation.x = -0.5;
      this.modelRoot.position.y = 0;
    } else {
      // Idle pose
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.modelRoot.position.y = Math.sin(Date.now() * 0.003) * 0.02;
    }

    // Pulse wave expanding animation
    if (this.pulseAnimTime > 0) {
      this.pulseAnimTime -= dt;
      const progress = 1.0 - this.pulseAnimTime / 0.5;
      const scale = 1.0 + progress * 7.0;
      this.pulseRing.scale.set(scale, scale, 1);
      const ringMat = this.pulseRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, (1.0 - progress) * 0.85);
    } else {
      const ringMat = this.pulseRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0;
    }
  }
}
