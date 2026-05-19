/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Monitor, Zap, Keyboard, ChevronDown, CheckCircle2, RotateCcw } from 'lucide-react';
import { db, ensureAnonymousAuth, incrementDownloadCount, sendLiveHeartbeat } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SiteConfig, DEFAULT_CONFIG } from './types';
import AdminPanel from './components/AdminPanel';

const RESOLUTIONS = [
  "1920 × 1080",
  "1680 × 1050",
  "1600 × 1024",
  "1600 × 900",
  "1440 × 1080",
  "1440 × 900",
  "1366 × 768",
  "1360 × 768",
  "1280 × 1024",
  "1280 × 960",
  "1280 × 800",
  "1280 × 768",
  "1280 × 720",
  "1176 × 664",
  "1152 × 864",
  "1024 × 768",
  "800 × 600"
];

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [view, setView] = useState<'site' | 'admin'>('site');
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);

  // Web Notification States
  const [webToast, setWebToast] = useState<{ show: boolean; msg: string } | null>(null);

  // App Demo State
  const [demoState, setDemoState] = useState<'install' | 'app'>('install');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Preparing…');
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);

  // Hotkey states
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [currentHotkey, setCurrentHotkey] = useState('F12');
  const [currentResolution, setCurrentResolution] = useState('1440 × 900');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // PySide6 Simulated Toast State
  const [toast, setToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    badgeText: string;
  }>({
    show: false,
    title: '',
    message: '',
    badgeText: ''
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setSiteConfig(prev => ({
        ...prev,
        ...data
      }));
    } catch (error) {
      console.error('Failed to fetch stats fallback:', error);
    }
  }, []);

  // Listen to address hash/pathname/query pattern for admin navigation handling
  useEffect(() => {
    const checkAdminRoute = () => {
      const hasHashAdmin = window.location.hash === '#admin' || window.location.hash.includes('admin');
      const hasPathAdmin = window.location.pathname === '/admin' || window.location.pathname.endsWith('/admin');
      const hasSearchAdmin = window.location.search === '?admin' || window.location.search.includes('admin');
      
      if (hasHashAdmin || hasPathAdmin || hasSearchAdmin) {
        setView('admin');
      } else {
        setView('site');
      }
    };
    window.addEventListener('hashchange', checkAdminRoute);
    window.addEventListener('popstate', checkAdminRoute);
    checkAdminRoute();
    return () => {
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, []);

  // Set up Firebase Real-time listeners & session tracking
  useEffect(() => {
    let unsubscribeStats: (() => void) | undefined;
    let heartbeatInterval: NodeJS.Timeout | undefined;

    const setupRealtimeSync = async () => {
      try {
        // Authenticate anonymously
        const user = await ensureAnonymousAuth();
        const userId = user.uid;

        // Perform initial pulse immediately
        await sendLiveHeartbeat(userId);

        // Heartbeat pulse every 45 seconds to keep session fresh
        heartbeatInterval = setInterval(async () => {
          try {
            await sendLiveHeartbeat(userId);
          } catch (e) {
            console.error("Heartbeat sync failed:", e);
          }
        }, 45000);

        // Subscribe to actual real-time statistics document!
        unsubscribeStats = onSnapshot(doc(db, 'stats', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSiteConfig(prev => ({
              ...prev,
              downloads: data.downloads !== undefined ? data.downloads : prev.downloads,
              activeUsers: data.activeUsers !== undefined ? data.activeUsers : prev.activeUsers,
              version: data.version !== undefined ? data.version : prev.version,
              downloadUrl: data.downloadUrl !== undefined ? data.downloadUrl : prev.downloadUrl,
              heroHeadline: data.heroHeadline !== undefined ? data.heroHeadline : prev.heroHeadline,
              heroSubtitle: data.heroSubtitle !== undefined ? data.heroSubtitle : prev.heroSubtitle,
              discordUrl: data.discordUrl !== undefined ? data.discordUrl : prev.discordUrl,
              developerName: data.developerName !== undefined ? data.developerName : prev.developerName
            }));
          }
        }, (error) => {
          console.error("Firebase live stats sub failed:", error);
        });

      } catch (err) {
        console.error("Firebase realtime setup failed, using Express fallback:", err);
        // Fallback to Express polling
        fetchStats();
        const fallbackInterval = setInterval(fetchStats, 15000);
        return () => clearInterval(fallbackInterval);
      }
    };

    setupRealtimeSync();

    return () => {
      if (unsubscribeStats) unsubscribeStats();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [fetchStats]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDownload = async () => {
    try {
      // 1. Locally trigger Firebase update directly securely!
      try {
        await incrementDownloadCount();
      } catch (fbErr) {
        console.warn("Direct Firestore increment failed, API route will handle it:", fbErr);
      }

      // 2. Trigger Express route for synchronized counts
      await fetch('/api/track-download', { method: 'POST' });
      
      // Sync stats immediately
      fetchStats();

      // Initiate real physical download of the configured URL!
      const link = document.createElement('a');
      link.href = siteConfig.downloadUrl;
      link.setAttribute('download', `F11Hotkey_installer_${siteConfig.version}.msi`);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Elegant browser in-page notification banner
      setWebToast({ show: true, msg: `Starting your download of F11Hotkey.msi (${siteConfig.version})…` });
      setTimeout(() => {
        setWebToast(prev => prev ? { ...prev, msg: 'Download Finished! Check your browser downloads.' } : null);
        setTimeout(() => setWebToast(null), 3500);
      }, 2000);
    } catch (error) {
      console.error('Failed to track download:', error);
    }
  };

  // Setup Installer Simulation Auto-Tick
  useEffect(() => {
    if (demoState !== 'install') return;

    let currentProgress = 0;
    setProgress(0);
    setStatusText('Preparing…');
    setStep1Done(false);
    setStep2Done(false);
    setStep3Done(false);

    const interval = setInterval(() => {
      currentProgress += currentProgress < 80 ? 1 : 2;
      if (currentProgress > 100) currentProgress = 100;
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        clearInterval(interval);
        setStatusText('Install complete. Launching…');
        setStep3Done(true);
        setTimeout(() => {
          setDemoState('app');
        }, 800);
      } else if (currentProgress >= 75) {
        setStatusText('Finishing…');
        setStep3Done(true);
      } else if (currentProgress >= 35) {
        setStatusText('Initializing settings…');
        setStep2Done(true);
      } else {
        setStatusText('Copying files…');
        setStep1Done(true);
      }
    }, 40); // Runs in approx 3.5 seconds for perfect visual display

    return () => clearInterval(interval);
  }, [demoState]);

  // Key Event Listening for Recording Hotkey
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recording) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecording(false);
      setPendingKey(null);
      return;
    }

    if (e.key === 'Enter') {
      if (pendingKey) {
        setCurrentHotkey(pendingKey);
        setRecording(false);
        setPendingKey(null);
        showDemoToast(`Hotkey '${pendingKey}' has been saved!`, 'HOTKEY SAVED', pendingKey);
      }
      return;
    }

    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    else if (/^F[0-9]+$/.test(keyName)) {
      // Keep standard layout function keys
    }

    if (keyName && !['Control', 'Alt', 'Shift', 'Meta'].includes(keyName)) {
      parts.push(keyName);
    }

    if (parts.length > 0) {
      setPendingKey(parts.join('+'));
    }
  }, [recording, pendingKey]);

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, true);
    } else {
      window.removeEventListener('keydown', handleKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recording, handleKeyDown]);

  const showDemoToast = (message: string, title: string, badgeText: string) => {
    setToast({
      show: true,
      title,
      message,
      badgeText: badgeText ? badgeText.substring(0, 2) : '✓'
    });
  };

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleResolutionSelection = (res: string) => {
    setCurrentResolution(res);
    setIsDropdownOpen(false);
    showDemoToast(`Resolution set to ${res}`, 'RESOLUTION UPDATED', 'R');
  };

  const handleRestartDemo = () => {
    setDemoState('install');
    setRecording(false);
    setPendingKey(null);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (view === 'admin') {
    return (
      <AdminPanel 
        currentConfig={siteConfig} 
        onConfigChange={(newConfig) => setSiteConfig(newConfig)} 
        onExit={() => {
          window.location.hash = '';
          if (window.location.pathname === '/admin' || window.location.pathname.endsWith('/admin')) {
            window.history.pushState({}, '', '/');
          }
          if (window.location.search.includes('admin')) {
            window.history.pushState({}, '', window.location.pathname);
          }
          setView('site');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-900 selection:text-white font-sans">
      {/* Toast notifications banner */}
      <AnimatePresence>
        {webToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 text-sm font-semibold max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
            <span>{webToast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${scrolled ? 'bg-white/80 backdrop-blur-md py-3 border-slate-100' : 'bg-transparent py-6 border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center text-sm">F.</div>
            <span>F11 Hotkey</span>
          </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#guide" className="hover:text-slate-900 transition-colors">User Guide</a>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{siteConfig.activeUsers} Active</span>
            </div>
            <button 
              onClick={handleDownload}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {siteConfig.version} is now live
              </div>
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
                {siteConfig.heroHeadline}
              </h1>
              <p className="text-xl text-slate-500 mb-10 max-w-lg leading-relaxed">
                {siteConfig.heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleDownload}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-lg font-semibold shadow-xl shadow-slate-200"
                >
                  <Download size={20} />
                  Download for Windows
                </button>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 px-4 text-sm text-slate-400 font-medium italic">
                    *Completely Free & Open Source
                  </div>
                  <div className="px-4 text-[11px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                    {siteConfig.downloads.toLocaleString()}+ Downloads
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Software Mockup (Interactive Emulator) */}
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative flex flex-col items-center"
            >
              <div className="relative bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden w-[310px] h-[420px] mx-auto flex flex-col justify-between font-sans">
                {/* Window Header */}
                <div className="bg-[#F5F5F5] border-b border-[#D0D0D0] px-3 py-1.5 flex justify-between items-center h-[30px] shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-[18px] h-[18px] border border-[#1A1A1A] text-[#1A1A1A] rounded flex items-center justify-center text-[10px] font-bold">F.</div>
                    <span className="text-xs font-semibold text-[#1A1A1A]">F11 Hotkey</span>
                  </div>
                  <div className="flex gap-0.5">
                    <button className="w-9 h-[28px] hover:bg-[#EEEEEE] flex items-center justify-center text-[#1A1A1A] text-xs transition-colors rounded-sm focus:outline-none">
                      —
                    </button>
                    <button className="w-9 h-[28px] hover:bg-[#EEEEEE] flex items-center justify-center text-[#1A1A1A] text-[10px] transition-colors rounded-sm focus:outline-none">
                      ▢
                    </button>
                    <button 
                      onClick={handleRestartDemo}
                      title="Uninstall & Reset Emulator"
                      className="w-9 h-[28px] hover:bg-[#E81123] hover:text-white flex items-center justify-center text-[#1A1A1A] transition-colors rounded-sm focus:outline-none font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="relative flex-grow flex flex-col justify-between p-5 bg-white overflow-hidden">
                  {demoState === 'install' ? (
                    // Installer View
                    <div className="flex-grow flex flex-col justify-between py-2">
                      <div>
                        <h4 className="text-[14px] font-bold text-[#1A1A1A] mb-1">Setting up F11 Hotkey</h4>
                        <p className="text-[10px] text-[#999999]">Installing components. This will only run once.</p>
                      </div>

                      {/* Diagnostic Box */}
                      <div className="bg-[#FFFFFF] border border-[#D0D0D0] rounded-md p-4 shadow-sm space-y-2 mt-2">
                        <div className="text-[11px] font-bold text-[#1A1A1A]">{statusText}</div>
                        <div className="text-[10px] space-y-1">
                          <div className={`flex items-center gap-1.5 ${step1Done ? 'text-green-500 font-semibold' : 'text-[#666666]'}`}>
                            <span>{step1Done ? '✓' : '•'}</span> Copying files
                          </div>
                          <div className={`flex items-center gap-1.5 ${step2Done ? 'text-green-500 font-semibold' : 'text-[#666666]'}`}>
                            <span>{step2Done ? '✓' : '•'}</span> Initializing settings
                          </div>
                          <div className={`flex items-center gap-1.5 ${step3Done ? 'text-green-500 font-semibold' : 'text-[#666666]'}`}>
                            <span>{step3Done ? '✓' : '•'}</span> Finishing
                          </div>
                        </div>

                        {/* Progress bar container */}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-grow bg-[#FFFFFF] border border-[#D0D0D0] h-[14px] rounded-full overflow-hidden">
                            <div 
                              className="bg-[#E74C3C] h-full rounded-full transition-all duration-75"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#666666] font-semibold w-8 text-right">{progress}%</span>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 italic text-center mt-3">
                        *Simulated PyQt installation sequence
                      </div>
                    </div>
                  ) : (
                    // App Controller View
                    <div className="flex-grow flex flex-col justify-between">
                      {/* User Guide Card */}
                      <div className="bg-white border border-[#D0D0D0] rounded-sm p-3.5 space-y-1.5">
                        <div className="text-[9px] font-bold text-[#666666] uppercase tracking-wider">USER GUIDE</div>
                        <ul className="text-[10px] text-[#1A1A1A] space-y-1.5 font-medium leading-normal">
                          <li>1. Click the hotkey field to set a custom key</li>
                          <li>2. Press Enter to confirm and save your hotkey</li>
                          <li>3. Choose your screen resolution from the dropdown</li>
                        </ul>
                      </div>

                      {/* Hotkey Select Field */}
                      <div className="space-y-1 mt-4">
                        <label className="text-[9px] font-bold text-[#666666] uppercase tracking-widest block">HOTKEY</label>
                        <button
                          onClick={() => {
                            setRecording(true);
                            setPendingKey(null);
                          }}
                          className={`w-full h-8 text-left text-xs font-semibold rounded-sm transition-all border outline-none focus:outline-none pl-3 ${
                            recording 
                              ? pendingKey 
                                ? 'bg-[#FFFBE6] border-[#F59E0B] text-[#B45309]' 
                                : 'bg-[#FFF5F5] border-[#E74C3C] text-[#E74C3C]' 
                              : 'bg-white border-[#D0D0D0] text-[#1A1A1A] hover:bg-[#FAFAFA] hover:border-[#A0A0A0]'
                          }`}
                        >
                          {recording 
                            ? pendingKey 
                              ? `${pendingKey}  •  Press Enter to save` 
                              : 'Press any key..' 
                            : currentHotkey
                          }
                        </button>
                        <div className="text-[9px] text-[#E74C3C]">
                          Click to record • Press Enter to save
                        </div>
                      </div>

                      {/* Resolution Dropdown Selector */}
                      <div className="space-y-1 mt-4 relative" ref={dropdownRef}>
                        <label className="text-[9px] font-bold text-[#666666] uppercase tracking-widest block">CHOOSE YOUR RESOLUTION</label>
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full h-8 px-3 flex justify-between items-center text-xs font-medium text-[#1A1A1A] border border-[#D0D0D0] rounded-sm bg-white hover:border-[#A0A0A0]"
                        >
                          <span>{currentResolution}</span>
                          <span className="text-[9px] text-[#666666]">{isDropdownOpen ? '▲' : '▼'}</span>
                        </button>

                        {/* Custom Dropdown list */}
                        {isDropdownOpen && (
                          <div className="absolute z-30 bottom-9 left-0 w-full h-[140px] bg-white border border-[#D0D0D0] rounded-sm shadow-md overflow-hidden flex flex-col">
                            <div className="overflow-y-auto flex-grow custom-scroll">
                              {RESOLUTIONS.map((res) => (
                                <button
                                  key={res}
                                  onClick={() => handleResolutionSelection(res)}
                                  className={`w-full h-7 text-left px-3 text-xs transition-colors ${
                                    res === currentResolution 
                                      ? 'bg-[#FFF0F0] text-[#E74C3C] font-semibold' 
                                      : 'bg-white text-[#1A1A1A] hover:bg-[#F5F5F5]'
                                  }`}
                                >
                                  {res}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Windows Toast Notification pop-up */}
                  <AnimatePresence>
                    {toast.show && (
                      <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="absolute bottom-10 left-3 right-3 z-40 bg-white border border-[#FFE0E0] border-l-4 border-l-[#E74C3C] rounded-lg p-3 shadow-lg flex items-center gap-3"
                      >
                        {/* Toast Icon badge */}
                        <div className="relative w-8 h-8 rounded-full bg-[#FFF0F0] flex items-center justify-center text-white shrink-0">
                          <div className="absolute inset-0 bg-[#E74C3C]/10 rounded-full animate-ping" />
                          <div className="w-6 h-6 rounded-full bg-[#E74C3C] text-white flex items-center justify-center text-[9px] font-bold">
                            {toast.badgeText}
                          </div>
                        </div>

                        <div className="flex-grow min-w-0">
                          <div className="text-[9px] font-bold tracking-wider text-[#E74C3C] uppercase text-left">{toast.title}</div>
                          <div className="text-[10px] text-[#1A1A1A] font-medium truncate text-left">{toast.message}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer Bar */}
                <div className="bg-[#F5F5F5] border-t border-[#D0D0D0] px-4 py-1.5 flex justify-between items-center h-[30px] shrink-0 text-[10px] text-[#999999] font-medium font-sans">
                  <div className="flex items-center gap-2">
                    <span>{siteConfig.version}</span>
                    <a href={siteConfig.discordUrl} target="_blank" rel="noreferrer" className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center font-bold">?</a>
                  </div>
                  <div className="flex items-center gap-0.5">
                    Dev: <span className="text-[#E74C3C] font-semibold">{siteConfig.developerName}</span>
                  </div>
                </div>
              </div>

              {/* Relaunch / Restart Trigger Box */}
              <div className="mt-4 flex gap-3 text-xs">
                <button
                  onClick={handleRestartDemo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-semibold"
                >
                  <RotateCcw size={12} />
                  Restart Simulation Setup
                </button>
              </div>

              {/* Decorative elements */}
              <div className="absolute -z-10 -bottom-10 -right-10 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50" />
              <div className="absolute -z-10 -top-10 -left-10 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50" />
            </motion.div>
          </div>
        </section>

        {/* Info Bars */}
        <section className="bg-slate-900 py-10 overflow-hidden">
          <div className="flex gap-20 whitespace-nowrap animate-marquee">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 text-white/40 text-sm font-bold uppercase tracking-widest">
                <Monitor size={16} />
                <span>MSI PLAYER SUPPORT</span>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <Zap size={16} />
                <span>LOW LATENCY</span>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <Keyboard size={16} />
                <span>CUSTOM BINDS</span>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-bold mb-4">Built for competitive gameplay.</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
                We designed F11 Hotkey to be lightweight, incredibly fast, and specifically optimized for Android emulators.
              </p>
            </div>

            <motion.div 
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-12"
            >
              <motion.div variants={fadeIn} className="space-y-4 group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform duration-300">
                  <Zap size={28} />
                </div>
                <h3 className="text-xl font-bold">FPS Optimization</h3>
                <p className="text-slate-500 leading-relaxed">
                  By controlling resolution and system priority, we help you squeeze every frame possible out of your hardware.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="space-y-4 group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform duration-300">
                  <Keyboard size={28} />
                </div>
                <h3 className="text-xl font-bold">Custom Key Mapping</h3>
                <p className="text-slate-500 leading-relaxed">
                  The standard F11 isn't for everyone. Map the toggle functionality to any key on your keyboard instantly.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="space-y-4 group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform duration-300">
                  <Monitor size={28} />
                </div>
                <h3 className="text-xl font-bold">Resolution Control</h3>
                <p className="text-slate-500 leading-relaxed">
                  Switch between standard and custom non-native stretched resolutions to find your perfect point of aim.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* User Guide Section */}
        <section id="guide" className="py-32 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-8 italic">Getting Started is <span className="text-red-500 line-through">Hard</span> Easy.</h2>
                <div className="space-y-8">
                  <div className="flex gap-6">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-900 shadow-sm">1</div>
                    <div>
                      <h4 className="text-lg font-bold mb-1">Select Hotkey</h4>
                      <p className="text-slate-500">Click the hotkey display in the app. Press the key you want to use, then hit Enter.</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-900 shadow-sm">2</div>
                    <div>
                      <h4 className="text-lg font-bold mb-1">Set Resolution</h4>
                      <p className="text-slate-500">Pick from our pre-optimized resolutions list designed specifically for MSI players.</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-900 shadow-sm">3</div>
                    <div>
                      <h4 className="text-lg font-bold mb-1">Save & Play</h4>
                      <p className="text-slate-500">Everything saves automatically. Start your emulator and enjoy the boost.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <div className="text-green-500 mb-2"><CheckCircle2 size={24} /></div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Users</div>
                  <div className="text-3xl font-extrabold tracking-tight">{siteConfig.activeUsers}</div>
                  <p className="text-xs text-slate-400">Users currently online using the optimizer.</p>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-3 mt-8">
                  <div className="text-slate-900 mb-2"><Zap size={24} /></div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Gain</div>
                  <div className="text-3xl font-extrabold tracking-tight">+45%</div>
                  <p className="text-xs text-slate-400">Average FPS increase reported by users.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Download Footer Section */}
        <section className="py-40 px-6 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-8 italic">Ready to experience the difference?</h2>
            <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Join thousands of MSI and BlueStacks players who have already optimized their setup. Free, forever.
            </p>
            <button 
              onClick={handleDownload}
              className="bg-slate-900 text-white px-10 py-5 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-xl font-bold mx-auto shadow-2xl shadow-slate-200 group"
            >
              <Download size={24} className="group-hover:translate-y-1 transition-transform" />
              Download F11 Hotkey {siteConfig.version}
            </button>
            <div className="mt-8 text-slate-400 text-sm flex items-center justify-center gap-6 font-medium">
              <span>Windows 10/11</span>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <span>Small Size (1.2MB)</span>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <span>No Install Required</span>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3 font-bold text-lg grayscale opacity-50">
            <div className="w-7 h-7 bg-slate-900 text-white rounded flex items-center justify-center text-xs">F.</div>
            <span>F11 Hotkey</span>
          </div>
          <div className="flex gap-12 text-sm font-semibold text-slate-400 uppercase tracking-widest items-center">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href={siteConfig.discordUrl} target="_blank" rel="noreferrer" className="hover:text-slate-900 transition-colors">Discord</a>
          </div>
          <div className="text-sm font-medium text-slate-400">
            © 2026 Developed by <span className="text-red-500 font-bold">{siteConfig.developerName}</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .rotate-y-5 { transform: rotateY(-5deg); }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </div>
  );
}
