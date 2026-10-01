import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, Image as ImageIcon, X, FileCheck } from 'lucide-react';

export interface FileUploadProps {
  label?: string;
  helperText?: string;
  error?: string;
  accept?: string;
  maxSizeMB?: number;
  value?: File | null;
  onChange: (file: File | null) => void;
  requiredIndicator?: boolean;
  id?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  helperText = 'PNG, JPG, WEBP up to 5MB (prepared for Supabase Storage)',
  error,
  accept = 'image/png,image/jpeg,image/webp,application/pdf',
  maxSizeMB = 5,
  value,
  onChange,
  requiredIndicator,
  id = 'file-upload',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) {
      setPreviewUrl(null);
      onChange(null);
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File exceeds maximum size of ${maxSizeMB}MB.`);
      return;
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    onChange(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    handleFile(file);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange(null);
  };

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
          <span>{label}</span>
          {requiredIndicator && <span className="text-xs text-rose-500 font-normal">*Required</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        id={id}
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50'
            : error
            ? 'border-rose-300 bg-rose-50/30'
            : value
            ? 'border-emerald-300 bg-emerald-50/20'
            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
        }`}
      >
        {value ? (
          <div className="flex items-center gap-3 w-full">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Upload preview"
                className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{value.name}</p>
              <p className="text-xs text-slate-500">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              aria-label="Remove uploaded file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              <span className="text-indigo-600 font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-400 mt-1">{helperText}</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 mt-0.5">{error}</p>}
    </div>
  );
};
