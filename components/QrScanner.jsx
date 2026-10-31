'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

export default function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const elementId = 'qr-snacks-container';

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const qr = new Html5Qrcode(elementId);
        scannerRef.current = qr;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qr.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              if (navigator.vibrate) navigator.vibrate(50);
              onScan(decodedText);
            }
          },
          () => {}
        );

        if (!isMounted) {
          try {
            if (qr.isScanning) {
              await qr.stop();
            }
            qr.clear();
          } catch (e) {}
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Camera init error:', err);
        setError('Camera permission denied or camera not found. Please use manual team search.');
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const qr = scannerRef.current;
      if (qr) {
        try {
          if (qr.isScanning) {
            qr.stop()
              .then(() => {
                try { qr.clear(); } catch (e) {}
              })
              .catch(() => {});
          } else {
            try { qr.clear(); } catch (e) {}
          }
        } catch (e) {
          // Synchronous safety catch
        }
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="p-4 flex items-center justify-between border-b border-[#222222]">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-[#ff7a1a]" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Scan Team Pass</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs text-center">
              {error}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-black border border-[#333333]">
              <div id={elementId} className="w-full aspect-square" />
            </div>
          )}
          <p className="text-xs text-center text-neutral-400 mt-3">
            Aim camera at printed team QR pass (encodes Team Name)
          </p>
        </div>
      </div>
    </div>
  );
}

