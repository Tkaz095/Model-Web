import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { sendToSpeak } from '../services/speakApi';
import { AnimationManager } from './AnimationManager';

export interface VRMViewerRef {
  loadVRM: (fileUrl: string) => void;
  clearVRM: () => void;
  triggerExpression: (expression: string) => void;
  triggerGesture: (gesture: string) => void;
  speakText: (text: string, lang: string) => void;
}

interface VRMViewerProps {
  onLoaded?: () => void;
}

const VRMViewer = forwardRef<VRMViewerRef, VRMViewerProps>(({ onLoaded }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const sceneRef = useRef(new THREE.Scene());
  const vrmRef = useRef<VRM | null>(null);
  const animationManagerRef = useRef(new AnimationManager());
  const audioListenerRef = useRef<THREE.AudioListener | null>(null);
  const voiceAudioRef = useRef<THREE.Audio | null>(null);
  const audioAnalyserRef = useRef<THREE.AudioAnalyser | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const stateRef = useRef({
    clock: new THREE.Clock(),
    isSpeaking: false,
    mouthOpen: 0,
  });

  const closeMouth = () => {
    stateRef.current.isSpeaking = false;
    stateRef.current.mouthOpen = 0;
    if (vrmRef.current?.expressionManager) {
      vrmRef.current.expressionManager.setValue('aa', 0);
    }
  };

  const clearCurrentVrm = () => {
    if (!vrmRef.current) {
      return;
    }

    animationManagerRef.current.clear();
    sceneRef.current.remove(vrmRef.current.scene);
    VRMUtils.deepDispose(vrmRef.current.scene);
    vrmRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    loadVRM: (fileUrl: string) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      
      loader.load(
        fileUrl,
        (gltf) => {
          const loadedVrm = gltf.userData.vrm;
          if (loadedVrm) {
            // Remove the old VRM if exists
            clearCurrentVrm();
            
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.removeUnnecessaryJoints(gltf.scene);
            
            loadedVrm.scene.rotation.y = Math.PI; // Rotate to face camera
            sceneRef.current.add(loadedVrm.scene);
            vrmRef.current = loadedVrm;
            animationManagerRef.current.setVrm(loadedVrm);
            
            if (onLoaded) onLoaded();
          }
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => console.error(error)
      );
    },
    clearVRM: () => {
      clearCurrentVrm();
    },
    triggerExpression: (expression: string) => {
      if (!vrmRef.current) return;
      // Reset defaults
      vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Happy, 0);
      vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Angry, 0);
      vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Sad, 0);
      vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Relaxed, 0);
      vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Blink, 0);
      
      if (expression !== 'neutral') {
        vrmRef.current.expressionManager?.setValue(expression, 1.0);
      }
    },
    triggerGesture: (gesture: string) => {
      animationManagerRef.current.playGesture(gesture);
    },
    speakText: async (text: string, lang: string) => {
      if (!text.trim()) return;

      try {
        const audioBuffer = await sendToSpeak(text, lang);
        const listener = audioListenerRef.current;
        const voiceAudio = voiceAudioRef.current;
        if (!listener || !voiceAudio) return;

        // Required on many browsers after user interaction.
        if (listener.context.state === 'suspended') {
          await listener.context.resume();
        }

        if (voiceAudio.isPlaying) {
          voiceAudio.stop();
        }

        if (htmlAudioRef.current) {
          htmlAudioRef.current.pause();
          htmlAudioRef.current = null;
        }

        stateRef.current.isSpeaking = true;

        try {
          const decodedBuffer = await listener.context.decodeAudioData(audioBuffer.slice(0));
          voiceAudio.setBuffer(decodedBuffer);
          voiceAudio.setLoop(false);
          voiceAudio.setVolume(1.0);
          voiceAudio.play();

          if (voiceAudio.source) {
            voiceAudio.source.onended = () => {
              closeMouth();
            };
          }
          return;
        } catch (_decodeError) {
          // Fallback path for browsers/codecs where decodeAudioData fails.
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const objectUrl = URL.createObjectURL(blob);
          const htmlAudio = new Audio(objectUrl);
          htmlAudioRef.current = htmlAudio;
          htmlAudio.onended = () => {
            URL.revokeObjectURL(objectUrl);
            htmlAudioRef.current = null;
            closeMouth();
          };
          await htmlAudio.play();
          return;
        }
      } catch (error) {
        console.error('Failed to speak text:', error);
        closeMouth();
      }
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const currentContainer = containerRef.current;

    const width = currentContainer.clientWidth;
    const height = currentContainer.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentContainer.appendChild(renderer.domElement);

    // Camera
    const camera = new THREE.PerspectiveCamera(30.0, width / height, 0.1, 20.0);
    camera.position.set(0.0, 1.4, 3.0);

    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    audioListenerRef.current = audioListener;

    const voiceAudio = new THREE.Audio(audioListener);
    voiceAudioRef.current = voiceAudio;
    audioAnalyserRef.current = new THREE.AudioAnalyser(voiceAudio, 64);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    sceneRef.current.add(light);
    
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const deltaTime = stateRef.current.clock.getDelta();
      
      if (vrmRef.current) {
        // Handle Lip Sync if speaking
        if (stateRef.current.isSpeaking) {
          const analyser = audioAnalyserRef.current;
          const averageFrequency = analyser ? analyser.getAverageFrequency() : 0;
          const normalizedVolume = THREE.MathUtils.clamp(averageFrequency / 90, 0, 1);
          stateRef.current.mouthOpen = THREE.MathUtils.lerp(stateRef.current.mouthOpen, normalizedVolume, 0.45);
          vrmRef.current.expressionManager?.setValue('aa', stateRef.current.mouthOpen);
        } else if (stateRef.current.mouthOpen > 0) {
          stateRef.current.mouthOpen = THREE.MathUtils.lerp(stateRef.current.mouthOpen, 0, 0.35);
          if (stateRef.current.mouthOpen < 0.01) {
            stateRef.current.mouthOpen = 0;
          }
          vrmRef.current.expressionManager?.setValue('aa', stateRef.current.mouthOpen);
        }

        animationManagerRef.current.update(stateRef.current.clock.elapsedTime);
        
        // Update VRM
        vrmRef.current.update(deltaTime);
      }
      
      renderer.render(sceneRef.current, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentContainer) return;
      const w = currentContainer.clientWidth;
      const h = currentContainer.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      if (voiceAudioRef.current?.isPlaying) {
        voiceAudioRef.current.stop();
      }
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current = null;
      }
      audioAnalyserRef.current = null;
      voiceAudioRef.current = null;
      audioListenerRef.current = null;
      animationManagerRef.current.dispose();

      if (currentContainer) {
        currentContainer.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }} 
    />
  );
});

export default VRMViewer;
