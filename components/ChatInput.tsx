import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, Video, Mic } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((text.trim() || attachments.length > 0) && !disabled) {
      onSend(text, attachments);
      setText('');
      setAttachments([]);
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Extract base64 part for API (remove "data:image/png;base64,")
        const base64Data = result.split(',')[1];
        
        let type: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type.startsWith('audio/')) type = 'audio';

        const newAttachment: Attachment = {
          type,
          mimeType: file.type,
          url: result, // Full data URI for preview
          base64Data: base64Data
        };

        setAttachments(prev => [...prev, newAttachment]);
      };

      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  return (
    <div className="p-4 bg-white border-t border-slate-100">
      
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {attachments.map((att, index) => (
            <div key={index} className="relative group flex-shrink-0">
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                {att.type === 'image' && <img src={att.url} className="w-full h-full object-cover" alt="preview" />}
                {att.type === 'video' && <Video className="text-slate-400" />}
                {att.type === 'audio' && <Mic className="text-slate-400" />}
              </div>
              <button 
                onClick={() => removeAttachment(index)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto relative flex items-end gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
        
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
        />

        <button 
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar Imagen, Video o Audio"
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe o sube un video/audio..."
          disabled={disabled}
          className="w-full bg-transparent border-none focus:ring-0 resize-none py-2 text-sm max-h-[120px] overflow-y-auto placeholder:text-slate-400 text-slate-700"
          rows={1}
        />

        <button
          onClick={() => handleSubmit()}
          disabled={(!text.trim() && attachments.length === 0) || disabled}
          className={`p-2 rounded-lg transition-all ${
            (text.trim() || attachments.length > 0) && !disabled
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Send size={18} />
        </button>
      </div>
      <div className="text-center mt-2">
        <p className="text-[10px] text-slate-400">
          Soporta Imagen, Audio y Video (multimodal). Verifica la información importante.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;