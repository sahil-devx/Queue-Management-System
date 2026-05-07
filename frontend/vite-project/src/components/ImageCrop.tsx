import { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  aspect?: number;
}

export default function ImageCrop({ imageSrc, onCropComplete, onCancel, aspect = 1 }: ImageCropProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateCroppedImage = useCallback(() => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, 'image/jpeg', 0.95);
  }, [completedCrop, onCropComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Crop Profile Picture</h3>
        
        <div className="mb-4 max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="max-w-full h-auto"
              onLoad={() => {
                if (imgRef.current) {
                  const { width, height } = imgRef.current;
                  const size = Math.min(width, height) * 0.8;
                  setCrop({
                    unit: 'px',
                    width: size,
                    height: size,
                    x: (width - size) / 2,
                    y: (height - size) / 2,
                  });
                }
              }}
            />
          </ReactCrop>
        </div>

        <canvas
          ref={canvasRef}
          className="hidden"
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={generateCroppedImage}
            disabled={!completedCrop}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
