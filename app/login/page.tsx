"use client";

import { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react"; // This is the loading icon

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      // If successful, redirect to the dashboard
      if (result.user) {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError("Login failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-xl rounded-2xl w-full max-auto max-w-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Admin Portal
        </h1>
        
        <p className="text-center text-gray-500 mb-8">
          Sign in to manage your Digital Photo Bookmarks
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 py-3 px-4 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <>
              <img 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                alt="Google" 
                className="w-5 h-5"
              />
              <span className="font-medium text-gray-700">Sign in with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}