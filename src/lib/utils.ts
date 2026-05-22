import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resizes and compresses an image file in the browser before sending to the server.
 * This guarantees staying far below Vercel's 4.5MB serverless body payload limit
 * and dramatically decreases upload time, while keeping excellent quality for Gemini OCR.
 */
export function resizeImage(file: File, maxWidth = 1200, maxHeight = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calculate dynamic dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with 0.82 quality to dramatically reduce size with minimal perceptual degradation
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        reject(new Error("Error al procesar la imagen seleccionada."));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error("Error al leer el archivo de imagen."));
    };
    reader.readAsDataURL(file);
  });
}

