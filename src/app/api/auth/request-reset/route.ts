import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

// In-memory store for OTPs (in production, use Redis or Firestore)
// We store in Firestore for persistence across serverless invocations
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }

        const admin = initializeFirebaseAdmin();
        const db = admin.firestore();

        // 1. Look up user by username (check both users and admins collections)
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username.toLowerCase().trim()).limit(1).get();

        let userData: any = null;

        if (!snapshot.empty) {
            userData = snapshot.docs[0].data();
        } else {
            // Fallback: check the admins collection
            const adminsRef = db.collection('admins');
            const adminSnapshot = await adminsRef.where('username', '==', username.toLowerCase().trim()).limit(1).get();

            if (!adminSnapshot.empty) {
                userData = adminSnapshot.docs[0].data();
            }
        }

        if (!userData) {
            return NextResponse.json({ success: false, error: 'Username not found' }, { status: 404 });
        }

        const userEmail = userData.email;
        const fullName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

        if (!userEmail) {
            return NextResponse.json({ success: false, error: 'No email associated with this account' }, { status: 404 });
        }

        // 2. Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        // 3. Store OTP in Firestore
        await db.collection('password_resets').doc(username.toLowerCase().trim()).set({
            otp,
            expiresAt,
            email: userEmail,
            uid: userData.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Send OTP email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        // Mask the email for display (e.g., w***f@gmail.com)
        const emailParts = userEmail.split('@');
        const maskedEmail = emailParts[0].charAt(0) + '***' + emailParts[0].slice(-1) + '@' + emailParts[1];

        const path = require('path');
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');

        await transporter.sendMail({
            from: `"DMU Burie Campus PMS" <${process.env.SMTP_EMAIL}>`,
            to: userEmail,
            subject: '🔐 Password Reset Verification Code',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #1e1b4b, #4338ca);padding:40px 40px;text-align:center;">
                            <img src="cid:dmulogo" alt="DMU Logo" style="width:80px;height:auto;margin-bottom:16px;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.2);background-color:#ffffff;padding:4px;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:0.5px;">
                                🔐 Password Reset
                            </h1>
                            <p style="margin:8px 0 0;color:#c7d2fe;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">
                                DMU Burie Campus PMS
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 40px 24px;">
                            <h2 style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:700;">
                                Hello, ${fullName}! 👋
                            </h2>
                            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                                We received a password reset request for your account (<strong>${username}</strong>). Use the secure verification code below to reset your password.
                            </p>

                            <!-- OTP Code -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                                <tr>
                                    <td align="center" style="padding:32px 24px;background:linear-gradient(to bottom, #f8fafc, #f1f5f9);border:2px dashed #818cf8;border-radius:12px;">
                                        <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Your Verification Code</p>
                                        <p style="margin:0;color:#4f46e5;font-size:42px;font-weight:800;letter-spacing:12px;font-family:'Courier New',Courier,monospace;">${otp}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:24px;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                                            <strong style="color:#d97706;">⏰ Expires in 10 minutes:</strong> For your security, this code is temporary. If you didn't request a password reset, you can safely ignore this email.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                            <p style="margin:0;color:#64748b;font-size:12px;">
                                &copy; ${new Date().getFullYear()} DMU Burie Campus. All rights reserved.
                            </p>
                            <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
                                This is an automated message from the Property Management System. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `,
            attachments: [
                {
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'dmulogo',
                    contentDisposition: 'inline',
                    contentType: 'image/png'
                }
            ]
        });

        return NextResponse.json({
            success: true,
            maskedEmail,
            message: `Verification code sent to ${maskedEmail}`,
        });

    } catch (error: any) {
        console.error('Error in request-reset API:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to send reset code'
        }, { status: 500 });
    }
}
