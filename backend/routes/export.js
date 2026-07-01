const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { buildFilters } = require('./messages');

const router = express.Router();

const COLUMNS = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Platform', key: 'platform_name', width: 18 },
  { header: 'Sender', key: 'sender_number', width: 14 },
  { header: 'Receiver Number', key: 'receiver_number', width: 18 },
  { header: 'Country', key: 'country_code', width: 10 },
  { header: 'OTP Code', key: 'otp_code', width: 12 },
  { header: 'Message', key: 'message_text', width: 40 },
  { header: 'Payout', key: 'payout', width: 10 },
  { header: 'Currency', key: 'currency', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Received At', key: 'received_at', width: 22 },
];

async function fetchFilteredRows(query) {
  const { where, params } = buildFilters(query);
  const sql = `
    SELECT id, platform_name, sender_number, receiver_number, country_code,
           otp_code, message_text, payout, currency, status, received_at
    FROM messages
    ${where}
    ORDER BY received_at DESC
    LIMIT 10000
  `;
  const result = await pool.query(sql, params);
  return result.rows;
}

// GET /api/export/excel?...filters
router.get('/excel', async (req, res) => {
  try {
    const rows = await fetchFilteredRows(req.query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IPRN SMS Panel';
    const sheet = workbook.addWorksheet('Messages');
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };

    rows.forEach((row) => {
      sheet.addRow({
        ...row,
        payout: Number(row.payout),
        received_at: new Date(row.received_at).toISOString().replace('T', ' ').slice(0, 19),
      });
    });

    const totalPayout = rows.reduce((sum, r) => sum + Number(r.payout), 0);
    const totalsRow = sheet.addRow({ message_text: 'TOTAL', payout: totalPayout });
    totalsRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="messages-export-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// GET /api/export/pdf?...filters
router.get('/pdf', async (req, res) => {
  try {
    const rows = await fetchFilteredRows(req.query);
    const totalPayout = rows.reduce((sum, r) => sum + Number(r.payout), 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="messages-export-${Date.now()}.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(16).text('IPRN SMS Panel - Messages Export', { align: 'left' });
    doc.fontSize(9).fillColor('#555').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000').text(`Total messages: ${rows.length}    Total payout: ${totalPayout.toFixed(4)}`);
    doc.moveDown(0.5);

    const colWidths = [30, 70, 60, 90, 60, 60, 180, 50, 80, 70];
    const headers = ['ID', 'Platform', 'Sender', 'Receiver', 'OTP', 'Payout', 'Message', 'Status', 'Received At', ''];
    let y = doc.y;
    let x = doc.x;

    function drawRow(values, isHeader) {
      doc.fontSize(8).fillColor(isHeader ? '#000' : '#222').font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
      let cx = x;
      values.forEach((val, idx) => {
        doc.text(String(val ?? ''), cx, y, { width: colWidths[idx] || 60, ellipsis: true });
        cx += colWidths[idx] || 60;
      });
      y += 16;
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = doc.y;
      }
    }

    drawRow(['ID', 'Platform', 'Sender', 'Receiver', 'OTP', 'Payout', 'Message', 'Status', 'Received At'], true);
    rows.forEach((r) => {
      drawRow([
        r.id,
        r.platform_name,
        r.sender_number,
        r.receiver_number,
        r.otp_code,
        Number(r.payout).toFixed(4),
        r.message_text,
        r.status,
        new Date(r.received_at).toISOString().slice(0, 19).replace('T', ' '),
      ]);
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
