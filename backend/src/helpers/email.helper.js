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
      logger.info(`Email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new InternalServerError('Error while sending email');
    }
  }

  async sendVerificationEmail(username, email, verificationUrl) {
    const content = {
      body: {
        name: username,
        intro: "Welcome to our app! We're very excited to have you on board.",
        action: {
          instructions:
            'To verify your email please click on the following button:',
          button: {
            color: '#22BC66', // Optional action button color
            text: 'Verify your email',
            link: verificationUrl,
          },
        },
        outro:
          "Need help, or have questions? Just reply to this email, we'd love to help.",
      },
    };

    await this.sendEmail({
      to: email,
      subject: 'Please verify your email',
      templateContent: content,
    });
  }

  async sendForgotPasswordEmail(username, email, resetUrl) {
    const content = {
      body: {
        name: username,
        intro:
          'You have received this email because a password reset request for your account was received.',
        action: {
          instructions:
            'To reset your password, please click on the following button:',
          button: {
            color: '#DC4D2F',
            text: 'Reset your password',
            link: resetUrl,
          },
        },
        outro:
          'If you did not request a password reset, no further action is required on your part.',
      },
    };

    await this.sendEmail({
      to: email,
      subject: 'Password reset request',
      templateContent: content,
    });
  }
}

module.exports = EmailHelper;
