import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { sendWelcomeEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, displayName, role, firstName, lastName, username, ...otherData } = body;

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
        }

        const admin = initializeFirebaseAdmin();
        const auth = admin.auth();
        const db = admin.firestore();

        // 0. Check if username is unique
        if (username) {
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('username', '==', username.toLowerCase().trim()).limit(1).get();
            if (!snapshot.empty) {
                return NextResponse.json({ success: false, error: 'Username is already taken' }, { status: 400 });
            }
        }

        // 1. Create user in Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email,
                password,
                displayName: displayName || `${firstName || ''} ${lastName || ''}`.trim(),
            });
        } catch (authError: any) {
            console.error('Auth creation error:', authError);
            if (authError.code === 'auth/email-already-in-use') {
                return NextResponse.json({ success: false, error: 'Email is already registered.' }, { status: 400 });
            }
            throw authError;
        }

        // 2. Create user document in Firestore users collection
        const resolvedRole = role || body.userRole || 'user';
        const userData = {
            uid: userRecord.uid,
            email,
            displayName: displayName || `${firstName || ''} ${lastName || ''}`.trim(),
            firstName: firstName || '',
            lastName: lastName || '',
            username: username ? username.toLowerCase().trim() : '',
            userRole: resolvedRole,
            status: 'active',
            password: password, // Storing plaintext password as explicitly requested for export functionality
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...otherData
        };

        await db.collection('users').doc(userRecord.uid).set(userData);

        // 3. Send welcome email with credentials
        const fullName = displayName || `${firstName || ''} ${lastName || ''}`.trim();
        const cleanUsername = username ? username.toLowerCase().trim() : email;
        
        try {
            await sendWelcomeEmail({
                to: email,
                fullName,
                username: cleanUsername,
                password,
                role: resolvedRole,
            });
        } catch (emailErr) {
            // Don't fail the registration if email fails — just log it
            console.error('Welcome email failed (user was still created):', emailErr);
        }

        return NextResponse.json({
            success: true,
            data: {
                id: userRecord.uid,
                email,
                displayName: userData.displayName,
                role: userData.userRole,
            },
            message: 'User created successfully. Welcome email sent!',
        });

    } catch (error: any) {
        console.error('Error in create-user API:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to create user'
        }, { status: 500 });
    }
}
