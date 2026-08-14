const fs = require('fs');
let content = fs.readFileSync('src/app/admin/hub/page.tsx', 'utf-8');

// The widget is around line 1052
// <div key={i.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col">
// Add an edit button inside this div.

content = content.replace(
  '<div key={i.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col">',
  `<div key={i.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col relative">
    <button onClick={() => setShowEditInventory(i)} className="absolute top-1.5 left-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition shadow-sm border border-gray-200">
      <Edit3 className="w-3 h-3" />
    </button>`
);

// We need to make sure Edit3 is imported.
if (!content.includes('Edit3')) {
  content = content.replace(
    'ArrowRight, Plus, RefreshCw, AlertTriangle, Search, Package, Image as ImageIcon, Video, UploadCloud, ChevronDown, Check, Filter, CalendarDays, ExternalLink, MessageCircle',
    'ArrowRight, Plus, RefreshCw, AlertTriangle, Search, Package, Image as ImageIcon, Video, UploadCloud, ChevronDown, Check, Filter, CalendarDays, ExternalLink, MessageCircle, Edit3'
  );
}

fs.writeFileSync('src/app/admin/hub/page.tsx', content);
