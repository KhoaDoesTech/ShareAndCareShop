const nodemailer = require('nodemailer');
const logger = require('./logger.helper');
const Mailgen = require('mailgen');
const { OAuth2Client } = require('google-auth-library');
const { InternalServerError } = require('../utils/errorResponse');

class EmailHelper {
  constructor() {
    this.mailGenerator = this.createMailGenerator();
    this.transporter = this.createTransporter();
  }

  createMailGenerator() {
    return new Mailgen({
      theme: 'default',
      product: {
        name: 'Share And Care',
        link: process.env.FRONTEND_URL,
      },
    });
  }

  createTransporter() {
    const myOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_MAILER_CLIENT_ID,
      process.env.GOOGLE_MAILER_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground/'
    );

    myOAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_MAILER_REFRESH_TOKEN,
    });

    const myAccessTokenObject = myOAuth2Client.getAccessToken();

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GOOGLE_MAILER_USER,
        clientId: process.env.GOOGLE_MAILER_CLIENT_ID,
        clientSecret: process.env.GOOGLE_MAILER_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_MAILER_REFRESH_TOKEN,
        accessToken: myAccessTokenObject.token,
      },
    });
  }

  async sendEmail({ to, subject, templateContent }) {
    const text = this.mailGenerator.generatePlaintext(templateContent);
    const html = this.mailGenerator.generate(templateContent);

    const mailOptions = {
      from: `"ShareAndCare" <${process.env.GOOGLE_MAILER_USER}>`,
      to,
      subject,
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Đã gửi email tới ${to}`);
    } catch (error) {
      logger.error('Gửi email thất bại:', error);
      throw new InternalServerError('Gửi email thất bại');
    }
  }

  async sendVerificationEmail(username, email, verificationUrl) {
    const content = {
      body: {
        name: username,
        intro:
          'Chào mừng bạn đến với Share And Care! Chúng tôi rất vui khi bạn tham gia.',
        action: {
          instructions: 'Để xác thực email, vui lòng nhấn vào nút bên dưới:',
          button: {
            color: '#22BC66',
            text: 'Xác thực email',
            link: verificationUrl,
          },
        },
        outro:
          'Nếu bạn cần hỗ trợ hoặc có thắc mắc, chỉ cần trả lời email này. Chúng tôi luôn sẵn sàng giúp đỡ.',
      },
    };

    await this.sendEmail({
      to: email,
      subject: 'Xác thực địa chỉ email',
      templateContent: content,
    });
  }

  async sendForgotPasswordEmail(username, email, resetUrl) {
    const content = {
      body: {
        name: username,
        intro:
          'Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.',
        action: {
          instructions: 'Để đặt lại mật khẩu, vui lòng nhấn vào nút bên dưới:',
          button: {
            color: '#DC4D2F',
            text: 'Đặt lại mật khẩu',
            link: resetUrl,
          },
        },
        outro:
          'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.',
      },
    };

    await this.sendEmail({
      to: email,
      subject: 'Yêu cầu đặt lại mật khẩu',
      templateContent: content,
    });
  }
}

module.exports = EmailHelper;
