import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  Lock, 
  Settings, 
  Activity, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  Link, 
  Globe, 
  FileCode,
  Sliders,
  Terminal,
  Heading,
  Clock
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, ensureAnonymousAuth } from '../lib/firebase';
import { SiteConfig } from '../types';

interface AdminPanelProps {
  currentConfig: SiteConfig;
  onConfigChange: (newConfig: SiteConfig) => void;
  onExit: () => void;
}

export default function AdminPanel({ currentConfig, onConfigChange, onExit }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Form states initialized with current parameters
  const [version, setVersion] = useState(currentConfig.version);
  const [downloadUrl, setDownloadUrl] = useState(currentConfig.downloadUrl);
  const [heroHeadline, setHeroHeadline] = useState(currentConfig.heroHeadline);
  const [heroSubtitle, setHeroSubtitle] = useState(currentConfig.heroSubtitle);
  const [discordUrl, setDiscordUrl] = useState(currentConfig.discordUrl);
  const [developerName, setDeveloperName] = useState(currentConfig.developerName);
  const [downloads, setDownloads] = useState(String(currentConfig.downloads));
  const [activeUsers, setActiveUsers] = useState(String(currentConfig.activeUsers));

  // Visual notification
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Monitor authorization states
  useEffect(() => {
    addLog("Administrative console initialized.");
    addLog(`Current running version detected: ${currentConfig.version}`);
    addLog(`Database connected: f11-bug-website Firestore default`);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAuthenticated(true);
        addLog(`Authenticated session established for admin: ${user.email}`);
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    if (!email || !password) {
      setAuthError('Email and password fields are required.');
      setAuthLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        addLog(`Initiating register sequence for ${email}...`);
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        addLog(`Registration complete. Admin session established for ${userCred.user.email}`);
      } else {
        addLog(`Initiating verification query for ${email}...`);
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        addLog(`Access granted. Authenticated as ${userCred.user.email}`);
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message;
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid email or password credentials.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email address is already registered.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address.';
      }
      setAuthError(friendlyMessage);
      addLog(`Authentication fault: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      addLog("Releasing administrative session tokens...");
      await signOut(auth);
      // Fallback state: guarantee anonymous login for landing page statistics
      await ensureAnonymousAuth();
      addLog("Portal locked. Safely resumed anonymous session.");
      setIsAuthenticated(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error("Logout failure:", err);
      addLog(`Logout failure: ${err.message}`);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    addLog("Sending payload updates to Express server /api/admin/config...");

    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'admin123', // Hardcoded admin authentication
          version,
          downloadUrl,
          heroHeadline,
          heroSubtitle,
          discordUrl,
          developerName,
          downloads: parseInt(downloads, 10),
          activeUsers: parseInt(activeUsers, 10)
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server rejected request');
      }

      const resData = await response.json();
      if (resData.success) {
        onConfigChange(resData.config);
        setAlert({ type: 'success', message: 'Configuration successfully updated and synchronized globally!' });
        addLog("Server successfully persisted configurations and updated Firestore 'global' state.");
      } else {
        throw new Error('Sync failed');
      }
    } catch (err: any) {
      console.error(err);
      setAlert({ type: 'error', message: err.message || 'An error occurred during save fallback.' });
      addLog(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaults = () => {
    setVersion("v1.0.0");
    setDownloadUrl("https://ais-pre-55kpxymd2xxwrxppsso5pt-75270057923.asia-east1.run.app/F11Hotkey.msi");
    setHeroHeadline("Unlock your peak gaming experience.");
    setHeroSubtitle("The ultimate companion for MSI and BlueStacks players. Effortlessly switch resolutions and map custom hotkeys to maximize your FPS.");
    setDiscordUrl("https://discord.gg/optiverseex");
    setDeveloperName("teamquax");
    setDownloads("12450");
    setActiveUsers("842");
    addLog("Restored default local form elements. Click Save to apply.");
  };

  const triggerToastTest = () => {
    addLog("Sent simulation pulse trigger.");
    setAlert({ type: 'success', message: 'Simulation command executed!' });
  };

  if (!isAuthenticated) {
    return (
      <div id="admin-login-screen" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(231,76,60,0.08)_0,transparent_60%)] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          {/* Lock icon */}
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock size={28} />
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-2">F11 Portal Authority</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            {isSignUp 
              ? "Register a secure administrator profile using Firebase credentials."
              : "Enter credentials to unlock dynamic page control templates and stats."}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-left space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Email Address</label>
              <input 
                id="admin-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@optiverse.com"
                className="w-full bg-slate-950 border border-slate-800 text-white font-medium text-sm px-4 py-3.5 rounded-xl outline-none focus:border-red-500 transition-colors"
                required
                autoFocus
              />
            </div>

            <div className="text-left space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Password</label>
              <input 
                id="admin-passwd-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 text-white font-medium text-sm px-4 py-3.5 rounded-xl outline-none focus:border-red-500 transition-colors"
                required
              />
            </div>

            {authError && (
              <div id="auth-error-msg" className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-lg flex items-center gap-2 text-left">
                <AlertCircle size={14} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              id="admin-login-btn"
              type="submit"
              disabled={authLoading}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 active:scale-[98%] text-white font-bold py-3.5 rounded-xl shadow-xl shadow-red-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {authLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Processing Control Portal...
                </>
              ) : isSignUp ? (
                "Register Admin Credentials"
              ) : (
                "Unlock Control Portal"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/60 flex flex-col gap-3 items-center text-[11px] text-slate-500">
            <button
              id="admin-signup-toggle-btn"
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              className="text-red-400 hover:text-red-350 transition-colors bg-transparent border-0 cursor-pointer underline font-semibold"
            >
              {isSignUp ? "Already registered? Sign In instead" : "Don't have an admin account yet? Register here"}
            </button>
            <button 
              id="back-home-btn"
              onClick={onExit}
              className="text-slate-400 hover:text-white transition-colors underline bg-transparent border-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="admin-dashboard" className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Navigation Admin Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 fixed top-0 w-full z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white text-base font-black shadow-lg shadow-red-500/10">F.</div>
            <div>
              <div className="font-extrabold text-sm tracking-tight flex items-center gap-2 mb-0.5">
                <span>ADMINISTRATOR PANEL</span>
                <span className="bg-red-500/20 text-red-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-red-500/10 tracking-widest">LIVE CONTROL</span>
              </div>
              <p className="text-[11px] text-slate-500">f11-bug-website custom cloud dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="view-live-site-btn"
              onClick={onExit}
              className="bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Globe size={14} />
              View Live Website
            </button>
            <button
              id="admin-logout-btn"
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Lock Console
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl mx-auto px-6 pt-28 pb-16 w-full grid lg:grid-cols-12 gap-8">
        
        {/* Left column: Configuration Editor */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Settings size={90} className="text-white" />
            </div>

            <div className="flex items-center gap-3 border-b border-slate-800/60 pb-5 mb-6">
              <Sliders className="text-red-500" size={20} />
              <h3 className="text-lg font-bold">Customize Dynamic Elements</h3>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              
              {/* Alert Message Banner */}
              {alert && (
                <div 
                  id="admin-alert-banner"
                  className={`border p-4 rounded-xl flex items-start gap-3 text-sm leading-relaxed ${
                    alert.type === 'success' 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {alert.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                  <span>{alert.message}</span>
                </div>
              )}

              {/* Rows */}
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* File Version Info */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <FileCode size={12} className="text-slate-400" />
                    Running Version Name
                  </label>
                  <input
                    id="config-version-input"
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. v1.1.2"
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-red-500 text-white font-medium"
                    required
                  />
                  <p className="text-[10px] text-slate-500">Will update all version stamps on the website header and footer downloads.</p>
                </div>

                {/* Direct Download URL Link */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Link size={12} className="text-slate-400" />
                    Direct Binary Download Link
                  </label>
                  <input
                    id="config-downloadurl-input"
                    type="url"
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    placeholder="e.g. https://storage.googleapis.com/...msi"
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-red-500 text-white font-medium"
                    required
                  />
                  <p className="text-[10px] text-slate-500">Immediate target when a user clicks the hero/footer download buttons.</p>
                </div>

              </div>

              {/* Title & Headline Settings */}
              <div className="space-y-6 pt-2 border-t border-slate-800/20">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Heading size={12} className="text-slate-400" />
                    Hero Headline Headline
                  </label>
                  <input
                    id="config-headline-input"
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    placeholder="Headline title text..."
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-red-500 text-white font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Hero Subtitle</label>
                  <textarea
                    id="config-subtitle-textarea"
                    rows={3}
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="Enter short engaging summary details..."
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 text-white font-medium resize-none leading-relaxed"
                    required
                  />
                </div>

              </div>

              {/* Secondary links & metadata config */}
              <div className="grid md:grid-cols-2 gap-6 pt-2 border-t border-slate-800/20">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Developer / Brand Signature</label>
                  <input
                    id="config-developer-input"
                    type="text"
                    value={developerName}
                    onChange={(e) => setDeveloperName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-red-500 text-white font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Discord Invitation URL</label>
                  <input
                    id="config-discord-input"
                    type="url"
                    value={discordUrl}
                    onChange={(e) => setDiscordUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-red-500 text-white font-medium"
                    required
                  />
                </div>

              </div>

              {/* Simulated parameters controls */}
              <div className="bg-slate-950 rounded-2xl p-6 space-y-4 border border-slate-800/60 pt-2 grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5 col-span-2">
                  <div className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-1">
                    <Sparkles size={14} />
                    Database Override Tweaks (Override Stats)
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Instantly overwrite values inside Firestore document. Be polite with values.
                  </p>
                </div>

                <div className="space-y-1.5 (!mt-0)">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Downloads Count Seed</label>
                  <input
                    id="config-downloads-input"
                    type="number"
                    value={downloads}
                    onChange={(e) => setDownloads(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 text-white font-medium font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5 (!mt-0)">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Base Active Users Seed</label>
                  <input
                    id="config-active-input"
                    type="number"
                    value={activeUsers}
                    onChange={(e) => setActiveUsers(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 text-white font-medium font-mono"
                    required
                  />
                </div>
              </div>

              {/* Footer controllers */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-800/30 font-sans justify-between items-center">
                <button
                  id="restore-defaults-btn"
                  type="button"
                  onClick={loadDefaults}
                  className="text-slate-400 hover:text-white text-xs transition-colors flex items-center gap-1 px-4 py-2 border border-dashed border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer bg-transparent"
                >
                  <Clock size={12} />
                  Restore Defaults (Local)
                </button>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    id="cancel-changes-btn"
                    type="button"
                    onClick={onExit}
                    className="bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all flex-grow sm:flex-grow-0 cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    id="save-changes-btn"
                    type="submit"
                    disabled={loading}
                    className="bg-red-500 hover:bg-red-600 active:scale-[98%] text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-red-500/10 transition-all flex items-center justify-center gap-2 flex-grow sm:flex-grow-0 cursor-pointer text-center"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Saving to Cloud...
                      </>
                    ) : (
                      'Save & Apply Config'
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>

        {/* Right column: Diagnostic Logs & Live Monitor */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Metrics */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-4">
              <Activity size={14} className="text-red-500" />
              Live Health Indicators
            </h4>
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Heartbeats</div>
                  <div className="text-xl font-black font-mono mt-0.5">{currentConfig.activeUsers}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              </div>
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calculated Downloads</div>
                  <div className="text-xl font-black font-mono mt-0.5">{currentConfig.downloads.toLocaleString()}</div>
                </div>
                <div className="w-10 h-10 bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center uppercase tracking-widest">
                  DL
                </div>
              </div>
            </div>
          </div>

          {/* Interactive simulator emulator shortcut card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-3">
              <FileCode size={14} className="text-red-500" />
              Emulator Visual Target
            </h4>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Below is a representation of the config JSON that clients receive upon loading the browser window:
            </p>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-850/80 font-mono text-[10px] text-red-300 leading-relaxed overflow-x-auto max-h-[180px] select-all custom-scroll">
              <pre>{JSON.stringify({
                status: "success",
                payload: {
                  client_version: currentConfig.version,
                  server_file: currentConfig.downloadUrl.substring(0, 32) + "...",
                  headline: currentConfig.heroHeadline,
                  discord: currentConfig.discordUrl,
                }
              }, null, 2)}</pre>
            </div>
            <button
               id="test-action-btn"
               onClick={triggerToastTest}
               className="w-full mt-4 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Terminal size={12} />
              Test Diagnostic Query
            </button>
          </div>

          {/* Diagnostic Console Logs */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col h-[280px]">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-3 shrink-0">
              <Terminal size={14} className="text-red-500" />
              Real-time System Logs
            </h4>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-850 flex-grow overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1.5 custom-scroll">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed border-l border-slate-800 pl-2">
                  <span className="text-slate-600">{log.split(' ')[0]}</span>
                  <span className="text-slate-300 font-medium">{log.substring(log.indexOf(' '))}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* Style tweaks for custom elements */}
      <style>{`
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 99px;
        }
      `}</style>
    </div>
  );
}
