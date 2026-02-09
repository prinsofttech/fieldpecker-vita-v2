import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DailyMetrics, SummaryStats, UserActivity, RegionalPerformance, ModulePerformance } from './analytics-service';

export class ExportService {
  private createBar(value: number, maxValue: number): string {
    const percentage = Math.min((value / maxValue) * 100, 100);
    const filledBlocks = Math.round(percentage / 5);
    const emptyBlocks = 20 - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + ` ${percentage.toFixed(1)}%`;
  }
  exportToExcel(
    summaryStats: SummaryStats,
    dailyMetrics: DailyMetrics[],
    userActivity: UserActivity[],
    regionalPerformance: RegionalPerformance[],
    modulePerformance: ModulePerformance[],
    organizationName: string,
    logoUrl?: string
  ): void {
    const workbook = XLSX.utils.book_new();

    const summaryData = [
      ['📊 ANALYTICS SUMMARY REPORT'],
      [organizationName],
      ['Generated', new Date().toLocaleString()],
      logoUrl ? ['Organization Logo', logoUrl] : [],
      [''],
      ['Metric', 'Value', 'Visual'],
      ['Total Forms', summaryStats.totalForms, this.createBar(summaryStats.totalForms, 100)],
      ['Total Submissions', summaryStats.totalSubmissions, this.createBar(summaryStats.totalSubmissions, Math.max(summaryStats.totalSubmissions, 100))],
      ['Total Issues', summaryStats.totalIssues, this.createBar(summaryStats.totalIssues, 100)],
      ['Open Issues', summaryStats.openIssues, this.createBar(summaryStats.openIssues, summaryStats.totalIssues || 1)],
      ['Resolved Issues', summaryStats.resolvedIssues, this.createBar(summaryStats.resolvedIssues, summaryStats.totalIssues || 1)],
      ['Total Leads', summaryStats.totalLeads, this.createBar(summaryStats.totalLeads, 100)],
      ['Converted Leads', summaryStats.convertedLeads, this.createBar(summaryStats.convertedLeads, summaryStats.totalLeads || 1)],
      ['Total Customers', summaryStats.totalCustomers, this.createBar(summaryStats.totalCustomers, 100)],
      ['Active Users', summaryStats.activeUsers, this.createBar(summaryStats.activeUsers, 100)],
      [''],
      ['KEY METRICS', '', ''],
      ['Conversion Rate', `${summaryStats.conversionRate.toFixed(2)}%`, this.createBar(summaryStats.conversionRate, 100)],
      ['Resolution Rate', `${summaryStats.resolutionRate.toFixed(2)}%`, this.createBar(summaryStats.resolutionRate, 100)],
      ['Avg Submissions/Day', summaryStats.avgSubmissionsPerDay.toFixed(2), this.createBar(summaryStats.avgSubmissionsPerDay, 50)],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    summarySheet['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 40 }
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const maxDailyForms = Math.max(...dailyMetrics.map(m => m.formSubmissions), 1);
    const maxDailyIssues = Math.max(...dailyMetrics.map(m => m.issuesCreated), 1);

    const dailyData = [
      ['Date', 'Form Submissions', 'Trend', 'Issues Created', 'Trend', 'Issues Resolved', 'Leads Created', 'Leads Converted', 'Active Users'],
      ...dailyMetrics.map(m => [
        m.date,
        m.formSubmissions,
        this.createBar(m.formSubmissions, maxDailyForms),
        m.issuesCreated,
        this.createBar(m.issuesCreated, maxDailyIssues),
        m.issuesResolved,
        m.leadsCreated,
        m.leadsConverted,
        m.activeUsers,
      ])
    ];
    const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);

    dailySheet['!cols'] = [
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 13 },
      { wch: 15 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Metrics');

    const userData = [
      ['User Name', 'Email', 'Role', 'Form Submissions', 'Issues Created', 'Issues Resolved', 'Leads Created', 'Sessions', 'Active Time (min)', 'Last Active'],
      ...userActivity.map(u => [
        u.userName,
        u.email,
        u.role,
        u.formSubmissions,
        u.issuesCreated,
        u.issuesResolved,
        u.leadsCreated,
        u.sessionCount,
        u.totalActiveTime.toFixed(0),
        u.lastActive,
      ])
    ];
    const userSheet = XLSX.utils.aoa_to_sheet(userData);
    XLSX.utils.book_append_sheet(workbook, userSheet, 'User Activity');

    const regionalData = [
      ['Region', 'Form Submissions', 'Issues', 'Leads', 'Customers', 'Users'],
      ...regionalPerformance.map(r => [
        r.regionName,
        r.formSubmissions,
        r.issuesCount,
        r.leadsCount,
        r.customerCount,
        r.userCount,
      ])
    ];
    const regionalSheet = XLSX.utils.aoa_to_sheet(regionalData);
    XLSX.utils.book_append_sheet(workbook, regionalSheet, 'Regional Performance');

    const moduleData = [
      ['Module', 'Total Records', 'Active Records', 'Completed Records', 'Completion Rate (%)', 'Progress'],
      ...modulePerformance.map(m => [
        m.moduleName,
        m.totalRecords,
        m.activeRecords,
        m.completedRecords,
        m.completionRate.toFixed(2),
        this.createBar(m.completionRate, 100),
      ])
    ];
    const moduleSheet = XLSX.utils.aoa_to_sheet(moduleData);

    moduleSheet['!cols'] = [
      { wch: 15 },
      { wch: 13 },
      { wch: 13 },
      { wch: 16 },
      { wch: 18 },
      { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(workbook, moduleSheet, 'Module Performance');

    const fileName = `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  private drawBarChart(
    doc: jsPDF,
    data: Array<{ label: string; value: number }>,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string
  ): void {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barHeight = 8;
    const spacing = 3;
    const labelWidth = 60;
    const chartWidth = width - labelWidth - 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    data.forEach((item, index) => {
      const barWidth = (item.value / maxValue) * chartWidth;
      const currentY = y + (index * (barHeight + spacing));

      doc.setFillColor(1, 83, 36);
      doc.rect(x + labelWidth, currentY, barWidth, barHeight, 'F');

      doc.setDrawColor(200, 200, 200);
      doc.rect(x + labelWidth, currentY, chartWidth, barHeight, 'S');

      doc.text(item.label, x, currentY + 5);
      doc.text(item.value.toString(), x + labelWidth + chartWidth + 2, currentY + 5);
    });
  }

  private drawPieChart(
    doc: jsPDF,
    data: Array<{ label: string; value: number; color: string }>,
    x: number,
    y: number,
    radius: number,
    title: string
  ): void {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x - radius, y - radius - 5);

    let startAngle = -90;
    data.forEach((item) => {
      const sliceAngle = (item.value / total) * 360;
      const endAngle = startAngle + sliceAngle;

      const color = this.hexToRgb(item.color);
      doc.setFillColor(color.r, color.g, color.b);

      this.drawPieSlice(doc, x, y, radius, startAngle, endAngle);

      startAngle = endAngle;
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let legendY = y + radius + 10;
    data.forEach((item) => {
      const color = this.hexToRgb(item.color);
      doc.setFillColor(color.r, color.g, color.b);
      doc.rect(x - radius, legendY, 4, 4, 'F');
      doc.text(`${item.label}: ${item.value} (${((item.value / total) * 100).toFixed(1)}%)`, x - radius + 6, legendY + 3);
      legendY += 6;
    });
  }

  private drawPieSlice(doc: jsPDF, x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const steps = Math.max(10, Math.abs(endAngle - startAngle) / 2);

    doc.moveTo(x, y);
    for (let i = 0; i <= steps; i++) {
      const angle = startRad + (i / steps) * (endRad - startRad);
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) {
        doc.lineTo(px, py);
      } else {
        doc.lineTo(px, py);
      }
    }
    doc.lineTo(x, y);
    doc.fill();
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private drawLineChart(
    doc: jsPDF,
    data: Array<{ label: string; value: number }>,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string
  ): void {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const chartHeight = height - 15;
    const stepX = width / (data.length - 1 || 1);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x, y);
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, width, chartHeight, 'S');

    doc.setDrawColor(1, 83, 36);
    doc.setLineWidth(1);

    data.forEach((point, index) => {
      const px = x + index * stepX;
      const py = y + chartHeight - (point.value / maxValue) * chartHeight;

      if (index === 0) {
        doc.moveTo(px, py);
      } else {
        doc.lineTo(px, py);
      }

      doc.setFillColor(1, 83, 36);
      doc.circle(px, py, 1.5, 'F');
    });
    doc.stroke();

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    data.forEach((point, index) => {
      if (index % Math.ceil(data.length / 6) === 0) {
        const px = x + index * stepX;
        doc.text(point.label, px - 5, y + chartHeight + 5);
      }
    });
  }

  private async loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  async exportToPDF(
    summaryStats: SummaryStats,
    dailyMetrics: DailyMetrics[],
    userActivity: UserActivity[],
    regionalPerformance: RegionalPerformance[],
    modulePerformance: ModulePerformance[],
    organizationName: string,
    logoUrl?: string
  ): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Add logo if available
    if (logoUrl) {
      try {
        const imageData = await this.loadImage(logoUrl);
        doc.addImage(imageData, 'PNG', pageWidth / 2 - 15, yPosition, 30, 30);
        yPosition += 35;
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Analytics Report', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(organizationName, pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 5;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: [
        ['Total Forms', summaryStats.totalForms.toString()],
        ['Total Submissions', summaryStats.totalSubmissions.toString()],
        ['Total Issues', summaryStats.totalIssues.toString()],
        ['Open Issues', summaryStats.openIssues.toString()],
        ['Resolved Issues', summaryStats.resolvedIssues.toString()],
        ['Total Leads', summaryStats.totalLeads.toString()],
        ['Converted Leads', summaryStats.convertedLeads.toString()],
        ['Total Customers', summaryStats.totalCustomers.toString()],
        ['Active Users', summaryStats.activeUsers.toString()],
        ['Conversion Rate', `${summaryStats.conversionRate.toFixed(2)}%`],
        ['Resolution Rate', `${summaryStats.resolutionRate.toFixed(2)}%`],
        ['Avg Submissions/Day', summaryStats.avgSubmissionsPerDay.toFixed(2)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [1, 83, 36], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    yPosition = 20;

    this.drawLineChart(
      doc,
      dailyMetrics.slice(-14).map(m => ({
        label: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: m.formSubmissions
      })),
      14,
      yPosition,
      pageWidth - 28,
      60,
      'Form Submissions Trend (Last 14 Days)'
    );

    yPosition += 75;

    this.drawBarChart(
      doc,
      modulePerformance.map(m => ({
        label: m.moduleName,
        value: m.completionRate
      })),
      14,
      yPosition,
      pageWidth - 28,
      50,
      'Module Completion Rates (%)'
    );

    yPosition += modulePerformance.length * 11 + 20;

    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    this.drawPieChart(
      doc,
      [
        { label: 'Open Issues', value: summaryStats.openIssues, color: '#ef4444' },
        { label: 'Resolved Issues', value: summaryStats.resolvedIssues, color: '#10b981' }
      ],
      50,
      yPosition + 30,
      25,
      'Issue Status Distribution'
    );

    this.drawPieChart(
      doc,
      [
        { label: 'Active Leads', value: summaryStats.totalLeads - summaryStats.convertedLeads, color: '#f59e0b' },
        { label: 'Converted Leads', value: summaryStats.convertedLeads, color: '#10b981' }
      ],
      140,
      yPosition + 30,
      25,
      'Lead Conversion Distribution'
    );

    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Module Performance', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Module', 'Total', 'Active', 'Completed', 'Rate (%)']],
      body: modulePerformance.map(m => [
        m.moduleName,
        m.totalRecords.toString(),
        m.activeRecords.toString(),
        m.completedRecords.toString(),
        m.completionRate.toFixed(2),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [1, 83, 36], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    const lastTable = (doc as any).lastAutoTable;
    yPosition = lastTable.finalY + 15;

    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Regional Performance', 14, yPosition);
    yPosition += 5;

    if (regionalPerformance.length > 0) {
      this.drawBarChart(
        doc,
        regionalPerformance.slice(0, 8).map(r => ({
          label: r.regionName.substring(0, 15),
          value: r.formSubmissions + r.issuesCount + r.leadsCount
        })),
        14,
        yPosition + 5,
        pageWidth - 28,
        Math.min(regionalPerformance.length, 8) * 11 + 15,
        'Total Activity by Region'
      );

      yPosition += Math.min(regionalPerformance.length, 8) * 11 + 25;
    }

    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    autoTable(doc, {
      startY: yPosition,
      head: [['Region', 'Forms', 'Issues', 'Leads', 'Customers', 'Users']],
      body: regionalPerformance.slice(0, 10).map(r => [
        r.regionName,
        r.formSubmissions.toString(),
        r.issuesCount.toString(),
        r.leadsCount.toString(),
        r.customerCount.toString(),
        r.userCount.toString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [1, 83, 36], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top User Activity', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['User', 'Role', 'Forms', 'Issues', 'Leads', 'Sessions']],
      body: userActivity.slice(0, 20).map(u => [
        u.userName,
        u.role,
        u.formSubmissions.toString(),
        u.issuesCreated.toString(),
        u.leadsCreated.toString(),
        u.sessionCount.toString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [1, 83, 36], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Metrics (Last 30 Days)', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Date', 'Forms', 'Issues Created', 'Issues Resolved', 'Leads']],
      body: dailyMetrics.slice(-30).map(m => [
        m.date,
        m.formSubmissions.toString(),
        m.issuesCreated.toString(),
        m.issuesResolved.toString(),
        m.leadsCreated.toString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [1, 83, 36], textColor: 255 },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
    });

    const fileName = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
}

export const exportService = new ExportService();
