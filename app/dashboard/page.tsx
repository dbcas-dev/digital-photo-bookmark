"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db_fs } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Plus, LogOut, Image as ImageIcon, 
  CheckCircle2, AlertCircle, Trash2, ExternalLink, 
  Pencil, QrCode, Download, X, Check, Info, 
  ChevronRight, Folder, Copy, AlertTriangle
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { 
  savePhotoRecord, 
  getPhotoRecords, 
  deletePhotoRecord, 
  updatePhotoRecord 
} from "@/app/actions/photoActions";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // --- SMART SEARCH STATES ---
  const [isAlbumFocused, setIsAlbumFocused] = useState(false);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const router = useRouter();

  // --- FORM STATES ---
  const [albumName, setAlbumName] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");

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
    const result = await getPhotoRecords();
    if (result.success) setRecords(result.data);
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
    if (editId) {
      result = await updatePhotoRecord(editId, { albumName, shareLink, thumbUrl });
    } else {
      result = await savePhotoRecord({ albumName, shareLink, thumbUrl });
    }
    
    if (result.success) {
      if (editId) {
        notify("Changes Saved!", "success");
        setIsEditMode(false);
      } else {
        setGeneratedCode((result as any).photoCode || "");
        setShowSuccess(true);
        notify("Record Added!", "success");
      }
      setShowConfirm(false); 
      setShowModal(false);
      setAlbumName(""); setShareLink(""); setThumbUrl("");
      await fetchMyRecords();
    }
    setIsSaving(false);
  };

  const executeDelete = async () => {
    if (!showDeleteConfirm) return;
    const result = await deletePhotoRecord(showDeleteConfirm);
    if (result.success) {
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
    <div className="min-h-screen bg-[#f8f9ff] pb-20 font-sans">
      
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
              setAlbumName(""); setShareLink(""); setThumbUrl(""); 
              setIsEditMode(true); 
              setShowModal(true); 
            }}
            className="flex-1 sm:flex-none bg-blue-600 text-white px-4 md:px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all text-[12px] md:text-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Photo
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

        {records.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-blue-100 p-12 md:p-24 text-center">
            <p className="text-slate-400 text-md md:text-lg font-bold">Your gallery is empty. Create your first record to begin.</p>
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
                          <div className="aspect-video bg-slate-50 overflow-hidden relative cursor-pointer">
                            {record.thumb_url ? (
                              <img src={record.thumb_url} alt="Thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center -z-10 bg-slate-50"><ImageIcon className="text-slate-200 w-10 h-10 md:w-12 md:h-12" /></div>
                          </div>
                          <div className="p-4 border-t border-slate-50 cursor-pointer">
                            <p className="text-blue-600 font-bold text-sm truncate mb-1 cursor-pointer">{record.photo_code}</p>
                            <p className="text-slate-500 text-[11px] font-bold uppercase cursor-pointer">
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
        )}

{/* --- DUAL-MODE MODAL (Preview & Edit) --- */}
{showModal && (
  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="bg-white w-full h-full md:h-[90vh] md:w-[95vw] md:max-w-[1200px] md:rounded-lg shadow-2xl flex flex-col overflow-hidden relative"
    >
      {/* Close Button */}
      <button 
        onClick={() => setShowModal(false)} 
        className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-600 transition-all cursor-pointer"
      >
        <X size={20} className="md:w-6 md:h-6" />
      </button>

      {/* CONDITIONAL LAYOUT: New Entry vs. Preview/Edit */}
      {!editId ? (
        /* ================= NEW ENTRY MODAL UI (STACKED FORM STYLE) ================= */
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-white">
            <h2 className="text-[13px] md:text-[15px] font-bold text-slate-900 uppercase tracking-widest">New Entry Record</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8">
            <div className="relative">
              <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Album Name</label>
              <input 
                type="text" 
                autoComplete="off"
                onFocus={() => setIsAlbumFocused(true)}
                onBlur={() => setTimeout(() => setIsAlbumFocused(false), 200)}
                className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" 
                value={albumName} 
                onChange={(e) => setAlbumName(e.target.value)} 
              />
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Storage Link</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" 
                  value={shareLink} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setShareLink(val);
                    if (val.startsWith("https://lh3.googleusercontent.com/pw/") || val.startsWith("https://googleusercontent.com/profile/picture/0")) {
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

            {/* Mobile-only Action Buttons (Not sticky) */}
            <div className="pt-6 mt-4 border-t border-slate-100 md:hidden flex flex-col-reverse gap-3">
              <button onClick={() => setShowModal(false)} className="w-full px-8 py-3.5 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[12px] hover:bg-slate-50 transition-all cursor-pointer uppercase">Cancel</button>
              <button onClick={() => setShowConfirm(true)} className="w-full px-8 py-3.5 bg-blue-600 text-white font-bold rounded-md text-[12px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase">Save New Record</button>
            </div>
          </div>

          {/* Desktop-only Sticky Footer */}
          <div className="hidden md:flex p-6 md:p-8 border-t border-slate-100 bg-white justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-8 py-3.5 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[13px] hover:bg-slate-50 transition-all cursor-pointer uppercase">Cancel</button>
            <button onClick={() => setShowConfirm(true)} className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-md text-[13px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase">Save New Record</button>
          </div>
        </div>
      ) : (
        /* ================= PREVIEW / EDIT MODAL UI (SIDEBAR STYLE) ================= */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
          <div className="h-[40vh] md:h-auto md:flex-[2] bg-slate-950 flex items-center justify-center relative overflow-hidden">
            {thumbUrl ? (
              <img key={thumbUrl} src={thumbUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-700 opacity-20">
                <ImageIcon className="w-12 h-12 md:w-16 md:h-16 mb-2" />
                <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest">No Image Preview</p>
              </div>
            )}
            <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] pointer-events-none" />
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
                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Album Name</label>
                      <input type="text" autoComplete="off" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Storage Link</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={shareLink} onChange={(e) => {
                          const val = e.target.value;
                          setShareLink(val);
                          if (val.startsWith("https://lh3.googleusercontent.com/pw/") || val.startsWith("https://googleusercontent.com/profile/picture/0")) {
                            setThumbUrl(val);
                          }
                      }} />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-2 text-[11px] md:text-[12px] uppercase tracking-widest">Thumbnail URL</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 md:p-4 rounded-md text-[13px] text-slate-900 font-bold outline-none focus:border-blue-600 transition-all" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />
                    </div>

                    {/* Mobile-only Action Buttons in Edit Mode (Inside scroll) */}
                    <div className="pt-6 mt-4 border-t border-slate-100 md:hidden flex flex-col gap-3">
                      <button onClick={() => setShowConfirm(true)} className="w-full p-4 bg-blue-600 text-white font-bold rounded-md text-[13px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase tracking-widest">Save Changes</button>
                      <button onClick={() => setShowDiscardConfirm(true)} className="w-full p-4 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[13px] hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest">Discard</button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-5 md:space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Album</p>
                        <p className="text-[13px] font-bold text-slate-900 bg-slate-50 p-3.5 md:p-4 rounded-md border border-slate-100">{albumName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verification Code</p>
                        <div onClick={() => { 
                          const code = records.find(r => r.id === editId)?.photo_code;
                          if(code) { navigator.clipboard.writeText(code); notify("Copied!", "success"); }
                        }} className="bg-blue-50 border border-blue-100 p-3.5 md:p-4 rounded-md flex items-center justify-between cursor-pointer group hover:bg-blue-100 transition-all">
                          <p className="text-[13px] font-bold text-blue-700">{records.find(r => r.id === editId)?.photo_code}</p>
                          <Copy size={16} className="text-blue-300 group-hover:text-blue-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-5 md:gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date Added</p>
                          <p className="text-[13px] font-bold text-slate-700">{editId && records.find(r => r.id === editId) ? new Date(records.find(r => r.id === editId).created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source</p>
                          <a href={shareLink} target="_blank" className="text-[13px] text-blue-600 font-bold underline flex items-center gap-2 hover:text-blue-800 transition-all cursor-pointer">EXTERNAL STORAGE <ExternalLink size={14} /></a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar Footer: Visible on Desktop always, hidden on Mobile during Edit Mode */}
            <div className={`p-5 md:p-6 bg-slate-50/50 border-t border-slate-100 ${isEditMode ? 'hidden md:flex' : 'flex'} flex-col gap-2.5 md:gap-3`}>
              {isEditMode ? (
                <>
                  <button onClick={() => setShowConfirm(true)} className="w-full p-4 bg-blue-600 text-white font-bold rounded-md text-[13px] shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase tracking-widest">Save Changes</button>
                  <button onClick={() => setShowDiscardConfirm(true)} className="w-full p-4 bg-white text-slate-600 border border-slate-200 font-bold rounded-md text-[13px] hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest">Discard</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditMode(true)} className="w-full p-3.5 md:p-4 bg-blue-600 text-white font-bold rounded-md text-[12px] md:text-[13px] flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition-all cursor-pointer uppercase tracking-widest"><Pencil size={15} /> Edit Details</button>
                  <button onClick={() => setShowQRModal(records.find(r => r.id === editId))} className="w-full p-3.5 md:p-4 bg-slate-900 text-white font-bold rounded-md text-[12px] md:text-[13px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all cursor-pointer uppercase tracking-widest"><QrCode size={15} /> View QR Code</button>
                  {editId && <button onClick={() => setShowDeleteConfirm(editId)} className="w-full p-3 text-red-500 font-bold text-[10px] md:text-[11px] uppercase tracking-widest hover:bg-red-50 rounded-md transition-all cursor-pointer">Delete Record</button>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  </div>
)}

        {/* --- QR Modal --- */}
        <AnimatePresence>
          {showQRModal && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl relative">
                <button onClick={() => setShowQRModal(null)} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-slate-900 cursor-pointer"><X size={24} /></button>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-1 tracking-tight uppercase">QR Code</h3>
                <p className="text-blue-600 font-bold mb-6 md:mb-8 text-md md:text-lg">{showQRModal.photo_code}</p>
                <div className="bg-white p-4 md:p-6 border border-slate-100 rounded-2xl inline-block mb-6 md:mb-8 shadow-inner">
                  <QRCodeSVG id="qr-gen" value={`${window.location.origin}/?c=${showQRModal.photo_code}`} size={180} md-size={220} level={"H"} includeMargin={true} />
                </div>
                <button onClick={() => downloadQR(showQRModal.photo_code)} className="w-full bg-blue-600 text-white py-5 md:py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 shadow-lg active:scale-95 transition-all cursor-pointer text-sm">
                  <Download className="w-5 h-5 md:w-6 md:h-6" /> Save QR Code
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Success Modal --- */}
        <AnimatePresence>
          {showSuccess && (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[70]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl max-w-sm w-full p-10 md:p-12 text-center shadow-2xl border-b-[10px] border-green-500">
                <CheckCircle2 className="w-16 h-16 md:w-20 md:h-20 text-green-500 mx-auto mb-6" />
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Saved!</h3>
                <p className="text-md md:text-lg font-bold text-blue-600 bg-blue-50 py-4 rounded-xl mt-6 border border-blue-100 tracking-wider">{generatedCode}</p>
                <button onClick={() => setShowSuccess(false)} className="mt-10 md:mt-12 w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm md:text-md hover:bg-slate-800 transition-all cursor-pointer">CLOSE</button>
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
                  {/* Visual Verification Row */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="Verify" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-slate-200" size={24} />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target Album</p>
                      <p className="text-[14px] font-bold text-slate-900 truncate uppercase">{albumName || "Untitled"}</p>
                    </div>
                  </div>

                  {/* Detailed Data List */}
                  <div className="space-y-4 px-1">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source Link</p>
                      <p className="text-[12px] font-bold text-blue-600 break-all leading-relaxed line-clamp-2">
                        {shareLink || "No link provided"}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thumbnail URL</p>
                      <p className="text-[12px] font-bold text-slate-600 break-all leading-relaxed line-clamp-1">
                        {thumbUrl || "No thumbnail provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 md:gap-4 mt-10">
                  <button 
                    onClick={() => setShowConfirm(false)} 
                    className="flex-1 p-4 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 cursor-pointer text-[12px] md:text-sm uppercase tracking-widest transition-all"
                  >
                    Back
                  </button>
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

        {/* --- Confirmation Modals --- */}
        <AnimatePresence>
          {showSignOutConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl"
              >
                <div className="bg-slate-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                  <LogOut size={28} className="md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-red-700 mb-2">Sign Out?</h3>
                <p className="text-red-600 font-medium mb-8 text-[13px]">Are you sure you want to end your session?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => signOut(auth)} className="w-full p-4 bg-red-700 text-white font-bold rounded-xl hover:bg-slate-800 transition-all cursor-pointer text-sm">YES, SIGN OUT</button>
                  <button onClick={() => setShowSignOutConfirm(false)} className="w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer text-sm">CANCEL</button>
                </div>
              </motion.div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl border-t-[8px] border-red-500"
              >
                <div className="bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                  <AlertTriangle size={28} className="md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Delete Record?</h3>
                <p className="text-slate-500 font-medium mb-8 text-[13px] px-2">This action is permanent and cannot be undone.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={executeDelete} className="w-full p-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all cursor-pointer text-sm">DELETE PERMANENTLY</button>
                  <button onClick={() => setShowDeleteConfirm(null)} className="w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer text-sm">CANCEL</button>
                </div>
              </motion.div>
            </div>
          )}

          {showDiscardConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl max-w-sm w-full p-8 md:p-10 text-center shadow-2xl border-t-[8px] border-orange-500"
              >
                <div className="bg-orange-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600">
                  <AlertTriangle size={28} className="md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Discard Changes?</h3>
                <p className="text-slate-500 font-medium mb-8 text-[13px] px-2">Unsaved progress will be lost. Return to preview?</p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowDiscardConfirm(false);
                      if (editId) setIsEditMode(false);
                      else setShowModal(false);
                    }} 
                    className="w-full p-4 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all cursor-pointer text-sm"
                  >
                    YES, DISCARD
                  </button>
                  <button onClick={() => setShowDiscardConfirm(false)} className="w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer text-sm">CONTINUE EDITING</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
