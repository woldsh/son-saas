import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, otp, newPassword } = body;

        if (!username || !otp || !newPassword) {
            return NextResponse.json({ success: false, error: 'Username, verification code, and new password are required' }, { status: 400 });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return NextResponse.json({ success: false, error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.' }, { status: 400 });
        }

        const admin = initializeFirebaseAdmin();
        const auth = admin.auth();
        const db = admin.firestore();

        // 1. Look up the stored OTP
        const resetDoc = await db.collection('password_resets').doc(username.toLowerCase().trim()).get();

        if (!resetDoc.exists) {
            return NextResponse.json({ success: false, error: 'No reset request found. Please request a new code.' }, { status: 404 });
        }

        const resetData = resetDoc.data()!;

        // 2. Check expiration
        if (Date.now() > resetData.expiresAt) {
            await db.collection('password_resets').doc(username.toLowerCase().trim()).delete();
            return NextResponse.json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
        }

        // 3. Verify OTP
        if (resetData.otp !== otp.trim()) {
            return NextResponse.json({ success: false, error: 'Invalid verification code.' }, { status: 400 });
        }

        // 4. Reset the password using Firebase Admin
        await auth.updateUser(resetData.uid, {
            password: newPassword,
        });

        // 5. Clean up the used OTP
        await db.collection('password_resets').doc(username.toLowerCase().trim()).delete();

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully! You can now login with your new password.',
        });

    } catch (error: any) {
        console.error('Error in verify-reset API:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to reset password'
        }, { status: 500 });
    }
}
