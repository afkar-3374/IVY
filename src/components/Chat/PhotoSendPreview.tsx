import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, SendHorizontal, Plus } from 'lucide-react';

interface PhotoSendPreviewProps {
  files: File[];
  recipientName: string;
  onAddMore: () => void;
  onRemove: (index: number) => void;
  onCancel: () => void;
  onSend: (files: File[], caption: string) => void;
}

/** WhatsApp-style preview before sending photos, with a caption. */
export const PhotoSendPreview: React.FC<PhotoSendPreviewProps> = ({ files, recipientName, onAddMore, onRemove, onCancel, onSend }) => {
  const [active, setActive] = useState(0);
  const [caption, setCaption] = useState('');
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  useEffect(() => {
    if (active >= files.length) setActive(Math.max(0, files.length - 1));
  }, [files.length, active]);
  useEffect(() => {
    if (files.length === 0) setCaption('');
  }, [files.length]);

  return (
    <AnimatePresence>
      {files.length > 0 && (
        <motion.div
          className="fixed inset-0 z-[60] bg-[#0b141a] flex flex-col"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-center justify-between px-2 pt-[max(env(safe-area-inset-top),8px)] pb-2">
            <button onClick={onCancel} className="p-2.5 rounded-full text-white/90 hover:bg-white/10" aria-label="Cancel">
              <X className="w-6 h-6" />
            </button>
            {files.length > 1 && (
              <button onClick={() => onRemove(active)} className="px-3 py-1.5 rounded-full text-sm text-white/80 hover:bg-white/10">
                Remove this photo
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-2">
            {urls[active] && <img src={urls[active]} alt="" className="max-w-full max-h-full object-contain rounded-sm" />}
          </div>

          <div className="pb-[max(env(safe-area-inset-bottom),10px)] pt-2 px-2 flex flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto px-1 pb-1">
              {urls.map((u, i) => (
                <button
                  key={u}
                  onClick={() => setActive(i)}
                  className={`w-14 h-14 flex-shrink-0 rounded-md overflow-hidden border-2 ${i === active ? 'border-[#E05A74]' : 'border-transparent opacity-70'}`}
                >
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                onClick={onAddMore}
                className="w-14 h-14 flex-shrink-0 rounded-md border-2 border-dashed border-white/30 text-white/70 flex items-center justify-center"
                aria-label="Add more photos"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0 rounded-[24px] bg-[#2a3942] px-4">
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSend(files, caption.trim())}
                  placeholder="Add a caption…"
                  maxLength={1000}
                  className="w-full bg-transparent text-[16px] text-[#e9edef] placeholder:text-[#8696a0] py-3 focus:outline-none"
                />
              </div>
              <button
                onClick={() => onSend(files, caption.trim())}
                className="w-12 h-12 rounded-full bg-[#E05A74] text-white flex items-center justify-center flex-shrink-0"
                aria-label={`Send to ${recipientName}`}
              >
                <SendHorizontal className="w-[22px] h-[22px] ml-0.5" />
              </button>
            </div>
            <p className="text-[12px] text-[#8696a0] px-2">{files.length} photo{files.length > 1 ? 's' : ''} · to {recipientName}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
