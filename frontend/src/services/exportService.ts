/**
 * Tessera Export Service
 *
 * Provides real, structured CSV and JSON exports via client-side Blob generation.
 */

export const exportService = {
  /**
   * Export an array of objects or records to a downloaded CSV file
   */
  exportToCsv(filename: string, headers: { key: string; label: string }[], rows: Record<string, unknown>[]): void {
    const csvRows: string[] = [];

    // Header line
    csvRows.push(headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(','));

    // Data rows
    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  },

  /**
   * Export any JSON-serializable dataset to a downloaded JSON file
   */
  exportToJson(filename: string, data: unknown): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    this.triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
  },

  /**
   * Browser file download helper
   */
  triggerDownload(blob: Blob, fullFilename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fullFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
