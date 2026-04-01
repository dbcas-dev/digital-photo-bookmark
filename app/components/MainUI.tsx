"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, QrCode, Download, 
  CheckCircle2, X, Loader2, ImageIcon, ArrowLeft, ArrowRight, AlertTriangle, Copy, Check, Camera, Info, Layers, ExternalLink, Maximize2, Share2
} from "lucide-react"; 
import { searchPhotoRecords, getDownloadBlob } from "@/app/actions/photoActions";
import { getBatchAlbums } from "@/app/actions/batchActions";
import { Html5QrcodeScanner } from "html5-qrcode";

function VerificationContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'search' | 'results'>('search');
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  const searchParams = useSearchParams();
  const codeFromURL = searchParams.get("c");
  const keywordFromURL = searchParams.get("s");

  // --- 1. QR SCANNER INITIALIZATION ---
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (showScanner) {
      const timer = setTimeout(() => {
        scanner = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0 
          },
          false
        );

        scanner.render(
          (decodedText) => {
            let code = decodedText;
            if (code.includes("?c=")) {
              const url = new URL(code);
              code = url.searchParams.get("c") || code;
            }
            setSearchQuery(code.toUpperCase());
            handleSearch(code);
            setShowScanner(false);
          },
          () => {}
        );
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch((error) => console.error("Failed to clear scanner:", error));
        }
      };
    }
  }, [showScanner]);

  // --- 2. DYNAMIC TITLE LOGIC ---
  useEffect(() => {
    if (loading) {
      document.title = loadingType === 'search' ? "Searching..." : "Preparing...";
    } else if (selectedRecord) {
      const title = selectedRecord.photo_code || selectedRecord.album_code;
      document.title = `${title} | Capture and Share - Digital Image Sharing`;
    } else if (results.length > 0) {
      document.title = `${results.length} Results for "${searchQuery}"`;
    } else {
      document.title = "Capture and Share - Digital Image Sharing";
    }
  }, [selectedRecord, results, searchQuery, loading, loadingType]);

  // --- 3. BROWSER BACK BUTTON LOGIC ---
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("c");
      const s = params.get("s");

      if (!c && !s) {
        setSelectedRecord(null);
        setResults([]);
        setSearchQuery("");
      } else if (c) {
        handleSearch(c);
      } else if (s) {
        setSearchQuery(s.toUpperCase());
        handleSearch(s);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // --- 4. DIRECT LINK AUTO-LOADER (FIXED) ---
  useEffect(() => {
    if (codeFromURL || keywordFromURL) {
      setLoadingType('search');
      setLoading(true); // Trigger loading UI immediately
      
      const query = codeFromURL || keywordFromURL;
      if (keywordFromURL) setSearchQuery(keywordFromURL.toUpperCase());

      // Wrap in timeout to ensure the Loading Modal renders before the heavy fetch starts
      const t = setTimeout(() => {
        handleSearch(query as string);
      }, 100);
      
      return () => clearTimeout(t);
    }
  }, [codeFromURL, keywordFromURL]);

  const notify = (msg: string, type: 'success' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = async (query: string = searchQuery) => {
    if (!query) return;
    
    setLoading(true);

    let cleanQuery = query.trim().toUpperCase();
    const dashlessPattern = /^([A-Z]{2})(\d{4})(\d{4})$/;
    if (dashlessPattern.test(cleanQuery)) {
      cleanQuery = cleanQuery.replace(dashlessPattern, '$1-$2-$3');
    }

    try {
      const photoResult = await searchPhotoRecords(cleanQuery);
      let foundPhotos = (photoResult?.success && photoResult.data) ? (photoResult.data as any[]) : [];

      const batchResult = await getBatchAlbums();
      let matchedBatches: any[] = [];
      
      if (batchResult?.success && Array.isArray(batchResult.data)) {
        matchedBatches = (batchResult.data as any[])
          .filter((b: any) => {
            const searchNormalized = cleanQuery.replace(/\s/g, '');
            const titleMatch = b.title.toUpperCase().includes(cleanQuery);
            const codeMatch = b.album_code.toUpperCase().includes(searchNormalized);
            return titleMatch || codeMatch;
          })
          .map((b: any) => ({ ...b, isBatch: true }));
      }

      const allResults = [...matchedBatches, ...foundPhotos];

      if (allResults.length === 0) {
        setShowErrorModal(true);
        setResults([]);
        setSelectedRecord(null);
      } else if (allResults.length === 1) {
        const single = allResults[0];
        setSelectedRecord(single);
        setResults([]);
        const finalCode = single.photo_code || single.album_code;
        window.history.pushState({ c: finalCode }, "", `?c=${finalCode}`);
      } else {
        setSelectedRecord(null);
        setResults(allResults);
        window.history.pushState({ s: cleanQuery }, "", `?s=${encodeURIComponent(cleanQuery)}`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setSelectedRecord(null);
    setResults([]);
    setSearchQuery("");
    window.history.pushState({}, '', '/');
  };

  const getShareLink = (): string => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    const code = selectedRecord?.photo_code || selectedRecord?.album_code;
    if (code) return `${baseUrl}/?c=${code}`;
    if (searchQuery) return `${baseUrl}/?s=${encodeURIComponent(searchQuery)}`;
    return baseUrl;
  };

  const copyToClipboard = () => {
    const linkToCopy = getShareLink();
    if (linkToCopy) {
      navigator.clipboard.writeText(String(linkToCopy)).then(() => {
        setCopied(true);
        notify("Link Copied to Clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleDownload = async (url: string, code: string) => {
    setDownloading(true);
    try {
      const result = await getDownloadBlob(url, code);
      if (result.success && result.base64) {
        const link = document.createElement("a");
        link.href = `data:${result.contentType};base64,${result.base64}`;
        link.download = `${code}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify("Image Download Successful!", "success");
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      window.open(url, "_blank");
    }
    setDownloading(false);
  };

const handleShare = async () => {
    const link = getShareLink();
    const title = selectedRecord?.album_name || selectedRecord?.title || "Digital Image Sharing";
    
    // Determine the caption based on the record type
    const shareText = selectedRecord?.isBatch 
      ? `Check out ${title} on:` 
      : `Check out this souvenir photo from ${title}!`;

    const shareData = {
      title: title,
      text: shareText,
      url: link,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      copyToClipboard();
      notify("Share API not supported. Link copied instead!", "info");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f7f9ff] text-slate-900 font-sans overflow-x-hidden">
      
      {/* 1. LOADING MODAL (TOPMOST STACK) */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ zIndex: 9999 }}
            className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-5 border border-white/20"
            >
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-14 h-14 text-blue-600 animate-spin" />
                <div className="absolute w-14 h-14 border-4 border-blue-50 rounded-full"></div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-[0.25em] animate-pulse">
                  {loadingType === 'search' ? 'Loading...' : 'Preparing...'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {loadingType === 'search' ? '' : ''}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. FULLSCREEN IMAGE MODAL */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 z-[300] bg-slate-950 flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed top-6 right-6 text-white p-2 bg-white/10 rounded-full backdrop-blur-md"
            >
              <X size={32} />
            </motion.button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={fullscreenImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. NOTIFICATION CHIP */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[400] w-max"
          >
            <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl font-bold text-white text-[12px] uppercase tracking-widest ${notification.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. MAIN PAGE CONTENT (SEARCH OR RESULTS) */}
      <AnimatePresence mode="wait">
        {!selectedRecord && results.length === 0 ? (
          <motion.div 
            key="search-page"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[90vh] p-4 text-center"
          >
            <div className="flex flex-col items-center mb-4">
              <img src="logo.png" alt="Logo" className="max-w-[320px] md:max-w-[400px] h-auto" />
            </div>

            <div className="w-full max-w-md space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Enter Photo/Album Code"
                  className="w-full bg-white border border-slate-200 p-4 pr-32 rounded-lg text-[15px] font-bold text-slate-900 shadow-sm outline-none focus:border-blue-600 transition-all uppercase"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button 
                  onClick={() => handleSearch()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-600 text-white px-5 rounded-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Search size={16} />
                  <span className="font-bold uppercase text-[12px] tracking-widest">Search</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 py-2">
                <div className="h-[1px] flex-1 bg-slate-200" />
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">OR</span>
                <div className="h-[1px] flex-1 bg-slate-200" />
              </div>

              <button 
                onClick={() => setShowScanner(true)}
                className="w-full bg-white text-blue-600 p-4 rounded-lg font-bold text-[14px] flex items-center justify-center gap-3 border border-slate-200 hover:bg-slate-50 transition-all active:scale-[0.98] uppercase tracking-widest cursor-pointer"
              >
                <QrCode size={18} /> Scan QR Photo Code
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="results-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-6xl mx-auto p-4 md:p-6"
          >
            <div className="flex justify-between items-center mb-8 mt-4">
              <button onClick={resetSearch} className="flex items-center gap-2 font-bold text-blue-600 hover:bg-blue-50 p-2 px-4 rounded-md transition-all text-[13px] uppercase tracking-widest cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
              <h2 className="text-[14px] font-bold uppercase text-slate-400 tracking-widest">
                {selectedRecord ? (selectedRecord.isBatch ? "Album" : "Souvenir Photo") : `Matches Found (${results.length})`}
              </h2>
              <div className="w-20"></div>
            </div>

            {selectedRecord && (
              <div className={`mx-auto transition-all duration-500 ${selectedRecord.isBatch ? "max-w-sm px-2 md:px-0" : "max-w-5xl px-4"}`}>
                <div className={`bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 ${selectedRecord.isBatch ? "p-4 md:p-6" : "p-4 md:p-10"}`}>
                  <div className={`rounded-xl overflow-hidden relative bg-slate-50 group shadow-inner transition-all ${selectedRecord.isBatch ? 'aspect-square mb-6' : 'w-full mb-8'}`}>
                    {selectedRecord.isBatch ? (
                      <a href={selectedRecord.share_link} target="_blank" className="w-full h-full block relative cursor-pointer">
                        <img src={selectedRecord.thumb_url} alt="Album Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="text-white w-10 h-10" />
                        </div>
                      </a>
                    ) : (
                      <div onClick={() => setFullscreenImage(selectedRecord.thumb_url)} className="w-full cursor-zoom-in relative group">
                        <img src={selectedRecord.thumb_url} alt="Verified" className="w-full h-auto min-h-[300px] max-h-[70vh] object-contain transition-transform duration-700 group-hover:scale-[1.01]" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="text-white w-12 h-12" />
                        </div>
                        <button className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-slate-900 cursor-pointer">
                          <Maximize2 size={20} />
                        </button>
                      </div>
                    )}
                    <div className={`absolute top-4 left-4 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-md text-white z-10 ${selectedRecord.isBatch ? 'bg-green-600' : 'bg-blue-600'}`}>
                      {selectedRecord.isBatch ? "Album" : "Souvenir Photo"}
                    </div>
                  </div>

                  <div className={`flex flex-col ${selectedRecord.isBatch ? 'items-center text-center' : 'md:flex-row md:items-center justify-between gap-8'}`}>
                    <div className={`space-y-2 ${selectedRecord.isBatch ? 'mb-8' : ''}`}>
                      <h2 className={`cursor-pointer ${selectedRecord.isBatch ? 'text-[18px]' : 'text-[20px] md:text-[24px]'} font-black text-slate-900 uppercase tracking-tight leading-tight`}>
                        {selectedRecord.album_name || selectedRecord.title}
                      </h2>
                      <div className="flex flex-col gap-1">
                        <p className={`font-black uppercase tracking-wider cursor-pointer ${selectedRecord.isBatch ? 'text-green-600 text-[13px]' : 'text-blue-600 text-[15px]'}`}>
                          {selectedRecord.photo_code || selectedRecord.album_code}
                        </p>
<p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest cursor-default">
                          {selectedRecord.isBatch ? "Created: " : "Captured: "}
                          {new Date(selectedRecord.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className={`flex flex-col gap-3 w-full ${selectedRecord.isBatch ? '' : 'md:flex-row md:w-auto'}`}>
                      {selectedRecord.isBatch ? (
                        <>
                          <a href={selectedRecord.share_link} target="_blank" className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95 uppercase tracking-widest shadow-md cursor-pointer">
                            <ExternalLink size={16} /> Open Album
                          </a>
                          <button onClick={handleShare} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest shadow-md cursor-pointer">
                            <Share2 size={16} /> Share Album
                          </button>
                          <button onClick={copyToClipboard} className={`w-full py-4 rounded-xl border-2 font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${copied ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"}`}>
                            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy Link"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleDownload(selectedRecord.share_link, selectedRecord.photo_code)} disabled={downloading} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-[13px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest shadow-md cursor-pointer">
                            {downloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />} Download Photo
                          </button>
                          <button onClick={handleShare} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-[13px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest shadow-md cursor-pointer">
                            <Share2 size={18} /> Share Photo
                          </button>
                          <button onClick={copyToClipboard} className={`w-full md:w-auto p-4 px-8 rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${copied ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 shadow-sm"}`}>
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                            <span className="md:hidden font-black text-[13px] uppercase tracking-widest">Copy Link</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

{!selectedRecord && results.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {results.map((r) => (
                  <div 
                    key={r.isBatch ? `batch-${r.id}` : `photo-${r.id}`} 
                    onClick={() => { 
                        setLoadingType('results');
                        setLoading(true);
                        setTimeout(() => {
                          setSelectedRecord(r); 
                          const code = r.photo_code || r.album_code;
                          window.history.pushState({ c: code }, "", `?c=${code}`);
                          setLoading(false);
                        }, 600);
                    }} 
                    className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-600 transition-all cursor-pointer group shadow-md hover:shadow-2xl relative"
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-slate-50 relative">
                      <img src={r.thumb_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-[6px] font-bold uppercase text-white shadow-md ${r.isBatch ? 'bg-green-600' : 'bg-blue-600'}`}>
                        {r.isBatch ? "Album" : "Souvenir Photo"}
                      </div>
                    </div>
                    <div className="px-1 space-y-2">
                      <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tight line-clamp-1">{r.album_name || r.title}</h3>
                      <div className="flex justify-between items-center">
                        <p className={`font-black text-[13px] uppercase tracking-wider ${r.isBatch ? 'text-green-600' : 'text-blue-600'}`}>
                          {r.photo_code || r.album_code}
                        </p>
                        <ArrowRight className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. QR SCANNER MODAL */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative border border-slate-100 overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-md">
                    <Camera className="text-blue-600 w-5 h-5" />
                  </div>
                  <h3 className="text-slate-900 font-bold text-[14px] uppercase tracking-widest">QR Scanner</h3>
                </div>
                <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-inner">
                <div id="reader" className="w-full h-full"></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. ERROR MODAL */}
      <AnimatePresence>
        {showErrorModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
              <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-4" />
              <h3 className="text-[15px] font-bold text-slate-900 mb-2 uppercase tracking-widest">Record Not Found</h3>
              <button onClick={() => setShowErrorModal(false)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-[12px] uppercase mt-6 hover:bg-slate-800 transition-all cursor-pointer">Try Again</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 mt-10 border-t border-slate-100 text-center">
          <p className="text-[12px] font-bold text-slate-300">
            Digital Image Sharing made better!<br/>
            Capture and Share: Image Sharing System © 2026
          </p>
      </footer>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#f7f9ff]"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>}>
      <VerificationContent />
    </Suspense>
  );
}
