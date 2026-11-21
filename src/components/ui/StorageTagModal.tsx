import React, { useState } from 'react';
import { QrCode, Printer, X, Save, CheckCircle2 } from 'lucide-react';
import { Item } from '../../types';
import { safeUpdate } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Button } from './Button';
import { Input } from './Input';

interface StorageTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
  collegeName?: string;
  onUpdateStorageLocation?: (newLocation: string) => void;
}

export const StorageTagModal: React.FC<StorageTagModalProps> = ({
  isOpen,
  onClose,
  item,
  collegeName,
  onUpdateStorageLocation,
}) => {
  const { showToast } = useToast();
  const [storageRef, setStorageRef] = useState(
    item.current_storage_location || item.storage_location || item.location || 'Lost & Found Office'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const itemRefCode = `FND-${item.id.slice(0, 8).toUpperCase()}`;

  const handleSaveStorageLocation = async () => {
    setIsSaving(true);
    try {
      const trimmed = storageRef.trim();
      let { error, droppedColumns } = await safeUpdate('items', 'id', item.id, {
        current_storage_location: trimmed,
      });
      if (!error && droppedColumns.includes('current_storage_location')) {
        const fallback = await safeUpdate('items', 'id', item.id, {
          storage_location: trimmed,
        });
        error = fallback.error;
      }

      if (error) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: error.message,
        });
      } else {
        setSavedSuccess(true);
        if (onUpdateStorageLocation) {
          onUpdateStorageLocation(storageRef.trim());
        }
        showToast({
          type: 'success',
          title: 'Saved',
          message: `Storage location set to "${storageRef.trim()}".`,
        });
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error('Error updating storage location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateQRSvg = () => {
    const matrix = [
      [1,1,1,1,1,1,1, 0, 1,0,1, 0, 1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1, 0, 0,1,0, 0, 1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1, 1, 1,0,1, 1, 1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1, 0, 0,1,0, 0, 1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1, 1, 1,0,1, 1, 1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1, 0, 1,1,0, 0, 1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1, 0, 1,0,1, 0, 1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0, 1, 0,1,0, 1, 0,0,0,0,0,0,0],
      [1,1,0,1,0,1,1, 0, 1,1,1, 0, 1,0,1,0,1,1,0],
      [0,1,1,0,1,0,0, 1, 0,1,0, 1, 0,1,0,1,0,0,1],
      [1,0,1,0,1,1,1, 0, 1,0,1, 0, 1,1,0,1,1,1,0],
      [0,0,0,0,0,0,0, 1, 1,1,0, 1, 0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1, 0, 0,1,0, 0, 1,0,1,0,1,0,1],
      [1,0,0,0,0,0,1, 1, 1,0,1, 1, 0,1,0,1,0,1,0],
      [1,0,1,1,1,0,1, 0, 0,1,0, 0, 1,1,1,0,0,1,1],
      [1,0,1,1,1,0,1, 1, 1,0,1, 1, 0,0,1,1,1,0,0],
      [1,0,1,1,1,0,1, 0, 1,1,0, 0, 1,0,1,0,1,1,1],
      [1,0,0,0,0,0,1, 1, 0,1,1, 1, 0,1,0,1,0,0,1],
      [1,1,1,1,1,1,1, 0, 1,0,1, 0, 1,1,0,0,1,1,1],
    ];

    return (
      <svg viewBox="0 0 19 19" className="w-24 h-24 bg-white p-1 rounded border border-slate-200">
        {matrix.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            cell === 1 ? (
              <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" fill="#0f172a" />
            ) : null
          )
        )}
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-900">Storage Tag</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Storage Location"
                value={storageRef}
                onChange={(e) => setStorageRef(e.target.value)}
                placeholder="e.g. Locker A-12"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveStorageLocation}
              isLoading={isSaving}
              leftIcon={
                savedSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )
              }
            >
              {savedSuccess ? 'Saved' : 'Save'}
            </Button>
          </div>

          <div
            id="printable-storage-tag"
            className="p-4 rounded-lg border-2 border-slate-900 bg-white text-slate-900 space-y-3 print:m-0 print:border-2"
          >
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <span className="text-xs font-bold tracking-wider uppercase">Foundly · Storage Tag</span>
              <span className="text-xs font-semibold truncate max-w-[150px]">
                {collegeName || 'Campus Desk'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="col-span-2 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Reference</span>
                  <span className="text-sm font-mono font-bold text-slate-900">{itemRefCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Item</span>
                  <span className="font-semibold text-slate-900 block truncate">{item.item_name}</span>
                  <span className="text-[11px] text-slate-500">
                    {(item.category || 'OTHER').replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Shelf / Bin</span>
                  <span className="font-semibold text-slate-900">{storageRef || 'Desk'}</span>
                </div>
                <p className="text-[10px] text-slate-500 tabular-nums">Date: {item.date}</p>
              </div>

              <div className="flex flex-col items-center justify-center">
                {generateQRSvg()}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print
          </Button>
        </div>
      </div>
    </div>
  );
};
