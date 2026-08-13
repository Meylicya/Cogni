import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

export const sendPatientInviteEmail = async (toEmail, patientName, inviteToken) => {
  const inviteUrl = `http://localhost:5173/invite/${inviteToken}`;

  const mailOptions = {
    from: `"Cogni Rehab" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'You have been invited to Cogni Rehabilitation',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #1E3A4C;">
        <h2 style="color: #1E3A4C;">Welcome to Cogni, ${patientName}!</h2>
        <p>Your clinician has invited you to set up your cognitive rehabilitation dashboard.</p>
        <p>Click the secure link below to create your password and get started:</p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; background-color: #1E3A4C; color: #fff; text-decoration: none; border-radius: 5px;">
          Complete Account Setup
        </a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};