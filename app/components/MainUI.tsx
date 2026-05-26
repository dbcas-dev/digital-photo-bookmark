"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, QrCode, Download, 
  CheckCircle2, X, Loader2, ImageIcon, ArrowLeft, ArrowRight, AlertTriangle, Copy, Check, Camera, Info, Layers, ExternalLink, Maximize2, Share2, History
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
  
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  const searchParams = useSearchParams();
  const codeFromURL = searchParams.get("c");
  const keywordFromURL = searchParams.get("s");

  // --- HANDLE CLICK OUTSIDE FOR DROPDOWN ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // --- LOAD SEARCH HISTORY ---
  useEffect(() => {
    const history = localStorage.getItem("photoSearchHistory");
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        console.error("Could not parse search history", e);
      }
    }
  }, []);

  const saveToHistory = (query: string) => {
    setSearchHistory((prev) => {
      const newHistory = [query, ...prev.filter((q) => q !== query)].slice(0, 5); // Keep last 5 searches
      localStorage.setItem("photoSearchHistory", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("photoSearchHistory");
    setShowDropdown(false);
  };

  // --- 2. DYNAMIC TITLE & OG METADATA LOGIC ---
  useEffect(() => {
    let title = "Capture and Share - Digital Image Sharing";
    let ogImage = "";

    if (loading) {
      title = loadingType === 'search' ? "Searching..." : "Preparing...";
    } else if (selectedRecord) {
      const code = selectedRecord.photo_code || selectedRecord.album_code;
      title = `${code} | Capture and Share`;
      ogImage = selectedRecord.thumb_url || "";
    } else if (results.length > 0) {
      title = `${searchQuery} | Capture and Share - Digital Image Sharing`;
      // Use the first thumbnail item to appear in the results for the OG image
      ogImage = results[0].thumb_url || "";
    }

    // Update document title
    document.title = title;

    // Dynamically update or create OG Title meta tag
    let ogTitleMeta = document.querySelector('meta[property="og:title"]');
    if (!ogTitleMeta) {
      ogTitleMeta = document.createElement('meta');
      ogTitleMeta.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleMeta);
    }
    ogTitleMeta.setAttribute('content', title);

    // Dynamically update or create OG Image meta tag
    if (ogImage) {
      let ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (!ogImageMeta) {
        ogImageMeta = document.createElement('meta');
        ogImageMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogImageMeta);
      }
      ogImageMeta.setAttribute('content', ogImage);
    }
  }, [selectedRecord, results, searchQuery, loading, loadingType]);

// --- 3. BROWSER BACK BUTTON LOGIC ---
useEffect(() => {
  const handlePopState = async (event: PopStateEvent) => {
    const params = new URLSearchParams(window.location.search);

    const c = params.get("c");
    const s = params.get("s");

    // Browser history state
    const state = event.state || window.history.state;

    // HOME PAGE
    if (!c && !s) {
      setSelectedRecord(null);
      setResults([]);
      setSearchQuery("");
      return;
    }

    // DETAIL PAGE
    if (c) {
      // Restore previous multi-results instantly
      if (state?.previousResults?.length > 0) {
        setResults(state.previousResults);
        setSearchQuery(state.previousQuery || "");

        const selected = state.previousResults.find(
          (r: any) =>
            r.photo_code === c ||
            r.album_code === c
        );

        setSelectedRecord(selected || null);
      } else {
        // Direct link fallback
        await handleSearch(c, false);
      }

      return;
    }

    // SEARCH RESULTS PAGE
    if (s) {
      // Restore cached results immediately
      if (state?.results?.length > 0) {
        setSelectedRecord(null);
        setResults(state.results);
        setSearchQuery(state.query || s.toUpperCase());
      } else {
        // Fallback if state missing
        await handleSearch(s, false);
      }

      return;
    }
  };

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
  };
}, []);


// --- 4. DIRECT LINK AUTO-LOADER ---
useEffect(() => {
  if (codeFromURL || keywordFromURL) {
    setLoadingType('search');
    setLoading(true);

    const query = codeFromURL || keywordFromURL;

    if (keywordFromURL) {
      setSearchQuery(keywordFromURL.toUpperCase());
    }

    const t = setTimeout(() => {
      handleSearch(query as string, false);
    }, 100);

    return () => clearTimeout(t);
  }
}, [codeFromURL, keywordFromURL]);

const notify = (msg: string, type: 'success' | 'info' = 'success') => {
  setNotification({ msg, type });
  setTimeout(() => setNotification(null), 3000);
};

const handleSearch = async (
  query: string = searchQuery,
  pushHistory: boolean = true
) => {
  if (!query) return;

  setShowDropdown(false);
  setLoading(true);

  let cleanQuery = query.trim().toUpperCase();

  const dashlessPattern = /^([A-Z]{2})(\d{4})(\d{4})$/;

  if (dashlessPattern.test(cleanQuery)) {
    cleanQuery = cleanQuery.replace(
      dashlessPattern,
      '$1-$2-$3'
    );
  }

  try {
    const photoResult = await searchPhotoRecords(cleanQuery);

    let foundPhotos =
      (photoResult?.success && photoResult.data)
        ? (photoResult.data as any[])
        : [];

    const batchResult = await getBatchAlbums();

    let matchedBatches: any[] = [];

    if (batchResult?.success && Array.isArray(batchResult.data)) {
      matchedBatches = (batchResult.data as any[])
        .filter((b: any) => {
          const searchNormalized = cleanQuery.replace(/\s/g, '');

          const titleMatch =
            b.title.toUpperCase().includes(cleanQuery);

          const codeMatch =
            b.album_code.toUpperCase().includes(searchNormalized);

          return titleMatch || codeMatch;
        })
        .map((b: any) => ({
          ...b,
          isBatch: true,
        }));
    }

    const allResults = [
      ...matchedBatches,
      ...foundPhotos,
    ];

    if (allResults.length === 0) {
      setShowErrorModal(true);
      setResults([]);
      setSelectedRecord(null);
    } else {
      saveToHistory(cleanQuery);

      // SINGLE RESULT
      if (allResults.length === 1) {
        const single = allResults[0];

        setSelectedRecord(single);
        setResults([]);
        setSearchQuery(cleanQuery);

        const finalCode =
          single.photo_code || single.album_code;

        if (pushHistory) {
          window.history.pushState(
            {
              c: finalCode,
            },
            "",
            `?c=${finalCode}`
          );
        }
      }

      // MULTIPLE RESULTS
      else {
        setSelectedRecord(null);
        setResults(allResults);
        setSearchQuery(cleanQuery);

        if (pushHistory) {
          window.history.pushState(
            {
              s: cleanQuery,
              results: allResults,
              query: cleanQuery,
            },
            "",
            `?s=${encodeURIComponent(cleanQuery)}`
          );
        }
      }
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

  window.history.replaceState(
    {},
    "",
    "/"
  );
};

const handleBack = () => {
  const state = window.history.state;

  // DETAIL PAGE
  if (selectedRecord) {

    // Came from multi-results page
    if (
      state?.previousResults &&
      state.previousResults.length > 0
    ) {
      setSelectedRecord(null);

      setResults(state.previousResults);

      setSearchQuery(
        state.previousQuery || ""
      );

      // Replace URL back to search results
      window.history.pushState(
        {
          s: state.previousQuery,
          results: state.previousResults,
          query: state.previousQuery,
        },
        "",
        `?s=${encodeURIComponent(
          state.previousQuery
        )}`
      );

      return;
    }

    // Direct link visit fallback
    resetSearch();

    return;
  }

  // RESULTS PAGE -> HOME
  resetSearch();
};

const getShareLink = (): string => {
  if (typeof window === "undefined") return "";

  const baseUrl = window.location.origin;

  const code =
    selectedRecord?.photo_code ||
    selectedRecord?.album_code;

  if (code) {
    return `${baseUrl}/?c=${code}`;
  }

  if (searchQuery) {
    return `${baseUrl}/?s=${encodeURIComponent(searchQuery)}`;
  }

  return baseUrl;
};

const copyToClipboard = () => {
  const linkToCopy = getShareLink();

  if (linkToCopy) {
    navigator.clipboard
      .writeText(String(linkToCopy))
      .then(() => {
        setCopied(true);

        notify(
          "Link Copied to Clipboard!",
          "success"
        );

        setTimeout(() => setCopied(false), 2000);
      });
  }
};

const handleDownload = async (
  url: string,
  code: string
) => {
  setDownloading(true);

  try {
    const result = await getDownloadBlob(url, code);

    if (result.success && result.base64) {
      const link = document.createElement("a");

      link.href =
        `data:${result.contentType};base64,${result.base64}`;

      link.download = `${code}.jpg`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      notify(
        "Image Download Successful!",
        "success"
      );
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

  const title =
    selectedRecord?.album_name ||
    selectedRecord?.title ||
    "Digital Image Sharing";

  const shareText = selectedRecord?.isBatch
    ? `Check out ${title} on:`
    : `Check out this souvenir photo from ${title}!`;

  const shareData = {
    title,
    text: shareText,
    url: link,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.log(
        "Share cancelled or failed",
        err
      );
    }
  } else {
    copyToClipboard();

    notify(
      "Share API not supported. Link copied instead!",
      "info"
    );
  }
};


// Helper to transition into detailed view
const handleSelectRecord = (record: any) => {
  setLoadingType('results');
  setLoading(true);

  setTimeout(() => {
    setSelectedRecord(record);

    const code =
      record.photo_code ||
      record.album_code;

    window.history.pushState(
      {
        c: code,
        previousResults: results,
        previousQuery: searchQuery,
      },
      "",
      `?c=${code}`
    );

    setLoading(false);
  }, 300);
};

  return (
    <div className="relative min-h-screen bg-[#f7f9ff] text-slate-900 font-sans overflow-x-hidden">
      
      {/* 1. LOADING MODAL */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto"
            style={{ zIndex: 9999 }}
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
            className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            style={{ zIndex: 9980 }}
          >
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed top-6 right-6 text-white p-2 bg-white/10 rounded-full backdrop-blur-md cursor-pointer"
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 w-max"
            style={{ zIndex: 9990 }}
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
            className="flex flex-col items-center justify-center min-h-[90vh] p-4 text-center relative z-0"
          >
            <div className="flex flex-col items-center mb-4">
              <img src="logo.png" alt="Logo" className="max-w-[320px] md:max-w-[400px] h-auto" />
            </div>

            {/* SEARCH CONTAINER WRAPPER */}
            <div className="w-full max-w-md space-y-4 relative z-20" ref={searchContainerRef}>
              
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Enter Photo/Album Code"
                  className="w-full bg-white border border-slate-200 p-4 pr-32 rounded-lg text-[15px] font-bold text-slate-900 shadow-sm outline-none focus:border-blue-600 transition-all uppercase relative z-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowDropdown(false);
                      handleSearch();
                    }
                  }}
                />
                <button 
                  onClick={() => handleSearch()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-600 text-white px-5 rounded-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer z-20"
                >
                  <Search size={16} />
                  <span className="font-bold uppercase text-[12px] tracking-widest">Search</span>
                </button>

                {/* SEARCH HISTORY DROPDOWN */}
                <AnimatePresence>
                  {showDropdown && searchHistory.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-30"
                    >
                      <div className="flex justify-between items-center px-4 py-3 bg-slate-50/50 border-b border-slate-50">
                        <div className="flex items-center gap-2 text-slate-400">
                          <History size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Recent Searches</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            clearHistory();
                          }} 
                          className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-col max-h-60 overflow-y-auto">
                        {searchHistory.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSearchQuery(item);
                              handleSearch(item);
                              setShowDropdown(false);
                            }}
                            className="group w-full text-left px-4 py-3 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-[12px] font-bold uppercase tracking-wider transition-all cursor-pointer border-b border-slate-50 last:border-none flex justify-between items-center"
                          >
                            {item}
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-center gap-4 py-2">
                <div className="h-[1px] flex-1 bg-slate-200" />
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">OR</span>
                <div className="h-[1px] flex-1 bg-slate-200" />
              </div>

              <button 
                onClick={() => {
                  setShowDropdown(false);
                  setShowScanner(true);
                }}
                className="w-full bg-white text-blue-600 p-4 rounded-lg font-bold text-[14px] flex items-center justify-center gap-3 border border-slate-200 hover:bg-slate-50 transition-all active:scale-[0.98] uppercase tracking-widest cursor-pointer shadow-sm"
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
            className="max-w-6xl mx-auto p-4 md:p-6 relative z-0"
          >
            <div className="flex justify-between items-center mb-8 mt-4">
              <button onClick={handleBack} className="flex items-center gap-2 font-bold text-blue-600 hover:bg-blue-50 p-2 px-4 rounded-md transition-all text-[13px] uppercase tracking-widest cursor-pointer">
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
                        <button className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-slate-900 cursor-pointer z-10">
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
                          {selectedRecord.isBatch ? "" : "Captured: "}
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
                      if (r.isBatch && r.share_link) {
                        window.open(r.share_link, "_blank"); 
                      } else {
                        handleSelectRecord(r);
                      }
                    }}
                    className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-600 transition-all flex flex-col group shadow-md hover:shadow-2xl relative cursor-pointer"
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-slate-50 relative">
                      <img src={r.thumb_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-[6px] font-bold uppercase text-white shadow-md z-10 ${r.isBatch ? 'bg-green-600' : 'bg-blue-600'}`}>
                        {r.isBatch ? "Album" : "Souvenir Photo"}
                      </div>
                    </div>
                    <div className="px-1 space-y-2 flex-grow">
                      <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tight line-clamp-1">{r.album_name || r.title}</h3>
                      <div className="flex justify-between items-center">
                        <p className={`font-black text-[13px] uppercase tracking-wider ${r.isBatch ? 'text-green-600' : 'text-blue-600'}`}>
                          {r.photo_code || r.album_code}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 w-full">
                      {r.isBatch ? (
                        <>
<button
  onClick={(e) => {
    e.stopPropagation();

    const baseUrl = window.location.origin;

    const albumCode =
      r.album_code || r.photo_code;

    const appShareLink =
      `${baseUrl}/?c=${albumCode}`;

    if (navigator.share) {
      navigator.share({
        title: r.album_name || r.title,
        text: `Check out ${r.album_name || r.title} on:`,
        url: appShareLink,
      }).catch((err) =>
        console.log(
          "Share cancelled or failed",
          err
        )
      );
    } else {
      navigator.clipboard.writeText(
        appShareLink
      );

      notify(
        "Link copied to clipboard!",
        "success"
      );
    }
  }}
  className="flex-1 h-10 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer"
>
  <Share2 size={14} /> Share
</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (r.share_link) window.open(r.share_link, "_blank");
                            }}
                            className="flex-1 h-10 bg-green-600 text-white hover:bg-green-700 rounded-xl font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <ExternalLink size={14} /> Open
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRecord(r);
                          }}
                          className="w-full h-10 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                          <ArrowRight size={14} /> View
                        </button>
                      )}
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
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9970 }}
          >
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
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9970 }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
              <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-4" />
              <h3 className="text-[15px] font-bold text-slate-900 mb-2 uppercase tracking-widest">Record Not Found</h3>
              <button onClick={() => setShowErrorModal(false)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-[12px] uppercase mt-6 hover:bg-slate-800 transition-all cursor-pointer">Try Again</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 mt-10 border-t border-slate-100 text-center relative z-0">
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
