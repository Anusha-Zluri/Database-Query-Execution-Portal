import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

export default function NotFound() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements - green to teal gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1a9d7c]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#14b8a6]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-[#0d9488]/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10 text-center">
        {/* 404 Large Text */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-[#1a9d7c] via-[#14b8a6] to-[#0d9488] bg-clip-text text-transparent mb-4">
            404
          </h1>
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#1a9d7c]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h2 className="text-3xl font-semibold text-white">
              Page Not Found
            </h2>
          </div>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-lg bg-slate-900/50 border border-slate-800 text-white font-medium hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Go Back
          </button>

          {token ? (
            <Link
              to="/dashboard"
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white font-medium hover:shadow-lg hover:shadow-[#1a9d7c]/50 hover:scale-[1.02] transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Go to Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white font-medium hover:shadow-lg hover:shadow-[#1a9d7c]/50 hover:scale-[1.02] transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Go to Login
            </Link>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-12 p-6 rounded-xl border border-slate-800/50 bg-slate-950/50 backdrop-blur-xl">
          <p className="text-sm text-slate-400 mb-3">
            If you believe this is an error, please contact support or check the URL.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>Error Code: 404 - Not Found</span>
          </div>
        </div>
      </div>
    </div>
  );
}
