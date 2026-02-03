import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAsrhgqkAIKaTUg6cYjfI_39LhRii4RHY4",
  authDomain: "peluchestorecam-5f62b.firebaseapp.com",
  databaseURL: "https://peluchestorecam-5f62b-default-rtdb.firebaseio.com",
  projectId: "peluchestorecam-5f62b",
  storageBucket: "peluchestorecam-5f62b.firebasestorage.app",
  messagingSenderId: "137938371885",
  appId: "1:137938371885:web:6559d41f577d8544e9bfa4",
  measurementId: "G-VFPCJ6QJGD"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);