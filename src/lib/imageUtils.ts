import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.8, // Maximum 800KB
    maxWidthOrHeight: 1200, // Maximum 1200px width/height
    useWebWorker: false, // Disabled due to Safari/iOS hanging issues
    fileType: 'image/webp' // Convert to WebP for better compression
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    // Calculate compression stats for logging
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const newSize = (compressedFile.size / 1024 / 1024).toFixed(2);
    
    console.log(`Image compressed: ${originalSize} MB -> ${newSize} MB`);
    
    // If the compressed size is larger, use original
    if (compressedFile.size > file.size) {
      return file;
    }
    
    // Return a new File object
    return new File([compressedFile], file.name.replace(/\.[^/.]+$/, ".webp"), {
      type: "image/webp",
    });
  } catch (error) {
    console.error("Error compressing image:", error);
    toast.error("حدث خطأ أثناء ضغط الصورة، سيتم رفعها بحجمها الأصلي.");
    return file; // Fallback to original file
  }
};
