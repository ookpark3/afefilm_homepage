import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBojnMbMLnSzUtbMe8CtOya2nJ1bLEjT5w',
  authDomain: 'afefilmdb.firebaseapp.com',
  projectId: 'afefilmdb',
  storageBucket: 'afefilmdb.firebasestorage.app',
  messagingSenderId: '197138650449',
  appId: '1:197138650449:web:5bc69676959c0a88e46f70',
  measurementId: 'G-DYG08RPJLD',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
