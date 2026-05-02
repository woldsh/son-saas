import nodemailer from 'nodemailer';
import path from 'path';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

interface WelcomeEmailParams {
    to: string;
    fullName: string;
    username: string;
    password: string;
    role: string;
}

export async function sendWelcomeEmail({ to, fullName, username, password, role }: WelcomeEmailParams) {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');

    const mailOptions = {
        from: `"DMU Burie Campus PMS" <${process.env.SMTP_EMAIL}>`,
        to,
        subject: '🎉 Welcome to DMU Burie Campus Property Management System',
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
                                DMU Burie Campus
                            </h1>
                            <p style="margin:8px 0 0;color:#c7d2fe;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">
                                Property Management System
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 40px 24px;">
                            <h2 style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:700;">
                                Welcome, ${fullName}! 👋
                            </h2>
                            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                                Your account has been successfully created. Below are your secure login credentials to access the system.
                            </p>

                            <!-- Credentials Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
                                <tr>
                                    <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Username</p>
                                        <p style="margin:0;color:#0f172a;font-size:18px;font-weight:700;font-family:'Courier New',Courier,monospace;letter-spacing:1px;">${username}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Password</p>
                                        <p style="margin:0;color:#0f172a;font-size:18px;font-weight:700;font-family:'Courier New',Courier,monospace;letter-spacing:1px;">${password}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:20px 24px;">
                                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Assigned Role</p>
                                        <span style="display:inline-block;background-color:#e0e7ff;color:#4338ca;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;">
                                            ${role}
                                        </span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff1f2;border-left:4px solid #e11d48;border-radius:0 8px 8px 0;margin-bottom:24px;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="margin:0;color:#9f1239;font-size:13px;line-height:1.5;">
                                            <strong style="color:#e11d48;">⚠️ Security Notice:</strong> Please change your password immediately after your first login. Do not share these credentials with anyone.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">
                                If you have any questions, please contact the IT Systems Department or your system administrator.
                            </p>
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
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${to}`);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to send welcome email:', error);
        return { success: false, error: error.message };
    }
}
