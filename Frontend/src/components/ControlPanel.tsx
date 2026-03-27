import React, { useState } from 'react';

interface ControlPanelProps {
  onLoadModel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteModel: () => void;
  onExpression: (expr: string) => void;
  onGesture: (gesture: string) => void;
  onSpeak: (text: string, lang: string) => void;
  canDeleteModel: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadProgress: number;
  uploadMessage: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onLoadModel,
  onDeleteModel,
  onExpression,
  onGesture,
  onSpeak,
  canDeleteModel,
  uploadStatus,
  uploadProgress,
  uploadMessage,
}) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('vi-VN');
  const animationButtons: Array<{ key: string; label: string }> = [
    { key: 'Relax', label: '� Relax (Idle)' },
    { key: 'Goodbye', label: '👋 Goodbye (Chào)' },
    { key: 'Thinking', label: '🤔 Thinking' },
    { key: 'Clapping', label: '👏 Clapping' },
    { key: 'LookAround', label: '👀 LookAround' },
    { key: 'Jump', label: '🦘 Jump' },
    { key: 'Angry', label: '😠 Angry' },
    { key: 'Sad', label: '😢 Sad' },
    { key: 'Surprised', label: '😮 Surprised' },
    { key: 'Sleepy', label: '😴 Sleepy' },
    { key: 'Blush', label: '😊 Blush' },
  ];

  return (
    <div className="control-panel glass-panel">
      <div className="panel-section">
        <h3>Tải Nhân Vật (VRM)</h3>
        <input type="file" accept=".vrm" onChange={onLoadModel} className="btn" />
        <button
          className="btn btn-danger"
          onClick={onDeleteModel}
          disabled={!canDeleteModel}
          style={{ marginTop: '0.5rem', maxWidth: '220px' }}
        >
          Xóa model hiện tại
        </button>
        <p style={{ marginTop: '0.5rem', opacity: 0.8, fontSize: '0.85rem' }}>
          Mẹo: Bạn có thể Ctrl+V file .vrm trên trang để tự động tải lên backend.
        </p>
        {uploadStatus !== 'idle' && (
          <div className="upload-status-wrap">
            {uploadStatus === 'uploading' && (
              <div className="upload-progress-track">
                <div
                  className="upload-progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <p className={`upload-status-text ${uploadStatus}`}>{uploadMessage}</p>
          </div>
        )}
      </div>

      <div className="panel-section">
        <h3>Animation (VRMA)</h3>
        <div className="button-group">
          {animationButtons.map((item) => (
            <button
              key={item.key}
              className="btn btn-primary"
              onClick={() => onGesture(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>Cảm Xúc (Expressions)</h3>
        <div className="button-group">
          <button className="btn" onClick={() => onExpression('happy')}>😊 Chớp Nở nụ cười</button>
          <button className="btn" onClick={() => onExpression('relaxed')}>😌 Thư giãn</button>
          <button className="btn" onClick={() => onExpression('blink')}>😉 Nháy mắt</button>
          <button className="btn" onClick={() => onExpression('neutral')}>😐 Bình thường</button>
        </div>
      </div>

      <div className="panel-section">
        <h3>Trò Truyện & Khẩu Hình (Text-To-Speech)</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="radio" checked={language === 'vi-VN'} onChange={() => setLanguage('vi-VN')} />
            Tiếng Việt
          </label>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="radio" checked={language === 'en-US'} onChange={() => setLanguage('en-US')} />
            Tiếng Anh
          </label>
        </div>
        <div className="chat-input-group">
          <input 
            type="text" 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="Nhập chữ để nhân vật nói..." 
            className="chat-input"
            onKeyDown={(e) => { 
                if(e.key === 'Enter' && text.trim() !== '') { 
                    onSpeak(text, language); 
                    setText(''); 
                } 
            }}
          />
          <button 
            className="btn btn-primary send-btn" 
            onClick={() => { 
                if (text.trim() !== '') { 
                    onSpeak(text, language); 
                    setText(''); 
                }
            }}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
