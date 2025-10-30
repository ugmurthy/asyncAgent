import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const sendEmailInputSchema = z.object({
  to: z.string().email().describe('Recipient email address'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body content (plain text or HTML)'),
  cc: z.string().email().optional().describe('CC email address'),
  bcc: z.string().email().optional().describe('BCC email address'),
  html: z.boolean().optional().default(false).describe('Whether body is HTML (default: false)'),
});

type SendEmailInput = z.infer<typeof sendEmailInputSchema>;

interface SendEmailOutput {
  success: boolean;
  messageId?: string;
  to: string;
  subject: string;
  error?: string;
}

export class SendEmailTool extends BaseTool<SendEmailInput, SendEmailOutput> {
  name = 'sendEmail';
  description = 'Send an email via SMTP. Requires SMTP configuration in environment variables.';
  inputSchema = sendEmailInputSchema;

  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      throw new Error(
        'Email configuration missing. Required env vars: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM'
      );
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    return this.transporter;
  }

  async execute(input: SendEmailInput, ctx: ToolContext): Promise<SendEmailOutput> {
    ctx.logger.info(`Sending email to: ${input.to}`);

    try {
      const transporter = this.getTransporter();
      const from = process.env.SMTP_FROM!;

      const mailOptions: any = {
        from,
        to: input.to,
        subject: input.subject,
      };

      if (input.html) {
        mailOptions.html = input.body;
      } else {
        mailOptions.text = input.body;
      }

      if (input.cc) {
        mailOptions.cc = input.cc;
      }

      if (input.bcc) {
        mailOptions.bcc = input.bcc;
      }

      const result = await this.retry(
        async () => {
          return await this.withTimeout(
            transporter.sendMail(mailOptions),
            30000,
            'Email send timed out'
          );
        },
        3,
        2000
      );

      ctx.logger.info(`Email sent successfully. Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        to: input.to,
        subject: input.subject,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger.error('Email send failed:', error);

      return {
        success: false,
        to: input.to,
        subject: input.subject,
        error: errorMessage,
      };
    }
  }
}
