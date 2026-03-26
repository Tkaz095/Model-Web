import * as THREE from 'three';
import { gsap } from 'gsap';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

type GestureName = 'wave' | 'nod' | 'dance';

interface VrmBones {
  rightUpperArm: THREE.Object3D | null;
  rightLowerArm: THREE.Object3D | null;
  rightHand: THREE.Object3D | null;
  leftUpperArm: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  neck: THREE.Object3D | null;
}

export class AnimationManager {
  private vrm: VRM | null = null;
  private activeTimeline: gsap.core.Timeline | null = null;
  private gestureRunning = false;

  setVrm(vrm: VRM | null): void {
    this.stopGesture();
    this.vrm = vrm;
  }

  clear(): void {
    this.stopGesture();
    this.vrm = null;
  }

  playGesture(gesture: string): void {
    if (!this.vrm) {
      return;
    }

    const normalized = gesture.toLowerCase() as GestureName;
    switch (normalized) {
      case 'wave':
        this.playWave();
        return;
      case 'nod':
        this.playNod();
        return;
      case 'dance':
        this.playDance();
        return;
      default:
        return;
    }
  }

  update(elapsedTime: number): void {
    if (!this.vrm) {
      return;
    }

    const bones = this.getBones();

    // Keep a stable idle pose when no gesture is running.
    if (!this.gestureRunning) {
      if (bones.rightUpperArm) {
        bones.rightUpperArm.rotation.x = THREE.MathUtils.lerp(bones.rightUpperArm.rotation.x, 0, 0.14);
        bones.rightUpperArm.rotation.y = THREE.MathUtils.lerp(bones.rightUpperArm.rotation.y, 0, 0.14);
        bones.rightUpperArm.rotation.z = THREE.MathUtils.lerp(bones.rightUpperArm.rotation.z, -1.2, 0.14);
      }

      if (bones.leftUpperArm) {
        bones.leftUpperArm.rotation.x = THREE.MathUtils.lerp(bones.leftUpperArm.rotation.x, 0, 0.14);
        bones.leftUpperArm.rotation.y = THREE.MathUtils.lerp(bones.leftUpperArm.rotation.y, 0, 0.14);
        bones.leftUpperArm.rotation.z = THREE.MathUtils.lerp(bones.leftUpperArm.rotation.z, 1.2, 0.14);
      }

      if (bones.spine) {
        const idleBreath = Math.sin(elapsedTime * 2.0) * 0.02;
        bones.spine.rotation.x = THREE.MathUtils.lerp(bones.spine.rotation.x, idleBreath, 0.12);
      }

      if (bones.neck) {
        bones.neck.rotation.x = THREE.MathUtils.lerp(bones.neck.rotation.x, 0, 0.18);
      }
    }
  }

  dispose(): void {
    this.stopGesture();
    this.vrm = null;
  }

  private stopGesture(): void {
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
    }
    this.gestureRunning = false;
  }

  private getBones(): VrmBones {
    const getBoneNode = (boneName: VRMHumanBoneName): THREE.Object3D | null => {
      const normalizedBone = this.vrm?.humanoid?.getNormalizedBoneNode(boneName) || null;
      if (normalizedBone) {
        return normalizedBone;
      }

      return this.vrm?.humanoid?.getRawBoneNode(boneName) || null;
    };

    return {
      rightUpperArm: getBoneNode(VRMHumanBoneName.RightUpperArm),
      rightLowerArm: getBoneNode(VRMHumanBoneName.RightLowerArm),
      rightHand: getBoneNode(VRMHumanBoneName.RightHand),
      leftUpperArm: getBoneNode(VRMHumanBoneName.LeftUpperArm),
      spine: getBoneNode(VRMHumanBoneName.Spine),
      neck: getBoneNode(VRMHumanBoneName.Neck),
    };
  }

  private playWave(): void {
    const bones = this.getBones();
    const mainWaveBone = bones.rightUpperArm || bones.rightLowerArm || bones.rightHand;
    if (!mainWaveBone) {
      return;
    }

    this.stopGesture();
    this.gestureRunning = true;

    const tl = gsap.timeline({
      defaults: { overwrite: true },
      onComplete: () => {
        this.gestureRunning = false;
        this.activeTimeline = null;
      },
    });

    // Raise arm high (~120deg-like pose) then wave widely.
    tl.to(mainWaveBone.rotation, {
      x: -0.35,
      y: 0.0,
      z: -2.1,
      duration: 0.4,
      ease: 'power3.out',
    }, 0);

    if (bones.rightLowerArm) {
      tl.to(bones.rightLowerArm.rotation, {
        z: -0.85,
        duration: 0.35,
        ease: 'power2.out',
      }, 0);
    }

    // Light spring/bounce on the torso for natural motion.
    if (bones.spine) {
      tl.to(bones.spine.rotation, {
        x: 0.12,
        duration: 0.22,
        ease: 'power2.out',
        yoyo: true,
        repeat: 3,
      }, 0.12);
    }

    // Wide waving arc, around 120deg total swing.
    tl.to(mainWaveBone.rotation, {
      z: -0.2,
      duration: 0.17,
      ease: 'sine.inOut',
      repeat: 7,
      yoyo: true,
    }, 0.45);

    // Return to idle stance automatically.
    tl.to(mainWaveBone.rotation, {
      x: 0,
      y: 0,
      z: -1.2,
      duration: 0.45,
      ease: 'power2.out',
    }, '>-0.05');

    if (bones.rightLowerArm) {
      tl.to(bones.rightLowerArm.rotation, {
        z: 0,
        duration: 0.35,
        ease: 'power2.out',
      }, '<');
    }

    if (bones.spine) {
      tl.to(bones.spine.rotation, {
        x: 0,
        duration: 0.3,
        ease: 'power2.out',
      }, '<');
    }

    this.activeTimeline = tl;
  }

  private playNod(): void {
    const bones = this.getBones();
    if (!bones.neck) {
      return;
    }

    this.stopGesture();
    this.gestureRunning = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.gestureRunning = false;
        this.activeTimeline = null;
      },
    });

    tl.to(bones.neck.rotation, {
      x: 0.26,
      duration: 0.18,
      ease: 'power2.out',
      yoyo: true,
      repeat: 3,
    });

    tl.to(bones.neck.rotation, {
      x: 0,
      duration: 0.2,
      ease: 'power2.out',
    });

    this.activeTimeline = tl;
  }

  private playDance(): void {
    const bones = this.getBones();
    if (!bones.spine || !bones.rightUpperArm || !bones.leftUpperArm) {
      return;
    }

    this.stopGesture();
    this.gestureRunning = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.gestureRunning = false;
        this.activeTimeline = null;
      },
    });

    tl.to(bones.spine.rotation, {
      z: 0.14,
      x: 0.08,
      duration: 0.18,
      yoyo: true,
      repeat: 9,
      ease: 'sine.inOut',
    }, 0);

    tl.to(bones.rightUpperArm.rotation, {
      z: -0.55,
      duration: 0.18,
      yoyo: true,
      repeat: 9,
      ease: 'sine.inOut',
    }, 0);

    tl.to(bones.leftUpperArm.rotation, {
      z: 0.55,
      duration: 0.18,
      yoyo: true,
      repeat: 9,
      ease: 'sine.inOut',
    }, 0);

    tl.to(bones.rightUpperArm.rotation, {
      z: -1.2,
      duration: 0.35,
      ease: 'power2.out',
    });

    tl.to(bones.leftUpperArm.rotation, {
      z: 1.2,
      duration: 0.35,
      ease: 'power2.out',
    }, '<');

    tl.to(bones.spine.rotation, {
      x: 0,
      z: 0,
      duration: 0.3,
      ease: 'power2.out',
    }, '<');

    this.activeTimeline = tl;
  }
}
