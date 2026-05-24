import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = (formData.get('file') || formData.get('image')) as File | null;
        const folder = formData.get('folder') as string || 'uploads';

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        const admin = initializeFirebaseAdmin();
        let bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'property-management-syst-b635b.appspot.com';
        
        // Google Cloud Storage SDK requires the raw bucket name, which is .appspot.com
        // .firebasestorage.app is just an alias for client SDKs.
        if (bucketName.endsWith('.firebasestorage.app')) {
            bucketName = bucketName.replace('.firebasestorage.app', '.appspot.com');
        }

        const bucket = admin.storage().bucket(bucketName);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileExtension = file.name.split('.').pop() || 'file';
        const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        
        const fileUpload = bucket.file(fileName);
        const uuid = crypto.randomUUID();

        // Upload to Firebase Storage via Admin SDK (Bypasses rules and CORS)
        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type || 'application/octet-stream',
                metadata: {
                    firebaseStorageDownloadTokens: uuid,
                }
            }
        });

        // Construct the permanent Firebase Storage download URL
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${uuid}`;

        return NextResponse.json({
            success: true,
            data: {
                url: publicUrl,
                publicId: fileName,
                format: fileExtension,
            }
        });

    } catch (error: any) {
        console.error('Firebase Admin Storage upload error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Server upload failed',
            details: error
        }, { status: 500 });
    }
}
