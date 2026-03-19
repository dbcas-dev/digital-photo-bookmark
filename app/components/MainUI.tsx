"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, QrCode, Download, Facebook, 
  CheckCircle2, X, Loader2, ImageIcon, ArrowLeft, AlertTriangle, Copy, Check, Camera, Info
} from "lucide-react"; 
import { searchPhotoRecords, getDownloadBlob } from "@/app/actions/photoActions";

function VerificationContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  const searchParams = useSearchParams();
  const codeFromURL = searchParams.get("c");
  const keywordFromURL = searchParams.get("s");

  // --- 1. DYNAMIC TITLE LOGIC ---
  useEffect(() => {
    if (loading) {
      document.title = "Searching...";
    } else if (selectedRecord) {
      document.title = `${selectedRecord.photo_code} | ${selectedRecord.album_name} - Capture and Share - Digital Image Sharing`;
    } else if (results.length > 1) {
      document.title = `Results for "${searchQuery}"`;
    } else {
      document.title = "Capture and Share - Digital Image Sharing";
    }
  }, [selectedRecord, results, searchQuery, loading]);

  // --- 2. BROWSER BACK BUTTON (POPSTATE) LOGIC ---
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("c");
      const s = params.get("s");

      if (!c && !s) {
        // Reset to Home State if no params exist
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

  useEffect(() => {
    if (codeFromURL) {
      handleSearch(codeFromURL);
    } else if (keywordFromURL) {
      setSearchQuery(keywordFromURL.toUpperCase());
      handleSearch(keywordFromURL);
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

    const result = await searchPhotoRecords(cleanQuery);
    
    if (result.success && result.data.length > 0) {
      setResults(result.data);
      if (result.data.length === 1) {
        setSelectedRecord(result.data[0]);
        // Update URL with history push so back button works
        window.history.pushState({ c: result.data[0].photo_code }, "", `?c=${result.data[0].photo_code}`);
      } else {
        window.history.pushState({ s: cleanQuery }, "", `?s=${encodeURIComponent(cleanQuery)}`);
      }
    } else {
      setShowErrorModal(true);
    }
    setLoading(false);
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
    if (selectedRecord?.photo_code) return `${baseUrl}/?c=${selectedRecord.photo_code}`;
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

  useEffect(() => {
    let scanner: any = null;
    if (showScanner) {
      const initScanner = async () => {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        scanner = new Html5QrcodeScanner(
          "reader", 
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
          }, 
          false
        );
        scanner.render(
          (decodedText: string) => {
            try {
              const url = new URL(decodedText);
              const code = url.searchParams.get("c");
              handleSearch(code || decodedText);
            } catch (e) {
              handleSearch(decodedText);
            }
            setShowScanner(false);
          },
          () => {}
        );
      };
      initScanner();
    }
    return () => {
      if (scanner) {
        scanner.clear().catch((err: any) => console.error("Failed to clear scanner", err));
      }
    };
  }, [showScanner]);
  
  const shareToFacebook = () => {
    const link = getShareLink();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
    notify("Redirecting to Facebook...", "info");
  };

  return (
    <div className="min-h-screen bg-[#f7f9ff] text-slate-900 font-sans">
      
      {/* NOTIFICATION CHIP */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-max"
          >
            <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl font-bold text-white text-[12px] uppercase tracking-widest ${notification.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!selectedRecord && results.length <= 1 ? (
          /* PAGE 1: SEARCH */
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
                  placeholder="PHOTO CODE"
                  className="w-full bg-white border border-slate-200 p-4 pr-32 rounded-lg text-[15px] font-bold text-slate-900 shadow-sm outline-none focus:border-blue-600 transition-all uppercase"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button 
                  onClick={() => handleSearch()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-600 text-white px-5 rounded-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search size={16} />}
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
                <QrCode size={18} /> Scan QR Code
              </button>
            </div>
          </motion.div>
        ) : (
          /* PAGE 2: RESULTS */
          <motion.div 
            key="results-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-6xl mx-auto p-4 md:p-6"
          >
            <div className="flex justify-between items-center mb-8 mt-4">
              <button onClick={resetSearch} className="flex items-center gap-2 font-bold text-blue-600 hover:bg-blue-50 p-2 px-4 rounded-md transition-all text-[13px] uppercase tracking-widest cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
              <h2 className="text-[14px] font-bold uppercase text-slate-400 tracking-widest">Image Result</h2>
              <div className="w-20"></div>
            </div>

            {selectedRecord && (
              <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden border border-slate-100">
                <div className="p-4 md:p-8">
                  <div className="w-full rounded-md overflow-hidden mb-6 relative aspect-[1454/969]">
                    <img src={selectedRecord.thumb_url} alt="Verified" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900 uppercase tracking-tight mb-1">{selectedRecord.album_name}</h2>
                      <div className="flex flex-col gap-1">
                        <p className="text-blue-600 text-[13px] font-bold uppercase">{selectedRecord.photo_code}</p>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                          Captured: {new Date(selectedRecord.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => handleDownload(selectedRecord.share_link, selectedRecord.photo_code)} 
                        disabled={downloading} 
                        className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-md font-bold text-[12px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 uppercase cursor-pointer"
                      >
                        {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Download Photo
                      </button>
                      <button 
                        onClick={shareToFacebook} 
                        className="w-full md:w-auto bg-[#1877F2] text-white px-6 py-3 rounded-md font-bold text-[12px] flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 uppercase cursor-pointer"
                      >
                        <Facebook size={16} /> Share to Facebook
                      </button>
                      <button 
                        onClick={copyToClipboard} 
                        className={`w-full md:w-auto p-3 px-6 md:px-3 rounded-md border transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-0 cursor-pointer ${copied ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-slate-200 text-slate-400 hover:text-blue-600"}`}
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        <span className="md:hidden font-bold text-[12px] uppercase">Copy Share Link</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedRecord && results.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {results.map((r) => (
                  <div key={r.id} onClick={() => { setSelectedRecord(r); window.history.pushState({ c: r.photo_code }, "", `?c=${r.photo_code}`); }} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-blue-600 transition-all cursor-pointer group shadow-sm hover:shadow-lg">
                    <div className="w-full aspect-video rounded-md overflow-hidden mb-3 bg-slate-100">
                      <img src={r.thumb_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    </div>
                    <div className="px-1">
                      <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-tight line-clamp-1">{r.album_name}</h3>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-blue-600 font-bold text-[12px] uppercase">{r.photo_code}</p>
                        <p className="text-slate-400 text-[10px] font-bold">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCANNER MODAL */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-lg p-6 shadow-2xl relative border border-slate-100">
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

              <div id="reader" className="w-full aspect-square rounded-md overflow-hidden border-2 border-blue-600 bg-slate-950 shadow-inner relative z-10 [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_button]:bg-blue-600 [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-md [&_button]:text-[11px] [&_button]:font-bold [&_button]:uppercase [&_button]:mt-4 [&_button]:cursor-pointer [&_select]:bg-slate-50 [&_select]:border [&_select]:border-slate-200 [&_select]:rounded-md [&_select]:p-2 [&_select]:text-[11px]">
              </div>

              <div className="mt-6 text-center">
                <p className="text-slate-500 font-bold text-[11px] uppercase tracking-widest leading-relaxed">
                  Center the QR code in the frame to scan.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ERROR MODAL */}
      <AnimatePresence>
        {showErrorModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-lg p-8 max-w-sm w-full text-center shadow-2xl">
              <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-4" />
              <h3 className="text-[15px] font-bold text-slate-900 mb-2 uppercase tracking-widest">Photo Not Found</h3>
              <p className="text-slate-500 font-bold text-[12px] leading-relaxed px-4">The code entered does not match our records.</p>
              <button onClick={() => setShowErrorModal(false)} className="w-full bg-slate-900 text-white py-4 rounded-md font-bold text-[12px] uppercase mt-6 hover:bg-slate-800 transition-all cursor-pointer">Try Again</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 mt-10 border-t border-slate-100">
          <p className="text-[12px] text-center font-bold text-slate-300">
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
