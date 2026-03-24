import React, { useState } from 'react';

interface ControlPanelProps {
  onLoadModel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExpression: (expr: string) => void;
  onGesture: (gesture: string) => void;
  onSpeak: (text: string, lang: string) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onLoadModel, onExpression, onGesture, onSpeak }) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('vi-VN');

  return (
    <div className="control-panel glass-panel">
      <div className="panel-section">
        <h3>Tải Nhân Vật (VRM)</h3>
        <input type="file" accept=".vrm" onChange={onLoadModel} className="btn" />
      </div>

      <div className="panel-section">
        <h3>Cử Chỉ (Gestures)</h3>
        <div className="button-group">
          <button className="btn btn-primary" onClick={() => onGesture('wave')}>👋 Chào</button>
          <button className="btn btn-primary" onClick={() => onGesture('nod')}>👍 Gật Đầu</button>
          <button className="btn btn-primary" onClick={() => onGesture('dance')}>💃 Nhảy/Múa</button>
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
