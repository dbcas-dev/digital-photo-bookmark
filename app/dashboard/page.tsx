"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db_fs } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Share2, Plus, LogOut, Image as ImageIcon, 
  CheckCircle2, AlertCircle, Trash2, ExternalLink, 
  Pencil, QrCode, Download, X, Check, Info, 
  ChevronRight, Folder, Copy, AlertTriangle, Layers
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { 
  savePhotoRecord, 
  getPhotoRecords, 
  deletePhotoRecord, 
  updatePhotoRecord 
} from "@/app/actions/photoActions";
import {
  saveBatchAlbum,
  getBatchAlbums,
  deleteBatchAlbum,
  updateBatchAlbum
} from "@/app/actions/batchActions";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [batchRecords, setBatchRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');
  const [collapsedAlbums, setCollapsedAlbums] = useState<string[]>([]);
  
  // --- MODAL & VIEW STATES ---
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQRModal, setShowQRModal] = useState<any>(null);
  
  // --- ACTION CONFIRMATION STATES ---
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // --- SMART SEARCH STATES ---
  const [isAlbumFocused, setIsAlbumFocused] = useState(false);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const router = useRouter();

  // --- FORM STATES ---
  const [albumName, setAlbumName] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [batchAlbumCode, setBatchAlbumCode] = useState("");

  // --- EFFECTS ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      try {
        const adminRef = doc(db_fs, "admins", currentUser.email || "");
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          setUser(currentUser);
          await fetchMyRecords();
          setLoading(false);
        } else {
          signOut(auth).then(() => router.push("/login"));
        }
      } catch (error) { router.push("/login"); }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const isAnyModalOpen = 
      showModal || showQRModal || showConfirm || showSuccess || 
      showSignOutConfirm || showDeleteConfirm || showDiscardConfirm;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal, showQRModal, showConfirm, showSuccess, showSignOutConfirm, showDeleteConfirm, showDiscardConfirm]);

  // --- HELPERS ---

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000); 
  };

  const fetchMyRecords = async () => {
    try {
      const photoResult = await getPhotoRecords();
      if (photoResult?.success && photoResult.data) {
        setRecords(photoResult.data as any[]);
      }
      const batchResult = await getBatchAlbums();
      if (batchResult?.success && batchResult.data) {
        setBatchRecords(batchResult.data as any[]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      notify("Failed to sync database", "error");
    }
  };

  const uniqueAlbums = useMemo(() => {
    return Array.from(new Set(records.map(r => r.album_name))).filter(Boolean);
  }, [records]);

  const groupedRecords = useMemo(() => {
    return records.reduce((acc: { [key: string]: any[] }, record) => {
      const album = record.album_name || "Uncategorized";
      if (!acc[album]) acc[album] = [];
      acc[album].push(record);
      return acc;
    }, {});
  }, [records]);

  const toggleAlbum = (name: string) => {
    setCollapsedAlbums(prev => 
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    let result;

    if (activeTab === 'individual') {
      if (editId) {
        result = await updatePhotoRecord(editId as number, { albumName, shareLink, thumbUrl });
      } else {
        result = await savePhotoRecord({ albumName, shareLink, thumbUrl });
      }
    } else {
      if (editId) {
        result = await updateBatchAlbum(editId as string, { 
          title: albumName, shareLink, thumbUrl, albumCode: batchAlbumCode 
        });
      } else {
        result = await saveBatchAlbum({ 
          title: albumName, shareLink, thumbUrl, albumCode: batchAlbumCode 
        });
      }
    }
    
    if (result?.success) {
      if (editId) {
        notify("Changes Saved!", "success");
        setIsEditMode(false);
      } else {
        if (activeTab === 'individual') {
          setGeneratedCode((result as any).photoCode || "");
          setShowSuccess(true);
        }
        notify("Record Added!", "success");
      }
      setShowConfirm(false); 
      setShowModal(false);
      setAlbumName(""); setShareLink(""); setThumbUrl(""); setBatchAlbumCode("");
      await fetchMyRecords();
    } else {
      notify("Failed to save record", "error");
    }
    setIsSaving(false);
  };

  const executeDelete = async () => {
    if (!showDeleteConfirm) return;
    const result = activeTab === 'individual' 
      ? await deletePhotoRecord(showDeleteConfirm as number)
      : await deleteBatchAlbum(showDeleteConfirm as string);

    if (result?.success) {
      notify("Record Deleted", "error");
      await fetchMyRecords();
      setShowModal(false);
    }
    setShowDeleteConfirm(null);
  };

  const downloadQR = (code: string) => {
    const svg = document.getElementById("qr-gen");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const targetSize = 1920; 
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        const pngFile = canvas.toDataURL("image/png", 1.0);
        const downloadLink = document.createElement("a");
        downloadLink.download = `QR-${code}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        notify("QR Downloaded!", "info"); 
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f8f9ff]">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] pb-20 font-sans text-slate-900">
      
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] w-[90%] md:w-auto"
          >
            <div className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl shadow-xl font-bold text-white ${notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              {notification.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              {notification.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
              <span className="text-[13px]">{notification.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="bg-white px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-40 shadow-sm border-b border-blue-50 gap-4 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-md shadow-blue-200">
            <ImageIcon className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="font-bold text-md md:text-lg text-slate-900 whitespace-nowrap">Photobooth Admin</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
          <button 
            onClick={() => { 
              setEditId(null); 
              setAlbumName(""); setShareLink(""); setThumbUrl(""); setBatchAlbumCode("");
              setIsEditMode(true); 
              setShowModal(true); 
            }}
            className="flex-1 sm:flex-none bg-blue-600 text-white px-4 md:px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all text-[12px] md:text-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add {activeTab === 'individual' ? 'Photo' : 'Album'}
          </button>
          
          <button 
            onClick={() => setShowSignOutConfirm(true)} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-red-600 font-bold hover:bg-red-50 px-4 md:px-6 py-3 rounded-xl transition-all text-[12px] md:text-sm cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        
        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mb-8 gap-8">
          <button 
            onClick={() => setActiveTab('individual')}
            className={`pb-4 text-sm font-bold transition-all relative cursor-pointer uppercase tracking-wide ${activeTab === 'individual' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            Souvenir Photos
            {activeTab === 'individual' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('batch')}
            className={`pb-4 text-sm font-bold transition-all relative cursor-pointer uppercase tracking-wide ${activeTab === 'batch' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            Documentation Albums
            {activeTab === 'batch' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
        </div>

        {activeTab === 'individual' ? (
          /* INDIVIDUAL ALBUM PHOTOS VIEW */
          records.length === 0 ? (
            <div className="bg-white rounded-lg border-2 border-dashed border-blue-100 p-12 md:p-24 text-center">
              <p className="text-slate-400 text-md md:text-lg font-bold">Your individual gallery is empty.</p>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {Object.keys(groupedRecords).map((albumKey) => {
                const isCollapsed = collapsedAlbums.includes(albumKey);
                const sortedAlbumRecords = [...groupedRecords[albumKey]].sort((a, b) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                return (
                  <section key={albumKey} className="space-y-4">
                    <div onClick={() => toggleAlbum(albumKey)} className="flex items-center justify-between p-3 md:p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-all group">
                      <div className="flex items-center gap-2 md:gap-3 cursor-pointer">
                        <Folder className={`${isCollapsed ? 'text-slate-400' : 'text-blue-600'} w-5 h-5 md:w-6 md:h-6 transition-colors`} />
                        <h3 className="text-sm md:text-md font-bold text-slate-900 uppercase tracking-wide truncate max-w-[150px] md:max-w-none">{albumKey}</h3>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold">{sortedAlbumRecords.length}</span>
                      </div>
                      <ChevronRight className={`text-slate-400 transition-transform duration-300 cursor-pointer ${isCollapsed ? '' : 'rotate-90'}`} />
                    </div>

                    {!isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {sortedAlbumRecords.map((record) => (
                          <div key={record.id} 
                            onClick={() => { 
                              setEditId(record.id); 
                              setAlbumName(record.album_name); 
                              setShareLink(record.share_link); 
                              setThumbUrl(record.thumb_url); 
                              setIsEditMode(false); 
                              setShowModal(true); 
                            }}
                            className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-xl transition-all active:scale-[0.98] bg-white"
                          >
                            <div className="aspect-video bg-slate-50 overflow-hidden relative">
                              {record.thumb_url ? (
                                <img src={record.thumb_url} alt="Thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              ) : null}
                              <div className="absolute inset-0 flex items-center justify-center -z-10 bg-slate-50"><ImageIcon className="text-slate-200 w-10 h-10 md:w-12 md:h-12" /></div>
                            </div>
                            <div className="p-4 border-t border-slate-50">
                              <p className="text-blue-600 font-bold text-sm truncate mb-1">{record.photo_code}</p>
                              <p className="text-slate-500 text-[11px] font-bold uppercase">
                              {new Date(record.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )
        ) : (
          /* BATCH ALBUMS VIEW */
          batchRecords.length === 0 ? (
            <div className="bg-white rounded-lg border-2 border-dashed border-blue-100 p-12 md:p-24 text-center">
              <p className="text-slate-400 text-md md:text-lg font-bold">No Documentation Albums created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {batchRecords.map((batch) => (
                <div key={batch.id} 
                  onClick={() => { 
                    setEditId(batch.id); 
                    setAlbumName(batch.title); 
                    setShareLink(batch.share_link); 
                    setThumbUrl(batch.thumb_url); 
                    setBatchAlbumCode(batch.album_code || ""); 
                    setIsEditMode(false); 
                    setShowModal(true); 
                  }}
                  className="group relative rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-600 hover:shadow-xl transition-all bg-white"
                >
                  <div className="aspect-video bg-slate-50 overflow-hidden relative">
                    <img src={batch.thumb_url} alt={batch.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute top-3 right-3 bg-blue-600 text-white p-1.5 rounded-lg shadow-lg">
                      <Layers size={14} />
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-slate-900 text-sm md:text-md mb-1 uppercase tracking-tight truncate">{batch.title}</h4>
                    <p className="text-blue-600 text-[11px] font-bold mb-4">{batch.album_code}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Album</span>
                      <span className="text-slate-300 text-[10px]">{new Date(batch.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

{/* --- DUAL-MODE MODAL (Preview & Edit) --- */}
{showModal && (
  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="bg-white w-full h-full md:h-[90vh] md:w-[95vw] md:max-w-[1200px] md:rounded-lg shadow-2xl flex flex-col overflow-hidden relative"
    >
      <button 
        onClick={() => setShowModal(false)} 
        className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-600 transition-all cursor-pointer"
      >
        <X size={20} className="md:w-6 md:h-6" />
      </button>

      {!editId ? (
        /* ================= NEW ENTRY MODAL UI ================= */
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-white">
            <h2 className="text-[13px] md:text-[15px] font-bold text-slate-900 uppercase tracking-widest">
              New {activeTab === 'individual' ? 'Entry Record' : 'Documentation Album'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8">
            <div className="relative">
              <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">
                {activeTab === 'individual' ? 'Event' : 'Album Name'}
              </label>
              <input 
                type="text" 
                autoComplete="off"
                onFocus={() => setIsAlbumFocused(true)}
                onBlur={() => setTimeout(() => setIsAlbumFocused(false), 200)}
                className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" 
                value={albumName} 
                onChange={(e) => setAlbumName(e.target.value)} 
              />
              {activeTab === 'individual' && (
                <AnimatePresence>
                  {isAlbumFocused && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-md shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {uniqueAlbums.filter(name => name.toLowerCase().includes(albumName.toLowerCase())).map((suggestion) => (
                        <div key={suggestion} onClick={() => setAlbumName(suggestion)} className="p-4 hover:bg-blue-50 text-[12px] text-slate-700 font-bold cursor-pointer transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0">
                          <Folder size={14} className="text-blue-400" /> {suggestion}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">
                  {activeTab === 'individual' ? 'Photo Link Source' : 'Album Link Source'}
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" 
                  value={shareLink} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setShareLink(val);
                    if (val.includes("googleusercontent.com")) {
                      setThumbUrl(val);
                    }
                  }} 
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Thumbnail URL</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />
              </div>
            </div>

            {activeTab === 'batch' && (
              <div>
                <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Custom Album Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. EVENT-2024"
                  className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-blue-600 font-bold outline-none focus:border-blue-600 transition-all uppercase" 
                  value={batchAlbumCode} 
                  onChange={(e) => setBatchAlbumCode(e.target.value)} 
                />
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-slate-400 font-bold text-[11px] md:text-[12px] uppercase tracking-widest">Live Preview</label>
              <div className="border border-slate-100 rounded-md bg-slate-50 p-4 md:p-6 min-h-[250px] md:min-h-[350px] flex items-center justify-center overflow-hidden">
                {thumbUrl ? (
                  <img key={thumbUrl} src={thumbUrl} alt="Preview" referrerPolicy="no-referrer" className="max-w-full max-h-[40vh] md:max-h-[45vh] object-contain shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="text-center opacity-50">
                    <ImageIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2" />
                    <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest text-slate-500">Thumbnail Preview Area</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 border-t border-slate-100 bg-white flex justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-8 py-3.5 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[13px] hover:bg-slate-50 transition-all cursor-pointer uppercase">Cancel</button>
            <button onClick={() => setShowConfirm(true)} className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-md text-[13px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase">Save Record</button>
          </div>
        </div>
      ) : (
        /* ================= PREVIEW / EDIT MODAL UI ================= */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
          <div className="h-[40vh] md:h-auto md:flex-[2] bg-slate-950 flex items-center justify-center relative overflow-hidden">
            {thumbUrl ? (
              <img key={thumbUrl} src={thumbUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-700 opacity-20">
                <ImageIcon className="w-12 h-12 md:w-16 md:h-16 mb-2" />
                <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest">No Image Preview</p>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-full md:min-w-[320px] md:max-w-[450px] bg-white border-t md:border-t-0 md:border-l border-slate-100 flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-50 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-blue-50 p-1.5 rounded-md">
                  {isEditMode ? <Pencil className="text-blue-600 w-4 h-4" /> : <Info className="text-blue-600 w-4 h-4" />}
                </div>
                <h3 className="text-[11px] md:text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                  {isEditMode ? "Edit Record" : "Information"}
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <AnimatePresence mode="wait">
                {isEditMode ? (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 md:space-y-6">
                    {activeTab === 'batch' && (
                      <div>
                        <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Album Code</label>
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-blue-600 font-bold outline-none focus:border-blue-600 transition-all uppercase" value={batchAlbumCode} onChange={(e) => setBatchAlbumCode(e.target.value)} />
                      </div>
                      
                    )}                    
                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">
                        {activeTab === 'individual' ? 'Event' : 'Album Name'}
                      </label>
                      <input type="text" autoComplete="off" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">
                        {activeTab === 'individual' ? 'Photo Link Source' : 'Album Link Source'}
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" 
                        value={shareLink} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setShareLink(val);
                          if (val.includes("googleusercontent.com")) {
                            setThumbUrl(val);
                          }
                        }} 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Thumbnail URL</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />
                    </div>
                    {/* READ-ONLY DATE FIELD IN EDIT MODE */}
                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Date Added</label>
                      <div className="w-full bg-slate-100 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-500 font-bold cursor-not-allowed flex items-center gap-2">
                        {new Date(activeTab === 'individual' 
                          ? records.find(r => r.id === editId)?.created_at 
                          : batchRecords.find(b => b.id === editId)?.created_at
                        ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                  </motion.div>
                ) : (
                  <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-5 md:space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {activeTab === 'individual' ? 'Photo Code' : 'Album Code'}
                        </p>
                        <div onClick={() => { 
                          const code = activeTab === 'individual' 
                            ? records.find(r => r.id === editId)?.photo_code 
                            : batchAlbumCode;
                          if(code) { navigator.clipboard.writeText(code); notify("Copied!", "success"); }
                        }} className="bg-blue-50 border border-blue-100 p-3.5 md:p-4 rounded-md flex items-center justify-between cursor-pointer group hover:bg-blue-100 transition-all">
                          <p className="text-[13px] font-bold text-blue-700">{activeTab === 'individual' ? records.find(r => r.id === editId)?.photo_code : batchAlbumCode}</p>
                          <Copy size={16} className="text-blue-300 group-hover:text-blue-600" />
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {activeTab === 'individual' ? 'Event' : 'Album Name'}
                        </p>
                        <p className="text-[13px] font-bold text-slate-900 bg-slate-50 p-3.5 md:p-4 rounded-md border border-slate-100">{albumName || "N/A"}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {activeTab === 'individual' ? 'Photo Link Source' : 'Album Link Source'}
                        </p>
                        <div className="flex items-center gap-2">
                          {/* CLICK TO COPY AREA */}
                          <div 
                            onClick={() => {
                              if (shareLink) {
                                navigator.clipboard.writeText(shareLink);
                                notify("Link Copied!", "success");
                              }
                            }}
                            className="flex-1 bg-slate-50 border border-slate-100 p-3.5 md:p-4 rounded-md flex items-center justify-between cursor-pointer group hover:bg-blue-50 hover:border-blue-200 transition-all"
                          >
                            <p className="text-[13px] font-bold text-slate-600 truncate max-w-[200px] md:max-w-[300px]">
                              {shareLink || "No link provided"}
                            </p>
                            <Copy size={16} className="text-slate-300 group-hover:text-blue-600 flex-shrink-0" />
                          </div>

                          {/* DIRECT OPEN BUTTON */}
                          <a 
                            href={shareLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3.5 md:p-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-md active:scale-95"
                            title="Open Link"
                          >
                            <ExternalLink size={18} />
                          </a>
                        </div>
                      </div>

                      {/* DATE RECORDED INFO BOX */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date Added</p>
                        <p className="text-[12px] font-bold text-slate-600 italic">
                          {new Date(activeTab === 'individual' 
                            ? records.find(r => r.id === editId)?.created_at 
                            : batchRecords.find(b => b.id === editId)?.created_at
                          ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-5 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2.5 md:gap-3">
              {isEditMode ? (
                <>
                  <button onClick={() => setShowConfirm(true)} className="w-full p-4 bg-blue-600 text-white font-bold rounded-md text-[13px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase tracking-widest">Save Changes</button>
                  <button onClick={() => setShowDiscardConfirm(true)} className="w-full p-4 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[13px] hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest">Discard</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditMode(true)} className="w-full p-3.5 md:p-4 bg-blue-600 text-white font-bold rounded-md text-[12px] md:text-[13px] flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase tracking-widest"><Pencil size={15} /> Edit Details</button>
<button 
  onClick={() => {
    const target = activeTab === 'individual' 
      ? records.find(r => r.id === editId) 
      : batchRecords.find(b => b.id === editId);
    setShowQRModal(target);
  }} 
  className="w-full p-3.5 md:p-4 bg-slate-900 text-white font-bold rounded-md text-[12px] md:text-[13px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all cursor-pointer uppercase tracking-widest"
>
  {/* Changed icon to Share2 and updated label */}
  <Share2 size={15} /> View Sharing Links
</button>
                  <button onClick={() => setShowDeleteConfirm(editId!)} className="w-full p-3 text-red-500 font-bold text-[10px] md:text-[11px] uppercase tracking-widest hover:bg-red-50 rounded-md transition-all cursor-pointer">Delete Record</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  </div>
)}

{/* --- UNIVERSAL QR MODAL --- */}
<AnimatePresence>
  {showQRModal && (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white rounded-3xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl relative"
      >
        {/* Close Button */}
        <button 
          onClick={() => setShowQRModal(null)} 
          className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-slate-900 cursor-pointer"
        >
          <X size={24} />
        </button>

        {/* 1. QR CODE (GENERATED) */}
        <div className="bg-white p-4 md:p-6 border border-slate-100 rounded-2xl inline-block mb-6 shadow-inner">
          <QRCodeSVG 
            id="qr-gen" 
            value={`${window.location.origin}/?c=${showQRModal.photo_code || showQRModal.album_code}`} 
            size={220} 
            level={"H"} 
            includeMargin={true} 
          />
        </div>

        <div className="space-y-3 mb-8">
          {/* 2. ALBUM NAME / EVENT IN BOX */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              {activeTab === 'individual' ? 'Event' : 'Album Name'}
            </p>
            <p className="text-[13px] font-bold text-slate-900 uppercase truncate px-2">
              {showQRModal.title || showQRModal.album_name}
            </p>
          </div>

          {/* 3. CLICK TO COPY PHOTO/ALBUM CODE BOX */}
          <div 
            onClick={() => {
              const code = showQRModal.photo_code || showQRModal.album_code;
              navigator.clipboard.writeText(code);
              notify("Code Copied!", "success");
            }}
            className="p-3 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100 transition-all group"
          >
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-500">
              {activeTab === 'individual' ? 'Photo Code' : 'Album Code'}
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <span className="text-[15px] font-black tracking-widest">
                {showQRModal.photo_code || showQRModal.album_code}
              </span>
              <Copy size={14} className="flex-shrink-0 opacity-50 group-hover:opacity-100" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
  {/* 4. CLICK TO COPY DIRECT LINK BOX */}
  <div className="flex items-stretch gap-2">
    <div 
      onClick={() => {
        const link = `${window.location.origin}/?c=${showQRModal.photo_code || showQRModal.album_code}`;
        navigator.clipboard.writeText(link);
        notify("Link Copied!", "success");
      }}
      className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group"
    >
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-400">Direct Link</p>
      <div className="flex items-center justify-center gap-2 text-slate-600 group-hover:text-blue-600">
        <span className="text-[11px] font-medium truncate max-w-[150px]">
          {window.location.host}/?c={showQRModal.photo_code || showQRModal.album_code}
        </span>
        <Copy size={14} className="flex-shrink-0 opacity-50 group-hover:opacity-100" />
      </div>
    </div>

    {/* OPEN LINK BUTTON */}
    <button
      onClick={() => {
        const link = `${window.location.origin}/?c=${showQRModal.photo_code || showQRModal.album_code}`;
        window.open(link, '_blank', 'noopener,noreferrer');
      }}
      className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center group cursor-pointer"
      title="Open in new tab"
    >
      <ExternalLink size={18} className="group-hover:scale-110 transition-transform" />
    </button>
  </div>
</div>
        </div>

        {/* 5. SAVE QR CODE BUTTON */}
        <button 
          onClick={() => downloadQR(showQRModal.photo_code || showQRModal.album_code)} 
          className="w-full bg-blue-600 text-white py-5 md:py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 shadow-lg active:scale-95 transition-all cursor-pointer text-sm uppercase tracking-widest"
        >
          <Download className="w-5 h-5" /> Download QR Code
        </button>
        
      </motion.div>
    </div>
    
  )}
</AnimatePresence>


       {/* --- Success Modal --- */}
        <AnimatePresence>
          {showSuccess && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[150]">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="bg-white rounded-3xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl border-b-[10px] border-green-500"
              >
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">Photo Saved!</h3>
                  
                  {/* GENERATED QR CODE */}
                  <div className="bg-white p-3 border border-slate-100 rounded-2xl shadow-inner mb-4">
                    <QRCodeSVG 
                      value={`${window.location.origin}/?c=${generatedCode}`} 
                      size={180} 
                      level={"H"} 
                      includeMargin={true} 
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-6 px-4 leading-relaxed">
                    Scan this QR Code to download the image or share the links below.
                  </p>

                  <div className="w-full space-y-3">
                    {/* CLICK TO COPY DIRECT LINK */}
                    <div 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?c=${generatedCode}`);
                        notify("Link Copied!", "success");
                      }}
                      className="group bg-blue-50 border border-blue-100 p-3 rounded-xl cursor-pointer hover:bg-blue-600 transition-all flex items-center justify-between"
                    >
                      <div className="text-left overflow-hidden">
                        <p className="text-[9px] font-bold text-blue-400 uppercase group-hover:text-blue-200">Visit Link</p>
                        <p className="text-[10px] font-bold text-blue-700 truncate group-hover:text-white">
                          {window.location.host}/?c={generatedCode}
                        </p>
                      </div>
                      <Copy size={14} className="text-blue-300 group-hover:text-white flex-shrink-0" />
                    </div>

                    {/* CLICK TO COPY PHOTO CODE */}
                    <div 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                        notify("Code Copied!", "success");
                      }}
                      className="group bg-slate-50 border border-slate-200 p-3 rounded-xl cursor-pointer hover:bg-slate-900 transition-all flex items-center justify-between"
                    >
                      <div className="text-left">
                        <p className="text-[9px] font-bold text-slate-400 uppercase group-hover:text-slate-400">Photo Code</p>
                        <p className="text-[15px] font-black text-slate-900 tracking-widest group-hover:text-white">
                          {generatedCode}
                        </p>
                      </div>
                      <Check size={16} className="text-slate-300 group-hover:text-green-400 flex-shrink-0" />
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowSuccess(false)} 
                    className="mt-8 w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all cursor-pointer uppercase tracking-widest shadow-lg"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Confirm Save Modal --- */}
        <AnimatePresence>
          {showConfirm && (
            <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[120]">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="bg-white rounded-lg max-w-md w-full p-8 md:p-10 shadow-2xl border-t-[8px] border-blue-600"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-50 p-2 rounded-md">
                    <CheckCircle2 size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight">Confirm Details</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="Verify" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-slate-200" size={24} />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target Title</p>
                      <p className="text-[14px] font-bold text-slate-900 truncate uppercase">{albumName || "Untitled"}</p>
                    </div>
                  </div>

                  <div className="space-y-4 px-1">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source Link</p>
                      <p className="text-[12px] font-bold text-blue-600 break-all leading-relaxed line-clamp-2">
                        {shareLink || "No link provided"}
                      </p>
                    </div>
                    {activeTab === 'batch' && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Search Code</p>
                        <p className="text-[12px] font-bold text-blue-600">{batchAlbumCode || "No code provided"}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 md:gap-4 mt-10">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 p-4 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 cursor-pointer text-[12px] md:text-sm uppercase tracking-widest transition-all">Back</button>
                  <button 
                    onClick={handleFinalSave} 
                    disabled={isSaving} 
                    className="flex-1 p-4 bg-blue-600 text-white font-bold rounded-lg shadow-xl active:scale-95 transition-all cursor-pointer text-[12px] md:text-sm uppercase tracking-widest"
                  >
                    {isSaving ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Confirm Save"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

{/* --- Sign Out Confirmation --- */}
        <AnimatePresence>
          {showSignOutConfirm && (
            <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="text-red-600 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Sign Out?</h3>
                <p className="text-slate-500 text-sm mb-8">Are you sure you want to log out of the admin dashboard?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowSignOutConfirm(false)} className="flex-1 p-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-xs uppercase tracking-widest cursor-pointer">Stay Logged in</button>
                  <button onClick={() => signOut(auth)} className="flex-1 p-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-100 cursor-pointer">Sign Out</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Delete Confirmation --- */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[100] backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl border-t-8 border-red-600">
                <Trash2 className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Record?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  This action is permanent. You are deleting this 
                  <span className="font-bold text-slate-700"> {activeTab === 'individual' ? 'Photo' : 'Batch Album'}</span>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 p-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-xs uppercase cursor-pointer">Cancel</button>
                  <button onClick={executeDelete} className="flex-1 p-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-xs uppercase shadow-lg cursor-pointer">Confirm Delete</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Discard Changes Confirmation --- */}
        <AnimatePresence>
          {showDiscardConfirm && (
            <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl">
                <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-amber-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Discard Edits?</h3>
                <p className="text-slate-500 text-sm mb-8">You have unsaved changes. If you leave now, your edits will be lost.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDiscardConfirm(false)} className="flex-1 p-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-[11px] uppercase tracking-widest cursor-pointer">Keep Editing</button>
                  <button 
                    onClick={() => {
                      setIsEditMode(false);
                      setShowDiscardConfirm(false);
                      // This reverts the view from Edit Inputs back to Information Labels
                    }} 
                    className="flex-1 p-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-[11px] uppercase tracking-widest shadow-lg cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
