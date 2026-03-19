"use client";

import { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle 
} from "lucide-react"; 

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) router.push("/dashboard");
    } catch (err: any) {
      setError("Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Google sign-in was interrupted.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg">
        
        {/* Header Section with Large Spacing */}
        <div className="mb-10 text-center">
          <ShieldCheck className="mx-auto text-blue-600 mb-4" size={48} />
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Portal</h1>
          <p className="text-slate-600 text-lg mt-2">Sign in to your secure account</p>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-[32px] p-8 md:p-12 shadow-xl shadow-slate-200/50">
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-4 text-red-700"
              >
                <AlertCircle size={24} className="shrink-0" />
                <p className="font-bold text-base">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-8">
            
            {/* Email - Large Block Style */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-base font-bold text-slate-800 ml-1">
                <Mail size={20} className="text-blue-600" />
                Email Address
              </label>
              <input 
                type="email"
                required
                className="w-full h-16 px-6 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-8 focus:ring-blue-100 transition-all outline-none"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password - Clear Separation */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-base font-bold text-slate-800 ml-1">
                <Lock size={20} className="text-blue-600" />
                Account Password
              </label>
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full h-16 px-6 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-8 focus:ring-blue-100 transition-all outline-none"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="self-end px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600 transition-colors mt-1"
              >
                {showPassword ? "HIDE PASSWORD" : "SHOW PASSWORD"}
              </button>
            </div>

            {/* Main Submit - Extra Large */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg uppercase hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 mt-4 flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-6 mb-3 mt-3 my-10">
            <div className="h-[2px] flex-1 bg-slate-100" />
            <span className="text-slate-400 font-bold text-sm">OR</span>
            <div className="h-[2px] flex-1 bg-slate-100" />
          </div>

          {/* Social Button - High Contrast */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-16 flex items-center justify-center gap-4 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition-all active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="" 
              className="w-6 h-6"
            />
            <span className="font-bold text-slate-700 text-lg">Continue with Google</span>
          </button>
        </div>

        <p className="mt-12 text-center text-slate-400 font-medium text-sm">
          CAS © 2026
        </p>
      </div>
    </div>
  );
}
