import { useState, useEffect } from 'react';

export function useKeyboard() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const handleResize = () => {
      if (viewport.height < window.innerHeight * 0.8) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return { isKeyboardOpen: isOpen };
}
