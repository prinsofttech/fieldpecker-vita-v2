import { supabase } from '../supabase/client';
import type { Region, Branch } from '../supabase/types';

export interface CustomerImportData {
  customer_name: string;
  customer_code: string;
  supervisor_code?: string;
  customer_telephone?: string;
  operator?: string;
  operator_telephone?: string;
  location_of_outlet?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  region_id?: string;
  branch_id?: string;
  supervising_region_id?: string;
  supervising_branch_id?: string;
  customer_type: 'permanent' | 'temporary' | 'contract' | 'freelance';
  active_type: 'active' | 'inactive' | 'suspended' | 'terminated';
}

export interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  skipped: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  errors: Array<{ code: string; error: string }>;
  isComplete: boolean;
}

export interface ImportResult {
  success: boolean;
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: Array<{ code: string; error: string }>;
  duplicateCodes: string[];
  duplicatesInFile?: number;
  duplicateDetails?: Array<{ code: string; rows: number[] }>;
}

export class CustomerImportService {
  private static BATCH_SIZE = 1000;

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
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

  static async parseCSVFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim());

          const rows = lines.map(line => this.parseCSVLine(line));
          const headers = rows[0].map(h => h.toLowerCase().replace(/['"]/g, ''));
          const dataRows = rows.slice(1).filter(row => row.some(cell => cell));

          resolve({ headers, rows: dataRows });
        } catch (error: any) {
          reject(new Error('Failed to parse CSV file: ' + error.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static async getExistingCustomerCodes(orgId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_code')
      .eq('org_id', orgId);

    if (error) {
      throw new Error('Failed to fetch existing customer codes: ' + error.message);
    }

    return new Set((data || []).map(c => c.customer_code.toLowerCase()));
  }

  static prepareCustomerData(
    row: string[],
    headers: string[],
    orgId: string,
    regions: Region[],
    branches: Branch[]
  ): CustomerImportData | null {
    const rowData: any = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index]?.replace(/['"]/g, '') || null;
    });

    const customerName = rowData.customer_name || rowData.name || '';
    const customerCode = rowData.customer_code || rowData.code || '';

    if (!customerName || !customerCode) {
      return null;
    }

    const regionMatch = regions.find(r =>
      r.name.toLowerCase() === rowData.region?.toLowerCase() ||
      r.code.toLowerCase() === rowData.region?.toLowerCase()
    );

    const branchMatch = branches.find(b =>
      b.name.toLowerCase() === rowData.branch?.toLowerCase() ||
      b.code.toLowerCase() === rowData.branch?.toLowerCase()
    );

    return {
      customer_name: customerName.trim(),
      customer_code: customerCode.trim(),
      supervisor_code: rowData.supervisor_code?.trim() || null,
      customer_telephone: rowData.customer_telephone?.trim() || rowData.telephone?.trim() || rowData.phone?.trim() || null,
      operator: rowData.operator?.trim() || null,
      operator_telephone: rowData.operator_telephone?.trim() || null,
      location_of_outlet: rowData.location_of_outlet?.trim() || rowData.location?.trim() || null,
      country: rowData.country?.trim() || 'Kenya',
      latitude: rowData.latitude ? parseFloat(rowData.latitude) : undefined,
      longitude: rowData.longitude ? parseFloat(rowData.longitude) : undefined,
      region_id: regionMatch?.id,
      branch_id: branchMatch?.id,
      customer_type: (rowData.customer_type || rowData.type || 'permanent') as any,
      active_type: (rowData.active_type || rowData.status || 'active') as any,
    };
  }

  static async importCustomersBatch(
    customers: Array<CustomerImportData & { org_id: string }>,
    existingCodes: Set<string>,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const totalBatches = Math.ceil(customers.length / this.BATCH_SIZE);
    let successful = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ code: string; error: string }> = [];
    const duplicateCodes: string[] = [];

    for (let i = 0; i < customers.length; i += this.BATCH_SIZE) {
      const batch = customers.slice(i, i + this.BATCH_SIZE);
      const currentBatch = Math.floor(i / this.BATCH_SIZE) + 1;

      const newCustomers = batch.filter(customer => {
        const codeExists = existingCodes.has(customer.customer_code.toLowerCase());
        if (codeExists) {
          skipped++;
          duplicateCodes.push(customer.customer_code);
          return false;
        }
        return true;
      });

      if (newCustomers.length > 0) {
        const { data, error } = await supabase
          .from('customers')
          .insert(newCustomers)
          .select('customer_code');

        if (error) {
          failed += newCustomers.length;
          errors.push({
            code: `Batch ${currentBatch}`,
            error: error.message
          });
        } else {
          successful += data?.length || 0;
          data?.forEach(d => existingCodes.add(d.customer_code.toLowerCase()));
        }
      }

      if (onProgress) {
        onProgress({
          total: customers.length,
          processed: Math.min(i + this.BATCH_SIZE, customers.length),
          successful,
          skipped,
          failed,
          currentBatch,
          totalBatches,
          errors,
          isComplete: i + this.BATCH_SIZE >= customers.length
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: failed === 0,
      total: customers.length,
      successful,
      skipped,
      failed,
      errors,
      duplicateCodes
    };
  }

  static async importCustomers(
    file: File,
    orgId: string,
    regions: Region[],
    branches: Branch[],
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const { headers, rows } = await this.parseCSVFile(file);

    const existingCodes = await this.getExistingCustomerCodes(orgId);

    const customersToImport = rows
      .map(row => this.prepareCustomerData(row, headers, orgId, regions, branches))
      .filter((c): c is CustomerImportData => c !== null)
      .map(c => ({ ...c, org_id: orgId }));

    if (customersToImport.length === 0) {
      throw new Error('No valid customers found in file. Please check the format.');
    }

    const seenCodesInFile = new Map<string, number[]>();
    const duplicateDetails: Array<{ code: string; rows: number[] }> = [];

    const deduplicatedCustomers = customersToImport.filter((customer, index) => {
      const normalizedCode = customer.customer_code.trim().toLowerCase();
      const rowNumber = index + 2;

      if (seenCodesInFile.has(normalizedCode)) {
        const existingRows = seenCodesInFile.get(normalizedCode)!;
        existingRows.push(rowNumber);
        return false;
      }

      seenCodesInFile.set(normalizedCode, [rowNumber]);
      return true;
    });

    seenCodesInFile.forEach((rows, code) => {
      if (rows.length > 1) {
        duplicateDetails.push({
          code: customersToImport.find(c => c.customer_code.trim().toLowerCase() === code)?.customer_code || code,
          rows
        });
      }
    });

    const duplicatesInFile = customersToImport.length - deduplicatedCustomers.length;
    if (duplicatesInFile > 0) {
      console.log(`Removed ${duplicatesInFile} duplicate customer codes from CSV file:`);
      duplicateDetails.forEach(d => {
        console.log(`  Code "${d.code}" appears on rows: ${d.rows.join(', ')}`);
      });
    }

    const result = await this.importCustomersBatch(deduplicatedCustomers, existingCodes, onProgress);
    return {
      ...result,
      duplicatesInFile,
      duplicateDetails
    };
  }
}
