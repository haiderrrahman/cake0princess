import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface MapLinkProps {
  address: string;
  locationUrl: string;
  className?: string;
}

export default function MapLink({ address, locationUrl, className }: MapLinkProps) {
  const [showOptions, setShowOptions] = useState(false);

  const extractCoordinates = (url: string) => {
    // try to match lat, lng anywhere in the string
    const match = url.match(/([-+]?\d{1,2}\.\d+),\s*([-+]?\d{1,3}\.\d+)/);
    if (match) {
      return { lat: match[1], lng: match[2] };
    }
    return null;
  };

  const handleOpenMap = (type: 'google' | 'waze' | 'original', e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(false);
    
    if (type === 'original') {
      if (locationUrl && locationUrl.startsWith('http')) {
        window.open(locationUrl, '_blank');
      } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationUrl || address)}`, '_blank');
      }
      return;
    }

    const coords = extractCoordinates(locationUrl || address);
    if (coords) {
      if (type === 'google') {
        window.open(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`, '_blank');
      } else if (type === 'waze') {
        window.open(`https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`, '_blank');
      }
    } else {
      if (type === 'google') {
        if (locationUrl && locationUrl.includes('maps.app.goo.gl')) {
           window.open(locationUrl, '_blank');
        } else {
           window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        }
      } else if (type === 'waze') {
        window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowOptions(true);
  };

  return (
    <>
      <button 
        onClick={handleClick} 
        className={className || "text-[10px] font-bold text-blue-500 mt-0.5 flex items-center gap-1.5 line-clamp-1 hover:underline underline-offset-2 decoration-blue-200 cursor-pointer text-right text-left"}
        dir="rtl"
      >
        <MapPin className="w-3 h-3 flex-shrink-0" /> {address}
      </button>

      {showOptions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 text-center">اختر تطبيق الخرائط</h3>
            <div className="space-y-3">
              <button 
                onClick={(e) => handleOpenMap('waze', e)}
                className="w-full flex items-center justify-center gap-3 bg-[#33ccff] hover:bg-[#2bb4e3] text-white py-3 rounded-xl font-bold transition"
              >
                <Navigation className="w-5 h-5" />
                فتح باستخدام Waze
              </button>
              <button 
                onClick={(e) => handleOpenMap('google', e)}
                className="w-full flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-white py-3 rounded-xl font-bold transition"
              >
                <MapPin className="w-5 h-5 text-red-500" />
                فتح باستخدام Google Maps
              </button>
              <button 
                onClick={(e) => handleOpenMap('original', e)}
                className="w-full text-center text-xs text-gray-500 dark:text-gray-400 py-2 hover:underline"
              >
                فتح الرابط الأصلي
              </button>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}
              className="mt-4 w-full py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}
