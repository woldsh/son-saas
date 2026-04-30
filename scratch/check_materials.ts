import { db } from './src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function checkMaterials() {
    try {
        const snap = await getDocs(collection(db, 'materials'));
        console.log(`Total materials: ${snap.size}`);
        snap.docs.slice(0, 3).forEach(doc => {
            console.log(`Doc ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    } catch (e) {
        console.error(e);
    }
}

checkMaterials();
