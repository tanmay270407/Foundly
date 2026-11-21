import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, X, FileCheck } from 'lucide-react';

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
  helperText = 'PNG, JPG, WEBP up to 5MB',
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
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    setSizeError(null);
    if (!file) {
      setPreviewUrl(null);
      onChange(null);
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setSizeError(`File exceeds ${maxSizeMB}MB limit.`);
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
    setSizeError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange(null);
  };

  const displayError = error || sizeError;

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label className="text-[13px] font-medium text-slate-700 flex items-center gap-1">
          <span>{label}</span>
          {requiredIndicator && <span className="text-rose-500" aria-hidden="true">*</span>}
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
        className={`relative flex flex-col items-center justify-center p-4 rounded-xl border border-dashed transition-colors duration-150 cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/40'
            : displayError
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
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{value.name}</p>
              <p className="text-xs text-slate-400 tabular-nums">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-left w-full sm:justify-center sm:text-center sm:flex-col sm:gap-1.5 py-1">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700">
                <span className="text-indigo-600 font-semibold">Upload file</span> or drag and drop
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
            </div>
          </div>
        )}
      </div>

      {displayError && <p className="text-xs text-rose-600">{displayError}</p>}
    </div>
  );
};
