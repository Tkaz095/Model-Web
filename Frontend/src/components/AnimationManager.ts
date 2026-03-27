import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

type GestureName = 'wave' | 'nod' | 'dance';

export class AnimationManager {
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private currentAnimationName: string | null = null;
  private clipCache = new Map<string, THREE.AnimationClip>();
  private loadingCache = new Map<string, Promise<THREE.AnimationClip | null>>();

  private readonly animationUrls: Record<string, string> = {
    Idle: '/animations/Idle.vrma',
    Angry: '/animations/Angry.vrma',
    Blush: '/animations/Blush.vrma',
    Clapping: '/animations/Clapping.vrma',
    Goodbye: '/animations/Goodbye.vrma',
    Jump: '/animations/Jump.vrma',
    LookAround: '/animations/LookAround.vrma',
    Relax: '/animations/Relax.vrma',
    Sad: '/animations/Sad.vrma',
    Sleepy: '/animations/Sleepy.vrma',
    Surprised: '/animations/Surprised.vrma',
    Thinking: '/animations/Thinking.vrma',
  };

  setVrm(vrm: VRM | null): void {
    this.stopAll();
    this.vrm = vrm;
    this.mixer = vrm ? new THREE.AnimationMixer(vrm.scene) : null;
    this.clipCache.clear();
    this.loadingCache.clear();

    // Start from idle when possible.
    if (vrm) {
      void this.play('Relax');
    }
  }

  clear(): void {
    this.stopAll();
    this.vrm = null;
    this.mixer = null;
    this.currentAction = null;
    this.currentAnimationName = null;
    this.clipCache.clear();
    this.loadingCache.clear();
  }

  playGesture(gesture: string): void {
    const normalized = gesture.trim().toLowerCase() as GestureName | string;

    // Backward-compatible aliases from old gesture buttons.
    if (normalized === 'wave') {
      void this.play('Goodbye');
      return;
    }
    if (normalized === 'nod') {
      void this.play('Thinking');
      return;
    }
    if (normalized === 'dance') {
      void this.play('Clapping');
      return;
    }

    // New direct menu keys (matching file names in public/animations).
    const exactKey = Object.keys(this.animationUrls).find(
      (name) => name.toLowerCase() === normalized
    );

    if (exactKey) {
      void this.play(exactKey);
    }
  }

  async loadVRMA(url: string, animationName?: string): Promise<THREE.AnimationClip | null> {
    if (!this.vrm) {
      return null;
    }

    const cacheKey = animationName ?? url;
    const cached = this.clipCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const loading = this.loadingCache.get(cacheKey);
    if (loading) {
      return loading;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    const request = new Promise<THREE.AnimationClip | null>((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const vrmAnimations = (gltf.userData.vrmAnimations ?? []) as unknown[];
          const vrmAnimation = vrmAnimations[0];
          if (!vrmAnimation || !this.vrm) {
            resolve(null);
            return;
          }

          const clip = createVRMAnimationClip(vrmAnimation as never, this.vrm);
          clip.name = cacheKey;
          this.clipCache.set(cacheKey, clip);
          resolve(clip);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load VRMA: ${url}`, error);
          resolve(null);
        }
      );
    }).finally(() => {
      this.loadingCache.delete(cacheKey);
    });

    this.loadingCache.set(cacheKey, request);
    return request;
  }

  async play(animationName: string): Promise<void> {
    if (!this.vrm || !this.mixer) {
      return;
    }

    const url = this.animationUrls[animationName] ?? `/animations/${animationName}.vrma`;
    const clip = await this.loadVRMA(url, animationName);
    if (!clip || !this.mixer) {
      return;
    }

    const nextAction = this.mixer.clipAction(clip);
    const isIdle = animationName === 'Relax';

    nextAction.enabled = true;
    nextAction.setLoop(isIdle ? THREE.LoopRepeat : THREE.LoopOnce, isIdle ? Infinity : 1);
    nextAction.clampWhenFinished = !isIdle;
    nextAction.reset();

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.crossFadeTo(nextAction, 0.28, true);
    } else {
      nextAction.fadeIn(0.28);
    }

    nextAction.play();
    this.currentAction = nextAction;
    this.currentAnimationName = animationName;

    if (!isIdle) {
      const onFinished = (event: { action?: THREE.AnimationAction }) => {
        if (event.action !== nextAction || !this.mixer) {
          return;
        }
        this.mixer.removeEventListener('finished', onFinished);
        if (this.currentAnimationName === animationName) {
          void this.play('Relax');
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }

  update(deltaTime: number): void {
    if (!this.mixer) {
      return;
    }
    this.mixer.update(deltaTime);
  }

  dispose(): void {
    this.stopAll();
    this.vrm = null;
    this.mixer = null;
    this.currentAction = null;
    this.currentAnimationName = null;
    this.clipCache.clear();
    this.loadingCache.clear();
  }

  private stopAll(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }
}
