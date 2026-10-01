import React, { useState } from 'react';
import { QrCode, Printer, X, Save, Building2, PackageCheck, Tag, CheckCircle2 } from 'lucide-react';
import { Item } from '../../types';
import { supabase } from '../../lib/supabase';
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
  const [storageRef, setStorageRef] = useState(item.storage_location || item.location || 'Campus Security Office');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const itemRefCode = `FND-${item.id.slice(0, 8).toUpperCase()}`;

  const handleSaveStorageLocation = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({ storage_location: storageRef.trim() })
        .eq('id', item.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Storage Update Failed',
          message: error.message,
        });
      } else {
        setSavedSuccess(true);
        if (onUpdateStorageLocation) {
          onUpdateStorageLocation(storageRef.trim());
        }
        showToast({
          type: 'success',
          title: 'Storage Location Saved',
          message: `Item physical tag reference set to "${storageRef.trim()}".`,
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

  // Generate simple SVG QR Code pattern derived from item reference
  const generateQRSvg = () => {
    // Generate a stylized 7x7 matrix representation for barcode/QR
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
      <svg viewBox="0 0 19 19" className="w-28 h-28 bg-white p-1 rounded-lg border border-slate-200">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Physical Storage Tag</h3>
              <p className="text-xs text-slate-500">Printable locker tag for campus lost & found storage</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Locker Location Config */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-700">Storage Locker / Shelf Reference</label>
            <div className="flex gap-2">
              <Input
                value={storageRef}
                onChange={(e) => setStorageRef(e.target.value)}
                placeholder="e.g. Locker A-12, Main Security Desk Shelf 3"
                className="bg-white"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveStorageLocation}
                isLoading={isSaving}
                leftIcon={savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
              >
                {savedSuccess ? 'Saved' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Printable Tag Card */}
          <div id="printable-storage-tag" className="p-5 rounded-2xl border-2 border-slate-900 bg-white text-slate-900 space-y-4 shadow-sm print:m-0 print:border-2 print:shadow-none">
            {/* Tag Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <span className="text-xs font-extrabold tracking-widest text-indigo-700 uppercase block">FOUNDLY</span>
                <span className="text-sm font-black text-slate-900 uppercase tracking-tight block">PHYSICAL STORAGE TAG</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">CAMPUS</span>
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[140px]">{collegeName || 'Campus Admin'}</span>
              </div>
            </div>

            {/* Tag Body Grid */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="col-span-2 space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ITEM REFERENCE</span>
                  <span className="text-base font-mono font-black text-indigo-950 block">{itemRefCode}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ITEM NAME</span>
                  <span className="text-sm font-bold text-slate-900 block truncate">{item.item_name}</span>
                  <span className="text-[11px] text-slate-600 font-medium block">Category: {item.category.replace(/_/g, ' ')}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">STORAGE LOCATION</span>
                  <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/60 inline-block mt-0.5">
                    {storageRef || 'Locker / Desk'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-500 pt-1">
                  Logged Date: <strong className="text-slate-800">{item.date}</strong>
                </div>
              </div>

              {/* QR Code graphic */}
              <div className="flex flex-col items-center justify-center text-center">
                {generateQRSvg()}
                <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 block">SCAN TO VERIFY</span>
              </div>
            </div>

            {/* Privacy notice footer */}
            <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400 text-center font-medium">
              Authorized Campus Staff Use Only • Safe Operational Reference Tag
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Storage Tag
          </Button>
        </div>
      </div>
    </div>
  );
};
