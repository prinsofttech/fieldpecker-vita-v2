import { useState, useEffect } from 'react';
import { FileText, Eye, Check, X, Clock, User, Search, MapPin, Shield, AlertCircle, ChevronRight } from 'lucide-react';
import type { FormSubmission, Form } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { formatDistanceToNow } from '../../lib/utils/date-utils';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';

interface FormSubmissionsViewProps {
  orgId: string;
  filters: {
    form_id: string;
    status: string;
    start_date: string;
    end_date: string;
    region_id: string;
    branch_id: string;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchTrigger: number;
  includeRejected?: boolean;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function FormSubmissionsView({
  orgId,
  filters,
  sortBy,
  sortOrder,
  searchTrigger,
  includeRejected = false
}: FormSubmissionsViewProps) {
  const { showError, showWarning, showSuccess } = useToast();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewerInfo, setReviewerInfo] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    loadForms();
  }, [orgId]);

  useEffect(() => {
    if (searchTrigger > 0) {
      loadSubmissions();
    }
  }, [searchTrigger, filters.start_date, filters.end_date, filters.form_id, filters.status, filters.region_id, filters.branch_id, includeRejected]);

  const loadForms = async () => {
    try {
      const data = await FormService.listForms(orgId);
      setForms(data);
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await FormService.getSubmissions({
        ...filters,
        excludeRejected: !includeRejected
      });
      setSubmissions(data);

      const reviewerIds = [
        ...new Set(data
          .map(s => [s.approved_by, s.rejected_by])
          .flat()
          .filter(Boolean) as string[])
      ];
      if (reviewerIds.length > 0) {
        await loadReviewers(reviewerIds);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewers = async (reviewerIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', reviewerIds);

      if (error) throw error;

      const reviewerMap = new Map();
      data?.forEach(reviewer => {
        reviewerMap.set(reviewer.id, reviewer);
      });
      setReviewerInfo(reviewerMap);
    } catch (error) {
      console.error('Error loading reviewers:', error);
    }
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setReviewNotes('');
    setRejectionReason('');
    setReviewAction('approved');
    setShowReviewModal(true);
  };

  const handleReview = async () => {
    if (!selectedSubmission) return;

    if (reviewAction === 'rejected' && !rejectionReason.trim()) {
      showWarning('Rejection Reason Required', 'Please provide a reason for rejecting this submission');
      return;
    }

    setSubmitting(true);
    try {
      let result;
      if (reviewAction === 'approved') {
        result = await FormService.approveSubmission(selectedSubmission.id, reviewNotes);
      } else {
        result = await FormService.rejectSubmission(selectedSubmission.id, rejectionReason);
      }

      if (!result.success) {
        showError('Review Failed', result.error || 'Failed to review submission');
        setSubmitting(false);
        return;
      }

      setShowReviewModal(false);
      setSelectedSubmission(null);
      setRejectionReason('');
      setReviewNotes('');
      showSuccess(
        reviewAction === 'approved' ? 'Submission Approved' : 'Submission Rejected',
        `The submission has been successfully ${reviewAction === 'approved' ? 'approved' : 'rejected'}`
      );
      loadSubmissions();
    } catch (error) {
      console.error('Error reviewing submission:', error);
      showError('Review Failed', 'Failed to review submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      if (!filters.form_id) {
        showWarning('Form Required', 'Please select a form to export');
        return;
      }

      const csv = await FormService.exportSubmissionsCSV(filters.form_id, {
        start_date: filters.start_date,
        end_date: filters.end_date
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-submissions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSuccess('Export Complete', 'Submissions have been exported successfully');
    } catch (error) {
      console.error('Error exporting submissions:', error);
      showError('Export Failed', 'Failed to export submissions. Please try again.');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-300',
          icon: <Clock className="w-4 h-4" />,
          label: 'Pending Review'
        };
      case 'approved':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-300',
          icon: <Check className="w-4 h-4" />,
          label: 'Approved'
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-300',
          icon: <X className="w-4 h-4" />,
          label: 'Rejected'
        };
      default:
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-700',
          border: 'border-slate-300',
          icon: <Clock className="w-4 h-4" />,
          label: status
        };
    }
  };

  const selectedForm = forms.find(f => f.id === selectedSubmission?.form_id);

  const filteredSubmissions = submissions
    .filter(submission => {
      const customerName = submission.customer_name || '';
      const customerCode = submission.customer_code || '';
      const form = forms.find(f => f.id === submission.form_id);
      const formTitle = form?.title || '';

      const searchLower = searchTerm.toLowerCase();
      return (
        customerName.toLowerCase().includes(searchLower) ||
        customerCode.toLowerCase().includes(searchLower) ||
        formTitle.toLowerCase().includes(searchLower) ||
        submission.id.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let aValue: any = a[sortBy as keyof FormSubmission];
      let bValue: any = b[sortBy as keyof FormSubmission];

      if (sortBy === 'submitted_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, form title, or submission ID..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
            />
          </div>
          {!loading && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                Showing <span className="font-semibold text-slate-800">{filteredSubmissions.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{submissions.length}</span> submissions
              </span>
              {sortBy && (
                <span className="text-slate-600">
                  Sorted by: <span className="font-semibold text-[#015324]">
                    {sortBy === 'submitted_at' ? 'Submission Date' :
                     sortBy === 'cycle_number' ? 'Cycle Number' :
                     sortBy === 'status' ? 'Status' : sortBy}
                  </span>
                  <span className="ml-2 text-slate-500">({sortOrder === 'asc' ? '↑' : '↓'})</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-20 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
          <div className="inline-flex p-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl mb-6">
            <FileText className="w-16 h-16 text-slate-400" />
          </div>
          {searchTrigger === 0 ? (
            <>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Ready to Search</h3>
              <p className="text-slate-600 text-lg">Select a date range and click the Search button to view form submissions</p>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">No submissions found</h3>
              <p className="text-slate-600 text-lg">Try adjusting your filters or search terms</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Form</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Territory</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Sub-Territory</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Submitted By</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Cycle</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Submitted</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((submission) => {
                  const form = forms.find(f => f.id === submission.form_id);
                  const statusConfig = getStatusConfig(submission.status);

                  return (
                    <tr
                      key={submission.id}
                      className="hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer"
                      onClick={() => handleViewSubmission(submission)}
                    >
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium text-slate-800 line-clamp-1">
                          {form?.title || 'Unknown Form'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium text-slate-800 line-clamp-1">
                          {submission.customer_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-600 font-mono">
                          {submission.customer_code || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-600 line-clamp-1">
                          {submission.territory_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-600 line-clamp-1">
                          {submission.sub_territory_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-700 line-clamp-1">
                          {submission.submitter_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-semibold text-slate-700">
                          {submission.cycle_number}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(submission.submitted_at).toLocaleDateString()} {new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewSubmission(submission); }}
                          className="p-1.5 text-[#015324] hover:bg-[#015324]/10 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showReviewModal && selectedSubmission && selectedForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#015324] to-[#014a20] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">Form Submission Review</h3>
                  <p className="text-green-100 text-sm">{selectedForm.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(selectedSubmission.approved_by || selectedSubmission.rejected_by) && (
                <div className={`p-4 rounded-lg border-2 ${
                  selectedSubmission.approved_by ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <Shield className={`w-5 h-5 mt-0.5 ${
                      selectedSubmission.approved_by ? 'text-emerald-600' : 'text-rose-600'
                    }`} />
                    <div>
                      <p className={`text-sm font-bold ${
                        selectedSubmission.approved_by ? 'text-emerald-900' : 'text-rose-900'
                      }`}>
                        {selectedSubmission.approved_by ? 'Approved' : 'Rejected'} by{' '}
                        {reviewerInfo.get(selectedSubmission.approved_by || selectedSubmission.rejected_by)?.full_name || 'Unknown User'}
                      </p>
                      <p className={`text-xs ${
                        selectedSubmission.approved_by ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {formatDistanceToNow(selectedSubmission.approved_at || selectedSubmission.rejected_at || '')}
                      </p>
                      {selectedSubmission.rejection_reason && (
                        <p className="text-sm text-rose-800 mt-2 font-medium">
                          Reason: {selectedSubmission.rejection_reason}
                        </p>
                      )}
                      {selectedSubmission.review_notes && (
                        <p className="text-sm text-slate-700 mt-2">
                          Notes: {selectedSubmission.review_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-4 divide-x divide-slate-200">
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Customer</p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{selectedSubmission.customer_name || 'Unknown'}</p>
                    {selectedSubmission.customer_code && (
                      <p className="text-[10px] text-slate-400 font-mono">{selectedSubmission.customer_code}</p>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" />Territory
                    </p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">{selectedSubmission.territory_name || 'Unassigned'}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" />Sub-Territory
                    </p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">{selectedSubmission.sub_territory_name || 'Unassigned'}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Status</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {getStatusConfig(selectedSubmission.status).icon}
                      <p className="text-xs font-semibold text-slate-900">{getStatusConfig(selectedSubmission.status).label}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-200 border-t border-slate-200 bg-white">
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Cycle</p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">{selectedSubmission.cycle_number}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Submitted</p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {new Date(selectedSubmission.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedSubmission.time_spent && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] font-medium text-rose-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" />Time Spent
                      </p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{selectedSubmission.time_spent}</p>
                    </div>
                  )}
                  {selectedSubmission.supervisor_name && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3" />Supervisor
                      </p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{selectedSubmission.supervisor_name}</p>
                    </div>
                  )}
                </div>

                {(selectedSubmission.form_started_at || selectedSubmission.form_end_time || (selectedSubmission.latitude && selectedSubmission.longitude)) && (
                  <div className="grid grid-cols-4 divide-x divide-slate-200 border-t border-slate-200">
                    {selectedSubmission.form_started_at && (
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" />Form Started
                        </p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">{formatTimestamp(selectedSubmission.form_started_at)}</p>
                      </div>
                    )}
                    {selectedSubmission.form_end_time && (
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" />Form Ended
                        </p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">{formatTimestamp(selectedSubmission.form_end_time)}</p>
                      </div>
                    )}
                    {selectedSubmission.latitude && selectedSubmission.longitude && (
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-medium text-cyan-600 uppercase tracking-wider flex items-center gap-1">
                          <MapPin className="w-3 h-3" />Location
                        </p>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">
                          {selectedSubmission.latitude.toFixed(4)}, {selectedSubmission.longitude.toFixed(4)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#015324]" />
                  Form Responses
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedForm.form_schema.map((field) => {
                    const fieldValue = selectedSubmission.submission_data[field.id];
                    const isImageField = field.type === 'image';

                    // Check if field value contains image URL(s)
                    const hasImageUrls = isImageField && Array.isArray(fieldValue) &&
                      fieldValue.length > 0 &&
                      fieldValue[0]?.url;

                    // Also check for old format (single image with data property)
                    const hasLegacyImageData = isImageField && fieldValue &&
                      typeof fieldValue === 'object' &&
                      !Array.isArray(fieldValue) &&
                      fieldValue.data;

                    const hasImages = hasImageUrls || hasLegacyImageData;

                    return (
                      <div
                        key={field.id}
                        className={`bg-slate-50 rounded-lg p-3 border border-slate-200 ${hasImages ? 'col-span-2' : ''}`}
                      >
                        <p className="text-xs font-semibold text-slate-600 mb-1">
                          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </p>
                        {hasImageUrls ? (
                          <div className="mt-2 space-y-3">
                            {fieldValue.map((image: any, index: number) => (
                              <div key={image.id || index} className="border rounded-lg overflow-hidden bg-white">
                                <img
                                  src={image.url}
                                  alt={`Uploaded image ${index + 1}`}
                                  className="w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    console.error('Failed to load image:', image.url);
                                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f1f5f9"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="%2364748b" text-anchor="middle" dy=".3em">Failed to load image</text></svg>';
                                  }}
                                />
                                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                                  <p className="text-xs text-slate-600">
                                    {image.type} • {(image.size / 1024).toFixed(2)} KB
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : hasLegacyImageData ? (
                          <div className="mt-2">
                            <img
                              src={fieldValue.data}
                              alt={fieldValue.filename || 'Uploaded image'}
                              className="max-w-full h-auto max-h-96 rounded-lg border-2 border-slate-200 object-contain"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                              {fieldValue.filename} ({(fieldValue.size / 1024).toFixed(2)} KB)
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-900">
                            {fieldValue !== undefined
                              ? Array.isArray(fieldValue) ? fieldValue.join(', ') : String(fieldValue)
                              : 'N/A'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {(selectedSubmission.status === 'pending') && (
                <>
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-sm font-bold text-slate-700 mb-3">Review Action</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setReviewAction('approved')}
                        disabled={submitting}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-semibold ${
                          reviewAction === 'approved'
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        } disabled:opacity-50`}
                      >
                        <Check className="w-5 h-5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setReviewAction('rejected')}
                        disabled={submitting}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-semibold ${
                          reviewAction === 'rejected'
                            ? 'bg-rose-500 text-white shadow-md'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        } disabled:opacity-50`}
                      >
                        <X className="w-5 h-5" />
                        Reject
                      </button>
                    </div>
                  </div>

                  {reviewAction === 'rejected' && (
                    <div>
                      <label className="block text-sm font-bold text-rose-700 mb-2">
                        Rejection Reason <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide a clear reason for rejection..."
                        rows={3}
                        disabled={submitting}
                        className="w-full px-4 py-3 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none text-sm disabled:opacity-50"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Review Notes {reviewAction === 'approved' && '(Optional)'}
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add additional notes or comments..."
                      rows={3}
                      disabled={submitting}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] resize-none text-sm disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {(selectedSubmission.status === 'approved' || selectedSubmission.status === 'rejected') && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      This submission has been {selectedSubmission.status}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Four-eye review policy: Submissions cannot be modified after review.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="px-5 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-all font-semibold disabled:opacity-50"
              >
                {(selectedSubmission.status === 'pending') ? 'Cancel' : 'Close'}
              </button>
              {(selectedSubmission.status === 'pending') && (
                <button
                  onClick={handleReview}
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-[#015324] to-[#014a20] text-white rounded-lg hover:shadow-md transition-all font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {reviewAction === 'approved' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {reviewAction === 'approved' ? 'Approve' : 'Reject'} Submission
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
