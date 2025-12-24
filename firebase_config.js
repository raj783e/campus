// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
// REPLACE WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyC9RswsH9nBua_QC5T4FV3tGdsEJkMFGgk",
    authDomain: "campus-239c6.firebaseapp.com",
    projectId: "campus-239c6",
    storageBucket: "campus-239c6.firebasestorage.app",
    messagingSenderId: "685942595900",
    appId: "1:685942595900:web:9909df412232c2447abe39",
    measurementId: "G-1K95YJ02F7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, storage, googleProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, collection, addDoc, getDocs, query, orderBy, onSnapshot, ref, uploadBytes, getDownloadURL, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, where, deleteDoc };
