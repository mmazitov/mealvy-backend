import nodemailer from 'nodemailer';
import { config } from '../shared/config.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const FAMILY_INVITATION_TEMPLATE = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #e05a29; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #e05a29; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Запрошення до сім'ї</h1>
      </div>
      <div class="content">
        <p>Привіт!</p>
        <p><strong>{{inviterName}}</strong> запрошує вас приєднатися до їхньої сім'ї в Mealvy.</p>
        <p>Після прийняття запрошення ви зможете:</p>
        <ul>
          <li>📅 Переглядати спільні меню</li>
          <li>🍳 Додавати страви до сімейних планів</li>
          <li>🛒 Створювати списки покупок разом</li>
        </ul>
        <p style="text-align: center;">
          <a href="{{invitationLink}}" class="button">Прийняти запрошення</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          Запрошення дійсне протягом 7 днів.
        </p>
      </div>
      <div class="footer">
        <p>Це автоматичне повідомлення від Mealvy</p>
        <p>Якщо ви не очікували цього листа, просто проігноруйте його.</p>
      </div>
    </div>
  </body>
</html>`;

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });

  static async sendEmail({ to, subject, html }: SendEmailParams) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
        to,
        subject,
        html,
      });

      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error };
    }
  }

  static async sendFamilyInvitation(
    inviteeEmail: string,
    inviterName: string,
    invitationLink: string,
  ) {
    const subject = `${inviterName} запрошує вас до сім'ї в Mealvy`;
    
    const html = FAMILY_INVITATION_TEMPLATE
      .replace(/{{inviterName}}/g, inviterName)
      .replace(/{{invitationLink}}/g, invitationLink);

    return this.sendEmail({
      to: inviteeEmail,
      subject,
      html,
    });
  }
}
