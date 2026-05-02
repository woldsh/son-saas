import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }

        const admin = initializeFirebaseAdmin();
        const db = admin.firestore();

        // Query the users collection for the username
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const userData = snapshot.docs[0].data();
        
        if (!userData.email) {
            return NextResponse.json({ success: false, error: 'No email associated with this username' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            email: userData.email
        });

    } catch (error: any) {
        console.error('Error in lookup-username API:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to lookup username'
        }, { status: 500 });
    }
}
