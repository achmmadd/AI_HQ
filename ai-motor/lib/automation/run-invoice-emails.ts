import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

type InvoiceRow = {
  id: number;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  invoice_number: string;
  line_items_json: string | null;
};

function buildInvoicePdf(inv: InvoiceRow): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Factuur", { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`Factuurnummer: ${inv.invoice_number}`);
    doc.text(`Klant: ${inv.customer_name}`);
    doc.text(`E-mail: ${inv.customer_email}`);
    doc.moveDown();
    const amount = (inv.amount_cents / 100).toFixed(2);
    doc.text(`Totaal: € ${amount}`, { align: "left" });
    if (inv.line_items_json) {
      doc.moveDown();
      doc.fontSize(9).text("Regels:", { underline: true });
      doc.text(inv.line_items_json.slice(0, 2000));
    }
    doc.end();
  });
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function runInvoiceEmails(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const transport = getSmtpTransport();
  if (!transport) {
    return {
      ok: false,
      detail:
        "SMTP niet geconfigureerd (SMTP_HOST, SMTP_USER, SMTP_PASS[, SMTP_PORT]).",
    };
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER;
  if (!from) {
    return { ok: false, detail: "SMTP_FROM of SMTP_USER vereist als afzender." };
  }

  const pending = db
    .prepare(
      `SELECT id, customer_name, customer_email, amount_cents, invoice_number, line_items_json
       FROM automation_invoices
       WHERE status = 'invoiced_pending'
       ORDER BY id ASC
       LIMIT 25`
    )
    .all() as InvoiceRow[];

  if (pending.length === 0) {
    return { ok: true, detail: "Geen facturen met status invoiced_pending." };
  }

  const upd = db.prepare(
    `UPDATE automation_invoices
     SET status = 'invoiced_sent', sent_at = datetime('now')
     WHERE id = ?`
  );

  let sent = 0;
  const errors: string[] = [];

  for (const inv of pending) {
    try {
      const pdf = await buildInvoicePdf(inv);
      const amount = (inv.amount_cents / 100).toFixed(2);
      await transport.sendMail({
        from,
        to: inv.customer_email,
        subject: `Factuur ${inv.invoice_number}`,
        text: `Beste ${inv.customer_name},\n\nHierbij factuur ${inv.invoice_number} voor € ${amount}.\n\nMet vriendelijke groet`,
        html: `<p>Beste ${inv.customer_name},</p><p>Hierbij factuur <strong>${inv.invoice_number}</strong> voor € ${amount}.</p>`,
        attachments: [
          {
            filename: `factuur-${inv.invoice_number}.pdf`,
            content: pdf,
          },
        ],
      });
      upd.run(inv.id);
      sent += 1;
    } catch (e) {
      errors.push(
        `${inv.invoice_number}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (sent > 0) {
    void sendTelegramMessage(`📧 ${sent} facturen verstuurd`);
  }

  const detail =
    `Facturen: ${sent} verstuurd, ${errors.length} fout(en).` +
    (errors.length ? ` ${errors.join("; ")}` : "");

  return { ok: errors.length === 0, detail };
}
