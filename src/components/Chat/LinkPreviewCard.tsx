import React, { useEffect, useState } from 'react';
import { getLinkPreview, type LinkPreview } from '../../services/linkPreviewService';

/** WhatsApp-style preview of the first link in a message. */
export const LinkPreviewCard: React.FC<{ url: string }> = ({ url }) => {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void getLinkPreview(url).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!preview?.title) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block mb-1 -mx-[3px] -mt-[2px] rounded-md overflow-hidden bg-black/[0.05] dark:bg-black/20 max-w-[18rem]"
    >
      {preview.image && !imageFailed && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="w-full max-h-40 object-cover"
          draggable={false}
        />
      )}
      <div className="px-2.5 py-1.5">
        <p className="text-[13.5px] font-medium text-[#111b21] dark:text-[#e9edef] line-clamp-2 leading-snug">{preview.title}</p>
        {preview.description && (
          <p className="text-[12.5px] text-[#667781] dark:text-[#8696a0] line-clamp-2 leading-snug mt-0.5">{preview.description}</p>
        )}
        {preview.site && <p className="text-[12px] text-[#8696a0] mt-0.5 truncate">{preview.site}</p>}
      </div>
    </a>
  );
};
