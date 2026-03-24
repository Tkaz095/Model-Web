import React, { useRef } from 'react';
import './App.css';
import VRMViewer, { type VRMViewerRef } from './components/VRMViewer';
import ControlPanel from './components/ControlPanel';

function App() {
  const viewerRef = useRef<VRMViewerRef>(null);

  const handleLoadModel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && viewerRef.current) {
      const url = URL.createObjectURL(file);
      viewerRef.current.loadVRM(url);
    }
  };

  const handleExpression = (expr: string) => {
    viewerRef.current?.triggerExpression(expr);
  };

  const handleGesture = (gesture: string) => {
    viewerRef.current?.triggerGesture(gesture);
  };

  const handleSpeak = (text: string, lang: string) => {
    viewerRef.current?.speakText(text, lang);
  };

  return (
    <div className="app-container">
      <div className="canvas-container">
        <VRMViewer ref={viewerRef} />
      </div>
      
      <div className="ui-layer">
        <ControlPanel 
          onLoadModel={handleLoadModel}
          onExpression={handleExpression}
          onGesture={handleGesture}
          onSpeak={handleSpeak}
        />
      </div>
    </div>
  );
}

export default App;
