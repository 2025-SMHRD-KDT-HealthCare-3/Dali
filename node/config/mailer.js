/*
 * mailer - nodemailer Gmail SMTP 설정
 * - sendPasswordResetEmail : 비밀번호 재설정 링크 이메일 발송
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from: `"달리(Dali)" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: '[달리] 비밀번호 재설정 안내',
    html: `
      <p>안녕하세요, 달리입니다.</p>
      <p>아래 버튼을 클릭하면 비밀번호를 재설정할 수 있습니다.</p>
      <p>링크는 <strong>10분</strong> 후 만료됩니다.</p>
      <br/>
      <a href="${resetUrl}" style="
        display: inline-block;
        padding: 12px 24px;
        background-color: #4F46E5;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">비밀번호 재설정하기</a>
      <br/><br/>
      <p>본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
