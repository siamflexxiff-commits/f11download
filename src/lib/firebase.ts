import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: Must use the firestoreDatabaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Operational Types for Error Tracking
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Global error handler complying with the strict guidelines
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Function to guarantee anonymous login for secure rules mapping
export async function ensureAnonymousAuth(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const userCredential = await signInAnonymously(auth);
          resolve(userCredential.user);
        } catch (error) {
          console.error('Failed anonymous auth:', error);
          reject(error);
        }
      }
    });
  });
}

// Real-time downloads increment
export async function incrementDownloadCount() {
  const path = 'stats/global';
  try {
    const docRef = doc(db, path);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      // Bootstrapping stats document safely if it doesn't exist
      await setDoc(docRef, { downloads: 12450, activeUsers: 24 });
    } else {
      await updateDoc(docRef, { downloads: increment(1) });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Pulse real-time heartbeat for session active status
export async function sendLiveHeartbeat(userId: string) {
  const path = `sessions/${userId}`;
  try {
    const docRef = doc(db, 'sessions', userId);
    await setDoc(docRef, { lastSeen: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
