import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBaVvhyWOukN89YjyczfG8pKUB6vtwSXLw",
  authDomain: "easylist-588d9.firebaseapp.com",
  projectId: "easylist-588d9",
  storageBucket: "easylist-588d9.firebasestorage.app",
  messagingSenderId: "674831113715",
  appId: "1:674831113715:web:f4952e68beff0c8ddc8686",
  measurementId: "G-70QMYM5W3G"
};
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
