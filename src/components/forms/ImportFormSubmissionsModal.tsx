import { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download, Loader } from 'lucide-react';
import { CSVImportService, PreviewData, ImportResult, ProgressUpdate } from '../../lib/forms/csv-import-service';
import { useToast } from '../../contexts/ToastContext';

interface ImportFormSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onImportComplete?: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportFormSubmissionsModal({
  isOpen,
  onClose,
  orgId,
  onImportComplete
}: ImportFormSubmissionsModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressDetails, setProgressDetails] = useState<ProgressUpdate | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      showToast('error', 'File size must be less than 50MB');
      return;
    }

    setFile(selectedFile);
    const text = await selectedFile.text();
    setCsvText(text);
  };

  const handlePreview = async () => {
    if (!csvText) {
      showToast('error', 'Please select a file first');
      return;
    }

    try {
      const previewData = await CSVImportService.previewImport(csvText, orgId);
      setPreview(previewData);
      setStep('preview');
    } catch (error: any) {
      showToast('error', 'Failed to preview CSV', error.message);
    }
  };

  const handleImport = async () => {
    if (!csvText) return;

    setImporting(true);
    setStep('importing');
    setProgress(0);
    setProgressDetails(null);

    try {
      const importResult = await CSVImportService.importCSV(csvText, orgId, (update) => {
        setProgress(update.progress);
        setProgressDetails(update);
      });

      setResult(importResult);
      setStep('complete');

      if (importResult.success) {
        showToast(
          'success',
          'Import completed',
          `${importResult.successCount} records imported successfully.`
        );
      } else {
        showToast(
          'error',
          'Import completed with errors',
          `${importResult.successCount} succeeded, ${importResult.errorCount} failed.`
        );
      }

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error: any) {
      showToast('error', 'Import failed', error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setStep('upload');
      setFile(null);
      setCsvText('');
      setPreview(null);
      setResult(null);
      setProgress(0);
      setProgressDetails(null);
      onClose();
    }
  };

  const downloadErrorLog = () => {
    if (!result || result.errors.length === 0) return;

    const errorLines = [
      'Row,Error,Data',
      ...result.errors.map(e =>
        `${e.row},"${e.error}","${e.data ? JSON.stringify(e.data).replace(/"/g, '""') : ''}"`
      )
    ];

    const blob = new Blob([errorLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Import Form Submissions</h2>
              <p className="text-sm text-slate-600">Import Centenary Bank supervision data from CSV</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Select CSV File</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Upload your Centenary Bank supervision data export (max 50MB)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Choose File
                </label>
                {file && (
                  <p className="mt-4 text-sm text-slate-700">
                    Selected: <span className="font-medium">{file.name}</span> (
                    {(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Required CSV Columns:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Terminal ID (agent code)</li>
                  <li>Submitted On (date)</li>
                  <li>Visit (cycle number)</li>
                  <li>Emp. code (supervisor code)</li>
                  <li>approved (true/false)</li>
                  <li>latitude, longitude</li>
                  <li>Question columns (Paper rolls delivered?, Agent Active?, etc.)</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!file}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview Import
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Preview (First 5 Rows)</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Total rows to import: <span className="font-semibold">{preview.rows.length}</span>
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Terminal ID</th>
                        <th className="px-3 py-2 text-left">Cycle</th>
                        <th className="px-3 py-2 text-left">Supervisor Code</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Fields</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {preview.mappedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs">{row.agent_code}</td>
                          <td className="px-3 py-2">{row.cycle_number}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.supervisor_code}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs ${
                                row.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {Object.keys(row.submission_data).length} fields
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-1">Important Notes:</h4>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    <li>Duplicate submissions (same agent + cycle) will be skipped</li>
                    <li>Rows with missing agent codes will fail</li>
                    <li>Missing supervisor codes will be logged but won't prevent import</li>
                    <li>Invalid data will be logged for review</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Start Import
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center">
                <Loader className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Importing Data...</h3>
                <p className="text-slate-600">Please wait while we process your CSV file</p>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-slate-700">{progress}%</p>

                {progressDetails && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">Batch Progress:</span>
                      <span className="text-slate-600">
                        {progressDetails.currentBatch} / {progressDetails.totalBatches}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">Rows Processed:</span>
                      <span className="text-slate-600">
                        {progressDetails.processedRows.toLocaleString()} / {progressDetails.totalRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{progressDetails.currentSuccess.toLocaleString()}</div>
                        <div className="text-xs text-slate-600">Imported</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">{progressDetails.currentSkipped.toLocaleString()}</div>
                        <div className="text-xs text-slate-600">Skipped</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">{progressDetails.currentErrors.toLocaleString()}</div>
                        <div className="text-xs text-slate-600">Errors</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 text-center pt-2 border-t border-slate-200">
                      {progressDetails.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="space-y-6">
              <div
                className={`border-2 rounded-xl p-6 ${
                  result.success
                    ? 'border-green-200 bg-green-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  {result.success ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      {result.success ? 'Import Completed Successfully' : 'Import Completed with Warnings'}
                    </h3>
                    <p className="text-sm text-slate-600">Processing summary below</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-2xl font-bold text-slate-800">{result.totalRows}</div>
                    <div className="text-sm text-slate-600">Total Rows</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
                    <div className="text-sm text-slate-600">Imported</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="text-2xl font-bold text-amber-600">{result.skippedCount}</div>
                    <div className="text-sm text-slate-600">Skipped</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{result.errorCount}</div>
                    <div className="text-sm text-slate-600">Errors</div>
                  </div>
                </div>
              </div>

              {result.duplicates.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">
                    Skipped Duplicates ({result.duplicates.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto text-sm text-amber-800 space-y-1">
                    {result.duplicates.slice(0, 10).map((dup, idx) => (
                      <div key={idx}>
                        Row {dup.row}: Agent {dup.agent_code}, Cycle {dup.cycle}
                      </div>
                    ))}
                    {result.duplicates.length > 10 && (
                      <div className="text-amber-600 font-medium">
                        ...and {result.duplicates.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-red-900">Errors ({result.errors.length})</h4>
                    <button
                      onClick={downloadErrorLog}
                      className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download Log
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto text-sm text-red-800 space-y-1">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="font-mono text-xs">
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="text-red-600 font-medium">
                        ...and {result.errors.length - 10} more (download log for full details)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
