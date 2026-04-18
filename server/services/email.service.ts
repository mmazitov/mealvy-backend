import nodemailer from 'nodemailer';
import { config } from '../shared/config.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

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
    
    const templatePath = join(__dirname, '../templates/family-invitation.html');
    let html = await readFile(templatePath, 'utf-8');
    
    html = html
      .replace(/{{inviterName}}/g, inviterName)
      .replace(/{{invitationLink}}/g, invitationLink);

    return this.sendEmail({
      to: inviteeEmail,
      subject,
      html,
    });
  }
}
