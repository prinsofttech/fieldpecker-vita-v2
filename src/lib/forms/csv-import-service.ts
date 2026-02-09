import { supabase } from '../supabase/client';

export interface CSVRow {
  [key: string]: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  duplicates: Array<{ row: number; agent_code: string; cycle: number }>;
}

export interface ProgressUpdate {
  progress: number;
  currentBatch: number;
  totalBatches: number;
  processedRows: number;
  totalRows: number;
  currentSuccess: number;
  currentErrors: number;
  currentSkipped: number;
  message: string;
}

export interface PreviewData {
  headers: string[];
  rows: CSVRow[];
  mappedRows: Array<{
    agent_code: string;
    cycle_number: number;
    supervisor_code: string;
    submission_data: any;
    status: string;
  }>;
}

const FIELD_MAPPING: { [key: string]: string } = {
  'Paper rolls delivered?': 'field_1767077946750',
  'Transaction registers delivered': 'field_1767083181197',
  'Posters delivered': 'field_1767083181749',
  'Light branding delivered': 'field_1767083182261',
  'Normal Supervision': 'field_1767083182973',
  'Engagement Report': 'field_1767083182645',
  'Agent Active?': 'field_1767083183310',
  'Outlet Open?': 'field_1767083183678',
  'Agent At Same Location': 'field_1767083184006',
  'Handlers Name': 'field_1767083184286',
  'Handlers Contact': 'field_1767083184573',
  'Has ABS Board': 'field_1767083184879',
  'Has Agent Number Sticker': 'field_1767083185190',
  'Has Agent Helpline number': 'field_1767083185573',
  'Has Tarriff guide': 'field_1767083185965',
  'Are records well maintained': 'field_1767083186470',
  'Is the Transaction register signed': 'field_1767083186893',
  'POS statement and transactions matching': 'field_1767083187309',
  'Devices available and working': 'field_1767083187654',
  'Operator well Trained': 'field_1767083188062',
  'Customer Information handled securely': 'field_1767083188526',
  'Recorded as per bank regulations': 'field_1767083188957',
  'Is NIN recorded': 'field_1767083189485',
  'Has Valid Trading License': 'field_1767083190109',
  'Unresolved claims': 'field_1767083190702',
  'Is Outlet clean & secure': 'field_1767083194046',
  'Agent has regulatory posters': 'field_1767083194629',
  'Agent has receipt rolls': 'field_1767083195253',
  'Agent has a transaction register': 'field_1767083196013',
  'Date of POS Last Transaction': 'field_1767083197878',
  'Date of Registor Book Last Transaction': 'field_1767083200327',
  'Agent business location': 'field_1770163307666',
  'Gender of operator': 'field_1770163309609',
  'Received a Naaki Copy?': 'field_1770160606623',
  'Rate of the Comic Book': 'field_1770160610531',
  'How often to receive a copy of Naaki': 'field_1770160735058',
  'Content You want to see In Naaki?': 'field_1770160736700',
  'Have PDP Certificate?': 'field_1770160737730'
};

const FORM_ID = 'd27d1417-92fe-4fca-aa9f-94fabc879688';

export class CSVImportService {
  static parseCSV(csvText: string): CSVRow[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  static validateCSV(rows: CSVRow[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (rows.length === 0) {
      errors.push('CSV file is empty');
      return { valid: false, errors };
    }

    const requiredColumns = ['Terminal ID', 'Submitted On', 'Visit', 'Emp. code'];
    const headers = Object.keys(rows[0]);

    requiredColumns.forEach(col => {
      if (!headers.includes(col)) {
        errors.push(`Missing required column: ${col}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  static normalizeRadioValue(value: string): string | null {
    if (!value) return null;
    const lower = value.toLowerCase().trim();
    if (lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1') return 'Yes';
    if (lower === 'no' || lower === 'n' || lower === 'false' || lower === '0') return 'No';
    if (lower === 'unable to determine' || lower === 'unknown' || lower === 'n/a') return 'Unable to Determine';
    return value;
  }

  static convertDateFormat(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;

    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateStr;
  }

  static parseTimestamp(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;

    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return new Date(`${year}-${month}-${day}`).toISOString();
        }
      }

      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      console.error('Error parsing timestamp:', e);
    }

    return null;
  }

  static buildSubmissionData(row: CSVRow): any {
    const submissionData: any = {};

    Object.entries(FIELD_MAPPING).forEach(([csvColumn, fieldId]) => {
      let value = row[csvColumn];

      if (!value || value.trim() === '') {
        return;
      }

      if (csvColumn.includes('Date of POS') || csvColumn.includes('Date of Registor')) {
        value = this.convertDateFormat(value) || value;
      } else if (
        csvColumn.includes('?') ||
        csvColumn.includes('Active') ||
        csvColumn.includes('Open') ||
        csvColumn.includes('Same Location') ||
        csvColumn.includes('Normal Supervision')
      ) {
        value = this.normalizeRadioValue(value) || value;
      } else if (
        csvColumn === 'Paper rolls delivered?' ||
        csvColumn === 'Transaction registers delivered' ||
        csvColumn === 'Posters delivered' ||
        csvColumn === 'Light branding delivered' ||
        csvColumn === 'Rate of the Comic Book'
      ) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          value = num.toString();
        }
      }

      submissionData[fieldId] = value;
    });

    if (row['Region']) submissionData['_region'] = row['Region'];
    if (row['Branch']) submissionData['_branch'] = row['Branch'];
    if (row['Agent Name']) submissionData['_agent_name'] = row['Agent Name'];

    return submissionData;
  }

  static async getAgentIdByCode(agentCode: string, orgId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', agentCode)
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) {
        console.error('Error looking up agent:', error);
        return null;
      }

      return data?.id || null;
    } catch (e) {
      console.error('Exception looking up agent:', e);
      return null;
    }
  }

  static async getUserIdBySupervisorCode(supervisorCode: string, orgId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('supervisor_code', supervisorCode)
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) {
        console.error('Error looking up supervisor:', error);
        return null;
      }

      return data?.id || null;
    } catch (e) {
      console.error('Exception looking up supervisor:', e);
      return null;
    }
  }

  static async checkDuplicate(
    agentId: string,
    cycleNumber: number,
    formId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('cycle_number', cycleNumber)
        .eq('form_id', formId)
        .limit(1);

      if (error) {
        console.error('Error checking duplicate:', error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (e) {
      console.error('Exception checking duplicate:', e);
      return false;
    }
  }

  static async previewImport(csvText: string, orgId: string): Promise<PreviewData> {
    const rows = this.parseCSV(csvText);
    const previewRows = rows.slice(0, 5);

    const mappedRows = await Promise.all(
      previewRows.map(async (row) => {
        const agentCode = row['Terminal ID'];
        const cycleNumber = parseInt(row['Visit']) || 1;
        const supervisorCode = row['Emp. code'];
        const approvedVal = row['approved']?.toLowerCase().trim();
        const status = approvedVal === 'true' ? 'approved' : 'pending';

        return {
          agent_code: agentCode,
          cycle_number: cycleNumber,
          supervisor_code: supervisorCode,
          submission_data: this.buildSubmissionData(row),
          status
        };
      })
    );

    return {
      headers: Object.keys(rows[0] || {}),
      rows: previewRows,
      mappedRows
    };
  }

  static async importCSV(csvText: string, orgId: string, onProgress?: (update: ProgressUpdate) => void): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errors: [],
      duplicates: []
    };

    try {
      const rows = this.parseCSV(csvText);
      result.totalRows = rows.length;

      const validation = this.validateCSV(rows);
      if (!validation.valid) {
        result.success = false;
        validation.errors.forEach((error, index) => {
          result.errors.push({ row: 0, error });
        });
        return result;
      }

      if (onProgress) {
        onProgress({
          progress: 5,
          currentBatch: 0,
          totalBatches: 1,
          processedRows: 0,
          totalRows: rows.length,
          currentSuccess: 0,
          currentErrors: 0,
          currentSkipped: 0,
          message: 'Loading agent and supervisor data...'
        });
      }

      const agentCodes = [...new Set(rows.map(r => r['Terminal ID']).filter(Boolean))];
      const supervisorCodes = [...new Set(rows.map(r => r['Emp. code']).filter(Boolean))];

      const LOOKUP_CHUNK_SIZE = 500;
      const agentMap = new Map<string, string>();
      const supervisorMap = new Map<string, string>();

      for (let i = 0; i < agentCodes.length; i += LOOKUP_CHUNK_SIZE) {
        const chunk = agentCodes.slice(i, i + LOOKUP_CHUNK_SIZE);
        const { data } = await supabase
          .from('customers')
          .select('id, customer_code')
          .eq('org_id', orgId)
          .in('customer_code', chunk);

        (data || []).forEach(agent => {
          agentMap.set(agent.customer_code, agent.id);
        });
      }

      for (let i = 0; i < supervisorCodes.length; i += LOOKUP_CHUNK_SIZE) {
        const chunk = supervisorCodes.slice(i, i + LOOKUP_CHUNK_SIZE);
        const { data } = await supabase
          .from('users')
          .select('id, supervisor_code')
          .eq('org_id', orgId)
          .in('supervisor_code', chunk);

        (data || []).forEach(user => {
          if (user.supervisor_code) {
            supervisorMap.set(user.supervisor_code, user.id);
          }
        });
      }

      if (onProgress) {
        onProgress({
          progress: 10,
          currentBatch: 0,
          totalBatches: 1,
          processedRows: 0,
          totalRows: rows.length,
          currentSuccess: 0,
          currentErrors: 0,
          currentSkipped: 0,
          message: 'Checking for existing submissions...'
        });
      }

      const agentIds = Array.from(agentMap.values());
      const duplicateSet = new Set<string>();

      for (let i = 0; i < agentIds.length; i += LOOKUP_CHUNK_SIZE) {
        const chunk = agentIds.slice(i, i + LOOKUP_CHUNK_SIZE);
        const { data } = await supabase
          .from('form_submissions')
          .select('agent_id, cycle_number, submitted_at')
          .eq('form_id', FORM_ID)
          .in('agent_id', chunk);

        (data || []).forEach(sub => {
          const month = sub.submitted_at ? sub.submitted_at.substring(0, 7) : 'unknown';
          duplicateSet.add(`${sub.agent_id}_${sub.cycle_number}_${month}`);
        });
      }

      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      console.log(`Starting import of ${rows.length} rows in ${totalBatches} batches of ${BATCH_SIZE}`);

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        const recordsToInsert: any[] = [];

        for (let j = 0; j < batch.length; j++) {
          const rowIndex = i + j + 2;
          const row = batch[j];

          try {
            const agentCode = row['Terminal ID'];
            const cycleNumber = parseInt(row['Visit']) || 1;
            const supervisorCode = row['Emp. code'];
            const approvedVal = row['approved']?.toLowerCase().trim();
            const importStatus = approvedVal === 'true' ? 'approved' : 'pending';
            const latitude = parseFloat(row['latitude']) || null;
            const longitude = parseFloat(row['longitude']) || null;
            const submittedOn = this.parseTimestamp(row['Submitted On'] || row['created_at']);

            if (!agentCode || !supervisorCode) {
              result.errors.push({
                row: rowIndex,
                error: 'Missing Terminal ID or Emp. code',
                data: { agentCode, supervisorCode }
              });
              result.errorCount++;
              continue;
            }

            const agentId = agentMap.get(agentCode);
            const submittedBy = supervisorMap.get(supervisorCode);

            if (!agentId) {
              result.errors.push({
                row: rowIndex,
                error: `Agent not found for code: ${agentCode}`,
                data: { agentCode }
              });
              result.errorCount++;
              continue;
            }

            const submissionMonth = submittedOn ? submittedOn.substring(0, 7) : new Date().toISOString().substring(0, 7);
            const duplicateKey = `${agentId}_${cycleNumber}_${submissionMonth}`;
            if (duplicateSet.has(duplicateKey)) {
              result.duplicates.push({
                row: rowIndex,
                agent_code: agentCode,
                cycle: cycleNumber
              });
              result.skippedCount++;
              continue;
            }

            duplicateSet.add(duplicateKey);

            const submissionData = this.buildSubmissionData(row);
            const reviewNotes: string[] = [];

            if (!submittedBy) {
              reviewNotes.push(`Missing mapping for supervisor code: ${supervisorCode}`);
            }

            recordsToInsert.push({
              form_id: FORM_ID,
              agent_id: agentId,
              submission_data: submissionData,
              cycle_number: cycleNumber,
              submitted_by: submittedBy,
              latitude: latitude,
              longitude: longitude,
              submission_latitude: latitude,
              submission_longitude: longitude,
              status: importStatus,
              submitted_at: submittedOn || new Date().toISOString(),
              geo_captured_at: submittedOn || new Date().toISOString(),
              submitter_supervisor_code: supervisorCode,
              supervisor_code: supervisorCode,
              review_notes: reviewNotes.length > 0 ? reviewNotes.join('; ') : null
            });
          } catch (error: any) {
            result.errors.push({
              row: rowIndex,
              error: error.message || 'Unknown error',
              data: row
            });
            result.errorCount++;
          }
        }

        if (recordsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('form_submissions')
            .insert(recordsToInsert);

          if (insertError) {
            console.error('Batch insert error:', insertError);
            result.errors.push({
              row: i + 2,
              error: `Batch insert failed: ${insertError.message}`,
            });
            result.errorCount += recordsToInsert.length;
          } else {
            result.successCount += recordsToInsert.length;
          }
        }

        if (onProgress) {
          const processedRows = i + batch.length;
          const progress = Math.min(95, Math.round(10 + ((processedRows / rows.length) * 85)));
          const message = `Processing batch ${currentBatch}/${totalBatches} - ${processedRows}/${rows.length} rows (${result.successCount} imported, ${result.errorCount} errors, ${result.skippedCount} skipped)`;

          console.log(message);

          onProgress({
            progress,
            currentBatch,
            totalBatches,
            processedRows,
            totalRows: rows.length,
            currentSuccess: result.successCount,
            currentErrors: result.errorCount,
            currentSkipped: result.skippedCount,
            message
          });
        }
      }

      if (onProgress) {
        onProgress({
          progress: 100,
          currentBatch: totalBatches,
          totalBatches,
          processedRows: rows.length,
          totalRows: rows.length,
          currentSuccess: result.successCount,
          currentErrors: result.errorCount,
          currentSkipped: result.skippedCount,
          message: 'Import complete!'
        });
      }

      result.success = result.errorCount === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({
        row: 0,
        error: `Import failed: ${error.message}`
      });
    }

    return result;
  }
}
