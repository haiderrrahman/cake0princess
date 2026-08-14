export async function processDownloadOrShare(dataUrl: string, filename: string, action: "share" | "download") {
  // iOS detection for PWA issues where standard downloads fail
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if ((action === "share" || isIOS) && navigator.share) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: blob.type });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        if (action === "download" && isIOS) {
          alert("لأجهزة الآيفون: يرجى النقر على زر 'حفظ الصورة' (Save Image) من القائمة التالية لحفظها في الاستوديو.");
        }
        await navigator.share({
          files: [file],
          title: 'صورة معدلة',
        });
        return;
      } else if (action === "share") {
        alert("متصفحك لا يدعم مشاركة الملفات مباشرة، سيتم تحميلها بدلاً من ذلك.");
      }
    } catch (err) {
      console.error(err);
      // User probably cancelled the share sheet, return early
      return;
    }
  }

  // Fallback to regular download for Desktop/Android or if share failed
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function processMultipleDownloadOrShare(files: File[], zipFilename: string, action: "share" | "download") {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if ((action === "share" || isIOS) && navigator.share) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        if (action === "download" && isIOS) {
          alert(`لأجهزة الآيفون: يرجى النقر على زر 'حفظ ${files.length} صور' (Save ${files.length} Images) لحفظها دفعة واحدة في الاستوديو.`);
        }
        await navigator.share({
          files,
          title: 'مجموعة صور',
        });
        return;
      } catch (err) {
        console.error(err);
        return;
      }
    } else if (action === "share") {
      alert("متصفحك لا يدعم مشاركة عدة ملفات دفعة واحدة، سيتم تحميلها كملف مضغوط (ZIP).");
    }
  }

  // Fallback to ZIP download
  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    files.forEach(f => {
      zip.file(f.name, f);
    });
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.download = zipFilename;
    link.href = URL.createObjectURL(content);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Failed to generate ZIP", error);
    alert("حدث خطأ أثناء تجميع الصور.");
  }
}
