import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { getMe } from "../api/auth.api";
import SubmitRequests from "../components/SubmitRequests";
import ApprovalDashboard from "../components/ApprovalDashboard";
import MySubmissions from "../components/MySubmissions";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("submit");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    // If no token, redirect to login
    if (!token) {
      navigate("/login");
      return;
    }

    // Try to get user from store first
    if (user?.email) {
      setUserEmail(user.email);
      setUserName(user.name || "");
      setUserRole(user.role);
    } else {
      // If not in store, fetch from API
      const fetchUser = async () => {
        try {
          const userData = await getMe();
          setUserEmail(userData.email);
          setUserName(userData.name || "");
          setUserRole(userData.role);
        } catch (error) {
          console.error("Failed to fetch user:", error);
          // If auth fails, redirect to login
          navigate("/login");
        }
      };
      fetchUser();
    }
  }, [user, token, navigate]);

  const [clonedDraftId, setClonedDraftId] = useState(null);

  const handleCloneSubmission = (draftId) => {
    // Switch to Submit Requests tab and pass the draft ID
    setClonedDraftId(draftId);
    setActiveTab("submit");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a9d7c] to-[#14b8a6] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <span className="text-white font-semibold text-lg">DB Portal</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a9d7c] to-[#14b8a6] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("submit")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${
              activeTab === "submit"
                ? "bg-[#1a9d7c]/10 text-[#1a9d7c] border border-[#1a9d7c]/30"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
            title={sidebarCollapsed ? "Submit Requests" : ""}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {!sidebarCollapsed && <span className="font-medium">Submit Requests</span>}
          </button>

          <button
            onClick={() => setActiveTab("queries")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${
              activeTab === "queries"
                ? "bg-[#1a9d7c]/10 text-[#1a9d7c] border border-[#1a9d7c]/30"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
            title={sidebarCollapsed ? "My Submissions" : ""}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {!sidebarCollapsed && <span className="font-medium">My Submissions</span>}
          </button>

          {/* Only show Approval Dashboard for managers */}
          {userRole === "MANAGER" && (
            <button
              onClick={() => setActiveTab("approvals")}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${
                activeTab === "approvals"
                  ? "bg-[#1a9d7c]/10 text-[#1a9d7c] border border-[#1a9d7c]/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
              title={sidebarCollapsed ? "Approval Dashboard" : ""}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {!sidebarCollapsed && <span className="font-medium">Approval Dashboard</span>}
            </button>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {activeTab === "submit" && "Submit Requests"}
                {activeTab === "queries" && "My Submissions"}
                {activeTab === "approvals" && "Approval Dashboard"}
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {activeTab === "submit" && "Submit new database queries and file executions"}
                {activeTab === "queries" && "Track the status of your submitted queries and file executions"}
                {activeTab === "approvals" && "Review and approve pending requests"}
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1a9d7c] to-[#14b8a6] flex items-center justify-center text-white font-semibold">
                {userName ? userName.charAt(0).toUpperCase() : (userEmail ? userEmail.charAt(0).toUpperCase() : "U")}
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500">Logged in as</p>
                <p className="text-sm font-medium text-slate-900">{userName || userEmail || "Loading..."}</p>
              </div>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className={`w-4 h-4 text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setUserDropdownOpen(false)}
                />
                
                {/* Dropdown */}
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{userName || "User"}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{userEmail}</p>
                    {userRole && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-full capitalize">
                        {userRole}
                      </span>
                    )}
                  </div>
                  
                  <a
                    href={`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api-docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="font-medium">API Documentation</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 ml-auto">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 bg-slate-50 p-8">
          {activeTab === "submit" && <SubmitRequests draftId={clonedDraftId} onDraftLoaded={() => setClonedDraftId(null)} />}

          {activeTab === "queries" && <MySubmissions onClone={handleCloneSubmission} />}

          {activeTab === "approvals" && (
            userRole === "MANAGER" ? (
              <ApprovalDashboard />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-slate-400 mx-auto mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h3>
                <p className="text-slate-600">You don't have permission to view this page. Only managers can access the Approval Dashboard.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
