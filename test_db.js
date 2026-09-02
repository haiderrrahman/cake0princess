import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./.firebase/firebase-config.json", "utf8"));
// Wait, I don't have firebase config here. Let me check if there's a script I can use.
