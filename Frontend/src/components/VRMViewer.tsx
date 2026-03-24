import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM, VRMHumanBoneName, VRMExpressionPresetName } from '@pixiv/three-vrm';

export interface VRMViewerRef {
  loadVRM: (fileUrl: string) => void;
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
  
  const stateRef = useRef({
    clock: new THREE.Clock(),
    isSpeaking: false,
    currentGesture: null as string | null,
    gestureTime: 0
  });

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
            if (vrmRef.current) {
              sceneRef.current.remove(vrmRef.current.scene);
              VRMUtils.deepDispose(vrmRef.current.scene);
            }
            
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.removeUnnecessaryJoints(gltf.scene);
            
            loadedVrm.scene.rotation.y = Math.PI; // Rotate to face camera
            sceneRef.current.add(loadedVrm.scene);
            vrmRef.current = loadedVrm;
            
            if (onLoaded) onLoaded();
          }
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => console.error(error)
      );
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
      // 'wave', 'nod' etc.
      stateRef.current.currentGesture = gesture;
      stateRef.current.gestureTime = 0;
    },
    speakText: (text: string) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      
      // Aggressive multi-lingual female voice finder
      // Google TTS usually provides excellent multi-lingual female voices.
      // Zira/HoaiMy are Windows defaults.
      let selectedVoice = voices.find(v => 
        v.name.includes('Google') && v.name.includes('Female') ||
        v.name.includes('HoaiMy') || 
        v.name.includes('Zira') || 
        v.name.toLowerCase().includes('female')
      );

      // Fallback to any Google voice (usually female) or the first available
      if (!selectedVoice) {
         selectedVoice = voices.find(v => v.name.includes('Google')) || voices[0];
      }

      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.pitch = 1.3; // Hardcode feminine pitch
      utterance.rate = 1.05; // Slightly faster for natural feel
      utterance.volume = 1;
      utterance.onstart = () => { stateRef.current.isSpeaking = true; };
      utterance.onend = () => { 
        stateRef.current.isSpeaking = false; 
        if (vrmRef.current) {
          vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Aa, 0);
        }
      };
      // Randomize pitch/rate for fun or keep defaults
      window.speechSynthesis.speak(utterance);
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
          // Simple random lip sync
          const mouthOpen = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
          // Smooth it slightly by interpolating or just setting
          vrmRef.current.expressionManager?.setValue(VRMExpressionPresetName.Aa, mouthOpen);
        }

        // ------ DEFAULT / IDLE ANIMATION ------
        const rightArm = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
        const leftArm = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const spine = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
        
        // Relax arms (A-pose)
        if (rightArm) rightArm.rotation.set(0, 0, -1.2);
        if (leftArm) leftArm.rotation.set(0, 0, 1.2);

        // Breathing 
        if (spine) {
            spine.rotation.set(Math.sin(stateRef.current.clock.elapsedTime * 2) * 0.02, 0, 0);
        }

        // Handle Gestures
        const gesture = stateRef.current.currentGesture;
        if (gesture) {
          stateRef.current.gestureTime += deltaTime;
          const t = stateRef.current.gestureTime;
          
          if (gesture === 'wave') {
            if (rightArm) {
              if (t < 2.0) {
                 // wave animation math: lift arm, and rotate back and forth
                 rightArm.rotation.z = Math.sin(t * 10) * 0.5 - 1.0; 
                 rightArm.rotation.x = 0.5;
              } else {
                 stateRef.current.currentGesture = null;
              }
            }
          } else if (gesture === 'nod') {
             const neck = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Neck);
             if (neck) {
                if (t < 1.0) {
                  neck.rotation.x = Math.sin(t * Math.PI * 2) * 0.2;
                } else {
                  neck.rotation.set(0,0,0);
                  stateRef.current.currentGesture = null;
                }
             }
          } else if (gesture === 'dance') {
             if (spine) {
                if (t < 3.0) {
                  // Core bounce
                  spine.rotation.z = Math.sin(t * 8) * 0.1;
                  spine.rotation.x = Math.sin(t * 4) * 0.1;
                  
                  // Arms swinging
                  if (rightArm) rightArm.rotation.z = Math.sin(t * 8) * 0.5 - 1.0;
                  if (leftArm) leftArm.rotation.z = Math.cos(t * 8) * 0.5 + 1.0;
                  
                  // Legs dancing
                  const leftUpperLeg = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
                  const rightUpperLeg = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
                  const leftLowerLeg = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerLeg);
                  const rightLowerLeg = vrmRef.current.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightLowerLeg);
                  
                  if (leftUpperLeg) leftUpperLeg.rotation.x = Math.sin(t * 8) * 0.2;
                  if (rightUpperLeg) rightUpperLeg.rotation.x = Math.cos(t * 8) * 0.2;
                  if (leftLowerLeg) leftLowerLeg.rotation.x = Math.abs(Math.sin(t * 8)) * -0.2;
                  if (rightLowerLeg) rightLowerLeg.rotation.x = Math.abs(Math.cos(t * 8)) * -0.2;
                } else {
                  stateRef.current.currentGesture = null;
                }
             }
          }
        }
        
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
