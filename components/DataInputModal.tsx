
import React, { useState } from 'react';
import { Upload, X, ClipboardList, Loader2 } from 'lucide-react';

interface Props {
  title: string;
  placeholder: string;
  onImport: (text: string) => void | Promise<void>;
  onClose: () => void;
  /** 0–100 時顯示進度條，null 時隱藏 */
  importProgress?: number | null;
}

const DataInputModal: React.FC<Props> = ({ title, placeholder, onImport, onClose, importProgress = null }) => {
  const [text, setText] = useState('');
  const isImporting = importProgress !== null && importProgress !== undefined;

  const handleConfirm = async () => {
    if (!text.trim()) return;
    await onImport(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Upload size={24} />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
          <p className="text-sm text-slate-500">
            請從 Excel 或 Google Sheet 複製整列數據（包含標題列），直接貼上到下方區域。
          </p>
          <textarea
            className="flex-1 w-full p-4 font-mono text-sm border rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none disabled:opacity-70"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isImporting}
          />
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  正在匯入...
                </span>
                <span className="font-medium text-indigo-600">{Math.min(Math.round(importProgress), 100)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(importProgress, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-6 py-2 border rounded-xl hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isImporting || !text.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isImporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                匯入中...
              </>
            ) : (
              <>
                <ClipboardList size={18} />
                確認匯入
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataInputModal;
