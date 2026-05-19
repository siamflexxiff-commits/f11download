import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  writeBatch
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Dynamic website configuration and metrics with default values
  let siteConfig = {
    downloads: 12450,
    activeUsers: 842,
    version: "v1.0.0",
    downloadUrl: "https://ais-pre-55kpxymd2xxwrxppsso5pt-75270057923.asia-east1.run.app/F11Hotkey.msi",
    heroHeadline: "Unlock your peak gaming experience.",
    heroSubtitle: "The ultimate companion for MSI and BlueStacks players. Effortlessly switch resolutions and map custom hotkeys to maximize your FPS.",
    discordUrl: "https://discord.gg/optiverseex",
    developerName: "teamquax"
  };

  const configPath = path.join(process.cwd(), "site-config.json");

  // Load configuration from local disk if it exists
  try {
    if (fs.existsSync(configPath)) {
      const stored = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      siteConfig = { ...siteConfig, ...stored };
      console.log("Loaded dynamic site configuration from disk:", siteConfig);
    } else {
      // Save initial defaults to disk
      fs.writeFileSync(configPath, JSON.stringify(siteConfig, null, 2), "utf-8");
    }
  } catch (e) {
    console.error("Failed to load/write site config on disk:", e);
  }

  function saveConfig() {
    try {
      fs.writeFileSync(configPath, JSON.stringify(siteConfig, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save site config to disk:", e);
    }
  }

  // Helper: Bootstraps global stats in Firestore
  async function ensureStatsDoc() {
    try {
      const statsRef = doc(db, "stats", "global");
      const snap = await getDoc(statsRef);
      if (!snap.exists()) {
        await setDoc(statsRef, { 
          downloads: siteConfig.downloads, 
          activeUsers: siteConfig.activeUsers,
          version: siteConfig.version,
          downloadUrl: siteConfig.downloadUrl,
          heroHeadline: siteConfig.heroHeadline,
          heroSubtitle: siteConfig.heroSubtitle,
          discordUrl: siteConfig.discordUrl,
          developerName: siteConfig.developerName
        });
      } else {
        const data = snap.data();
        siteConfig.downloads = data.downloads || siteConfig.downloads;
        siteConfig.activeUsers = data.activeUsers || siteConfig.activeUsers;
        // In case Firestore has other text values, we can adopt them
        if (data.version) siteConfig.version = data.version;
        if (data.downloadUrl) siteConfig.downloadUrl = data.downloadUrl;
        if (data.heroHeadline) siteConfig.heroHeadline = data.heroHeadline;
        if (data.heroSubtitle) siteConfig.heroSubtitle = data.heroSubtitle;
        if (data.discordUrl) siteConfig.discordUrl = data.discordUrl;
        if (data.developerName) siteConfig.developerName = data.developerName;
      }
    } catch (err) {
      console.error("Failed to bootstrap Firestore stats doc:", err);
    }
  }

  // Pre-fetch/Bootstrap from Firestore
  await ensureStatsDoc();

  // Background Worker: Calculates real-time active users
  // Counts recently updated sessions and purges stale session documents
  async function processRealtimeSessions() {
    try {
      const nowMs = Date.now();
      const cutoffActive = new Date(nowMs - 2 * 60 * 1000); // 2 minutes ago
      const cutoffPurge = new Date(nowMs - 5 * 60 * 1000); // 5 minutes ago for cleanup

      const sessionsRef = collection(db, "sessions");
      
      // Fetch all sessions to filter and purge in one batch
      const querySnap = await getDocs(sessionsRef);
      let liveCount = 0;
      const toDelete: string[] = [];

      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.lastSeen) {
          const lastSeenDate = data.lastSeen.toDate();
          if (lastSeenDate >= cutoffActive) {
            liveCount++;
          } else if (lastSeenDate < cutoffPurge) {
            toDelete.push(docSnap.id);
          }
        }
      });

      // Purge super-old stale sessions to conserve database storage
      if (toDelete.length > 0) {
        const batch = writeBatch(db);
        toDelete.forEach((id) => {
          batch.delete(doc(db, "sessions", id));
        });
        await batch.commit();
        console.log(`Purged ${toDelete.length} expired sessions.`);
      }

      // Base active users + direct live connections
      const totalActive = 840 + liveCount;
      siteConfig.activeUsers = totalActive;

      // Update activeUsers in global document in Firestore
      const statsRef = doc(db, "stats", "global");
      await updateDoc(statsRef, { activeUsers: totalActive });
      
    } catch (err) {
      console.error("Firestore scheduler error running heartbeat aggregator:", err);
    }
  }

  // Sync / poll statistics with Firestore to align local state
  async function syncLocalStats() {
    try {
      const statsRef = doc(db, "stats", "global");
      const snap = await getDoc(statsRef);
      if (snap.exists()) {
        const data = snap.data();
        siteConfig.downloads = data.downloads || siteConfig.downloads;
        siteConfig.activeUsers = data.activeUsers || siteConfig.activeUsers;
      }
    } catch (err) {
      console.error("Failed to sync client specs with Firestore stats:", err);
    }
  }

  // Set periodic scheduler intervals
  setInterval(processRealtimeSessions, 15000); // Active session filter loop
  setInterval(syncLocalStats, 5000); // Local sync check loop

  // Initial trigger
  processRealtimeSessions().catch(console.error);

  // API endpoints
  app.get("/api/stats", (req, res) => {
    res.json(siteConfig);
  });

  app.post("/api/track-download", async (req, res) => {
    try {
      const statsRef = doc(db, "stats", "global");
      const snap = await getDoc(statsRef);
      
      let nextDownloads = siteConfig.downloads + 1;
      if (snap.exists()) {
        await updateDoc(statsRef, {
          downloads: (snap.data().downloads || 12450) + 1
        });
        nextDownloads = (snap.data().downloads || 12450) + 1;
      } else {
        await setDoc(statsRef, { 
          ...siteConfig,
          downloads: 12451 
        });
        nextDownloads = 12451;
      }
      
      siteConfig.downloads = nextDownloads;
      saveConfig();
      res.json({ success: true, count: siteConfig.downloads });
    } catch (err) {
      console.error("Failed to track download in Firestore:", err);
      // Fallback
      siteConfig.downloads++;
      saveConfig();
      res.json({ success: true, count: siteConfig.downloads });
    }
  });

  app.post("/api/heartbeat", (req, res) => {
    res.json({ success: true, activeUsers: siteConfig.activeUsers });
  });

  // Admin Config POST - update values and persist to local JSON and Firestore
  app.post("/api/admin/config", async (req, res) => {
    try {
      const { 
        password,
        version,
        downloadUrl,
        heroHeadline,
        heroSubtitle,
        discordUrl,
        developerName,
        downloads,
        activeUsers
      } = req.body;

      if (password !== "admin123") {
        return res.status(401).json({ error: "Unauthorized: Invalid administrative credentials." });
      }

      if (version !== undefined) siteConfig.version = version;
      if (downloadUrl !== undefined) siteConfig.downloadUrl = downloadUrl;
      if (heroHeadline !== undefined) siteConfig.heroHeadline = heroHeadline;
      if (heroSubtitle !== undefined) siteConfig.heroSubtitle = heroSubtitle;
      if (discordUrl !== undefined) siteConfig.discordUrl = discordUrl;
      if (developerName !== undefined) siteConfig.developerName = developerName;

      if (downloads !== undefined && !isNaN(Number(downloads))) {
        siteConfig.downloads = Number(downloads);
        try {
          const statsRef = doc(db, "stats", "global");
          await updateDoc(statsRef, { downloads: Number(downloads) });
        } catch (fbErr) {
          console.warn("Direct Firestore stats update failed, server fallback preserved:", fbErr);
        }
      }

      if (activeUsers !== undefined && !isNaN(Number(activeUsers))) {
        siteConfig.activeUsers = Number(activeUsers);
        try {
          const statsRef = doc(db, "stats", "global");
          await updateDoc(statsRef, { activeUsers: Number(activeUsers) });
        } catch (fbErr) {
          console.warn("Direct Firestore live users update failed, server fallback preserved:", fbErr);
        }
      }

      saveConfig();
      res.json({ success: true, config: siteConfig });
    } catch (err) {
      console.error("Admin configuration edit failed:", err);
      res.status(500).json({ error: "Internal server error occurred while writing configuration." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
