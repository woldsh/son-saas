import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
});
const db = getFirestore(app);

const checkOrders = async () => {
    const q = query(collection(db, 'Transfer_Orders'));
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'completed' && data.status !== 'rejected') {
            console.log(`Order ${doc.id}: status=${data.status}, currentApproverRole=${data.currentApproverRole}`);
        }
    });
};
checkOrders().catch(console.error);
