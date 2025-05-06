
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyBKCu1GkSPGiyPol4-qwXtsRawNUFx4ehA",
  authDomain: "gemini-chatbot-5ebe9.firebaseapp.com",
  projectId: "gemini-chatbot-5ebe9",
  storageBucket: "gemini-chatbot-5ebe9.firebasestorage.app",
  messagingSenderId: "339862554569",
  appId: "1:339862554569:web:659c4b2c1a073a77654a18",
  measurementId: "G-VRVZQWC4QC"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);