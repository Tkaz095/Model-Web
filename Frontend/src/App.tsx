import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import VRMViewer, { type VRMViewerRef } from './components/VRMViewer';
import ControlPanel from './components/ControlPanel';
import { deleteVrmModelById, getLatestVrmModel, uploadVrmFile } from './services/modelApi';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function App() {
  const viewerRef = useRef<VRMViewerRef>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentModelId, setCurrentModelId] = useState<number | null>(null);
  const hasInitializedModelRef = useRef(false);

  const startUploadProgress = (): number => {
    setUploadStatus('uploading');
    setUploadProgress(5);
    setUploadMessage('Đang tải VRM lên backend...');

    return window.setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + Math.random() * 12, 95));
    }, 250);
  };

  const finishUploadProgress = (timerId: number) => {
    window.clearInterval(timerId);
    setUploadProgress(100);
    setUploadStatus('success');
    setUploadMessage('Tải lên thành công. Model đã được nạp từ backend.');
    window.setTimeout(() => {
      setUploadStatus('idle');
      setUploadProgress(0);
      setUploadMessage('');
    }, 2000);
  };

  const failUploadProgress = (timerId: number, message: string) => {
    window.clearInterval(timerId);
    setUploadStatus('error');
    setUploadMessage(message);
    setUploadProgress(0);
  };

  const getReadableErrorMessage = (error: unknown, fallbackMessage: string): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
      return `${fallbackMessage} (${error.message})`;
    }

    return fallbackMessage;
  };

  const loadVrmToViewer = async (file: File) => {
    const timerId = startUploadProgress();

    try {
      const uploadedModel = await uploadVrmFile(file);
      const cacheBustedUrl = `${uploadedModel.url}?t=${Date.now()}`;
      viewerRef.current?.loadVRM(cacheBustedUrl);
      setCurrentModelId(uploadedModel.id);
      finishUploadProgress(timerId);
    } catch (error) {
      failUploadProgress(timerId, getReadableErrorMessage(error, 'Không thể tải file VRM lên backend. Vui lòng kiểm tra backend.'));
      throw error;
    }
  };

  const handleDeleteCurrentModel = async () => {
    if (!currentModelId) {
      setUploadStatus('error');
      setUploadMessage('Không có model nào để xóa.');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(35);
    setUploadMessage('Đang xóa model khỏi backend...');

    try {
      await deleteVrmModelById(currentModelId);
      viewerRef.current?.clearVRM();
      setCurrentModelId(null);
      setUploadProgress(100);
      setUploadStatus('success');
      setUploadMessage('Đã xóa model khỏi backend và database.');
      window.setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setUploadMessage('');
      }, 1800);
    } catch (error) {
      console.error('Delete VRM failed:', error);
      setUploadStatus('error');
      setUploadProgress(0);
      setUploadMessage(getReadableErrorMessage(error, 'Xóa model thất bại. Vui lòng thử lại.'));
    }
  };

  const handleLoadModel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await loadVrmToViewer(file);
    } catch (error) {
      console.error('Upload VRM failed:', error);
    }
  };

  useEffect(() => {
    if (hasInitializedModelRef.current) {
      return;
    }

    hasInitializedModelRef.current = true;

    const loadLatestModelFromDatabase = async () => {
      setUploadStatus('uploading');
      setUploadProgress(20);
      setUploadMessage('Đang đọc dữ liệu model từ database...');

      try {
        const latestModel = await getLatestVrmModel();
        if (!latestModel) {
          setUploadStatus('idle');
          setUploadProgress(0);
          setUploadMessage('');
          return;
        }

        const cacheBustedUrl = `${latestModel.url}?t=${Date.now()}`;
        viewerRef.current?.loadVRM(cacheBustedUrl);
        setCurrentModelId(latestModel.id);
        setUploadProgress(100);
        setUploadStatus('success');
        setUploadMessage('Đã tự động nạp model gần nhất từ database.');
        window.setTimeout(() => {
          setUploadStatus('idle');
          setUploadProgress(0);
          setUploadMessage('');
        }, 1500);
      } catch (error) {
        console.error('Auto load model failed:', error);
        setUploadStatus('error');
        setUploadProgress(0);
        setUploadMessage(getReadableErrorMessage(error, 'Không thể đọc model từ database.'));
      }
    };

    void loadLatestModelFromDatabase();
  }, []);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items || items.length === 0) {
        return;
      }

      let pastedFile: File | null = null;
      for (const item of items) {
        const file = item.kind === 'file' ? item.getAsFile() : null;
        if (file && file.name.toLowerCase().endsWith('.vrm')) {
          pastedFile = file;
          break;
        }
      }

      if (!pastedFile) {
        return;
      }

      event.preventDefault();

      try {
        await loadVrmToViewer(pastedFile);
      } catch (error) {
        console.error('Paste upload VRM failed:', error);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

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
          onDeleteModel={handleDeleteCurrentModel}
          onExpression={handleExpression}
          onGesture={handleGesture}
          onSpeak={handleSpeak}
          canDeleteModel={Boolean(currentModelId) && uploadStatus !== 'uploading'}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
          uploadMessage={uploadMessage}
        />
      </div>
    </div>
  );
}

export default App;
