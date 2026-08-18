import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExpenseData {
  date: string;
  limit: number;
  spent: number;
  saved: number;
  note: string;
}

export function exportToExcel(expenses: ExpenseData[], monthStr: string, monthlyBudget: number) {
  const summary = expenses.reduce((acc, curr) => {
    acc.totalSpent += curr.spent;
    acc.totalSaved += curr.saved;
    acc.totalLimit += curr.limit;
    return acc;
  }, { totalSpent: 0, totalSaved: 0, totalLimit: 0 });

  const rows = expenses.map(e => ({
    'Date': format(new Date(e.date), 'dd MMM yyyy'),
    'Limit (₹)': e.limit,
    'Spent (₹)': e.spent,
    'Saved (₹)': e.saved,
    'Note': e.note
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Add summary rows at the bottom
  const summaryData = [
    [],
    ['SUMMARY'],
    ['Total Budget', monthlyBudget],
    ['Total Spent', summary.totalSpent],
    ['Total Saved', summary.totalSaved],
    ['Remaining Budget', monthlyBudget - summary.totalSpent],
  ];

  XLSX.utils.sheet_add_aoa(ws, summaryData, { origin: -1 });

  // Set column widths
  const wscols = [
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
  ];
  ws['!cols'] = wscols;

  // Create workbook and append worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

  // Generate binary string
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

  // Function to convert binary string to octet array
  function s2ab(s: string) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
  }

  // Create Blob and trigger download
  const buffer = s2ab(wbout);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `Expense-${format(new Date(monthStr + "-01"), 'MMMM-yyyy')}.xlsx`;

  // WebView Detection
  const isAndroidWebView = typeof navigator !== 'undefined' && navigator.userAgent.includes('EXPENSER_ANDROID_WEBVIEW');

  if (isAndroidWebView && (window as any).Android) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      (window as any).Android.downloadBase64File(base64, blob.type, fileName);
    };
    reader.readAsDataURL(blob);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
