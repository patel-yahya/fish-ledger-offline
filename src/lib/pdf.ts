import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Fisherman, type Pass, type PassItem, type Transaction } from './database';
import { formatINR, formatDate } from './format';

export function generatePDF(
  fisherman: Fisherman,
  passes: Pass[],
  passItemsMap: Record<number, PassItem[]>,
  transactions: Transaction[]
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Chand Fish Ledger', 14, 20);
  doc.setFontSize(12);
  doc.text('Account Statement (Hisaab)', 14, 28);

  // Fisherman info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${fisherman.name}`, 14, 40);
  doc.text(`Village: ${fisherman.village || '-'}`, 14, 46);
  doc.text(`Phone: ${fisherman.phone || '-'}`, 14, 52);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 60, 40);

  const balance = fisherman.running_balance;
  doc.setFont('helvetica', 'bold');
  doc.text(`Current Balance: ${formatINR(balance)} (${balance > 0 ? 'Debt' : balance < 0 ? 'Credit' : 'Settled'})`, 14, 62);

  // Passes table
  let y = 72;
  if (passes.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Passes', 14, y);
    y += 4;

    const passRows: any[][] = [];
    for (const p of passes) {
      const items = passItemsMap[p.id] || [];
      const itemStr = items.map(i => `${i.species_name}: ${i.quantity} ${i.unit}${i.price_per_unit ? ` @${formatINR(i.price_per_unit)}` : ''}`).join(', ');
      const total = items.reduce((s, i) => s + i.total, 0);
      passRows.push([p.pass_id, formatDate(p.date), p.status, itemStr, total > 0 ? formatINR(total) : '-']);
    }

    autoTable(doc, {
      startY: y,
      head: [['Pass ID', 'Date', 'Status', 'Items', 'Total']],
      body: passRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 80, 110] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Transactions table
  if (transactions.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Transactions', 14, y);
    y += 4;

    const txRows = transactions.map(t => [
      formatDate(t.date), formatINR(t.total_fish_value), formatINR(t.cash_paid),
      formatINR(t.old_balance), formatINR(t.new_balance), t.notes || ''
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Fish Value', 'Cash Paid', 'Old Bal', 'New Bal', 'Notes']],
      body: txRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 80, 110] },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`Hisaab_${fisherman.name}_${new Date().toISOString().split('T')[0]}.pdf`);
}
