import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Clock, User, FileText, AlertTriangle, Building2, Trash2 } from 'lucide-react';
import { IssueService } from '../../lib/issues/issue-service';
import { supabase } from '../../lib/supabase/client';
import type { Issue, IssueComment, IssuePriority, IssueCategory, IssueCustomStatus } from '../../lib/issues/types';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';

interface IssueDetailModalProps {
  issue: Issue;
  onClose: () => void;
  onUpdate: () => void;
}

interface ChangePrompt {
  field: string;
  oldValue: string;
  newValue: string;
  onChange: (workNote: string) => Promise<void>;
}

export function IssueDetailModal({ issue, onClose, onUpdate }: IssueDetailModalProps) {
  const { showWarning, showError, showSuccess } = useToast();
  const [workNotes, setWorkNotes] = useState<IssueComment[]>([]);
  const [newNote, setNewNote] = useState('');
  const [users, setUsers] = useState<Map<string, any>>(new Map());
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [statuses, setStatuses] = useState<IssueCustomStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [changePrompt, setChangePrompt] = useState<ChangePrompt | null>(null);
  const [promptWorkNote, setPromptWorkNote] = useState('');

  const isAdmin = ['super_admin', 'client_admin', 'regional_admin', 'branch_admin'].includes(userRole);

  useEffect(() => {
    loadWorkNotes();
    loadUsers();
    loadCustomer();
    loadCategories();
    loadStatuses();
    loadUserRole();
  }, []);

  const loadWorkNotes = async () => {
    const data = await IssueService.getComments(issue.id);
    setWorkNotes(data);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('org_id', issue.org_id);

    if (data) {
      const userMap = new Map(data.map(u => [u.id, u]));
      setUsers(userMap);
    }
  };

  const loadCustomer = async () => {
    if (!issue.customer_id) return;
    const { data } = await supabase
      .from('customers')
      .select('customer_name')
      .eq('id', issue.customer_id)
      .maybeSingle();

    if (data) {
      setCustomerName(data.customer_name);
    }
  };

  const loadCategories = async () => {
    const data = await IssueService.getCategories(issue.org_id);
    setCategories(data);
  };

  const loadStatuses = async () => {
    const data = await IssueService.getCustomStatuses(issue.org_id);
    setStatuses(data);
  };

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('role:roles(name)')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setUserRole((data.role as any)?.name || '');
      }
    }
  };

  const handleDeleteIssue = async () => {
    setDeleting(true);
    try {
      const success = await IssueService.deleteIssue(issue.id);
      if (success) {
        showSuccess('Issue Deleted', `Issue ${issue.issue_number} has been deleted`);
        setShowDeleteConfirm(false);
        onUpdate();
      } else {
        showError('Delete Failed', 'Unable to delete this issue. Please try again.');
      }
    } catch {
      showError('Delete Failed', 'Unable to delete this issue. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await IssueService.addComment(issue.id, newNote, false, true);
      setNewNote('');
      loadWorkNotes();
    } catch (error) {
      console.error('Failed to add work note:', error);
    }
  };

  const promptForWorkNote = (field: string, oldValue: string, newValue: string, onChange: (workNote: string) => Promise<void>) => {
    setChangePrompt({ field, oldValue, newValue, onChange });
    setPromptWorkNote('');
  };

  const handleConfirmChange = async () => {
    if (!promptWorkNote.trim()) {
      showWarning('Work Note Required', 'Please provide a work note explaining this change');
      return;
    }

    if (changePrompt) {
      setLoading(true);
      try {
        await changePrompt.onChange(promptWorkNote);
        setChangePrompt(null);
        setPromptWorkNote('');
        await loadWorkNotes();
        onUpdate();
      } catch (error) {
        console.error('Failed to save change:', error);
        showError('Save Failed', 'Unable to save changes. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCategoryChange = async (categoryId: string) => {
    const oldCategory = categories.find(c => c.id === issue.category_id);
    const newCategory = categories.find(c => c.id === categoryId);

    promptForWorkNote(
      'Category',
      oldCategory?.name || 'None',
      newCategory?.name || 'None',
      async (workNote) => {
        await IssueService.updateIssue(issue.id, { category_id: categoryId || null });
        await IssueService.addComment(issue.id, `Category changed from "${oldCategory?.name || 'None'}" to "${newCategory?.name || 'None'}"\n\n${workNote}`, false, true);
      }
    );
  };

  const handlePriorityChange = async (priority: IssuePriority) => {
    promptForWorkNote(
      'Priority',
      issue.priority.toUpperCase(),
      priority.toUpperCase(),
      async (workNote) => {
        await IssueService.updateIssue(issue.id, { priority });
        await IssueService.addComment(issue.id, `Priority changed from "${issue.priority.toUpperCase()}" to "${priority.toUpperCase()}"\n\n${workNote}`, false, true);
      }
    );
  };

  const handleStatusChange = async (statusId: string) => {
    const oldStatus = statuses.find(s => s.id === issue.status_id);
    const newStatus = statuses.find(s => s.id === statusId);

    promptForWorkNote(
      'Status',
      oldStatus?.display_name || 'Unknown',
      newStatus?.display_name || 'Unknown',
      async (workNote) => {
        await IssueService.updateIssue(issue.id, { status_id: statusId });
        await IssueService.addComment(issue.id, `Status changed from "${oldStatus?.display_name || 'Unknown'}" to "${newStatus?.display_name || 'Unknown'}"\n\n${workNote}`, false, true);
      }
    );
  };

  const handleAssigneeChange = async (userId: string) => {
    const oldUser = users.get(issue.assigned_to || '');
    const newUser = users.get(userId);

    promptForWorkNote(
      'Assignment',
      oldUser?.full_name || 'Unassigned',
      newUser?.full_name || 'Unassigned',
      async (workNote) => {
        await IssueService.updateIssue(issue.id, { assigned_to: userId || null });
        await IssueService.addComment(issue.id, `Assignment changed from "${oldUser?.full_name || 'Unassigned'}" to "${newUser?.full_name || 'Unassigned'}"\n\n${workNote}`, false, true);
      }
    );
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const currentStatus = statuses.find(s => s.id === issue.status_id);
  const currentCategory = categories.find(c => c.id === issue.category_id);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-t-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white rounded-lg text-xs font-mono font-bold border border-white/20">
                    {issue.issue_number}
                  </span>

                  <select
                    value={issue.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border-2 cursor-pointer transition-all ${getPriorityColor(issue.priority)}`}
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>

                  {currentStatus && (
                    <select
                      value={issue.status_id || ''}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all"
                      style={{ backgroundColor: currentStatus.color + '20', color: currentStatus.color }}
                    >
                      {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.display_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <h2 className="text-3xl font-bold text-white">{issue.title}</h2>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-white/60 hover:text-red-400 transition-colors p-2 hover:bg-red-500/20 rounded-lg"
                    title="Delete issue"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-teal-600 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="font-bold">Customer</span>
                </div>
                <p className="text-slate-800 font-semibold text-lg">
                  {customerName || 'N/A'}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-emerald-600 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-bold">Reported By</span>
                </div>
                <p className="text-slate-800 font-semibold text-lg">
                  {users.get(issue.reported_by)?.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {new Date(issue.reported_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Description</h3>
              <p className="text-slate-700 leading-relaxed">{issue.description || 'No description provided'}</p>
            </div>

            {issue.action_taken && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Action Taken</h3>
                </div>
                <p className="text-blue-900 leading-relaxed">{issue.action_taken}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Issue Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Category</label>
                  <select
                    value={issue.category_id || ''}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium cursor-pointer hover:border-emerald-500 transition-colors"
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Assigned To</label>
                  <select
                    value={issue.assigned_to || ''}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium cursor-pointer hover:border-emerald-500 transition-colors"
                  >
                    <option value="">Unassigned</option>
                    {Array.from(users.values()).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {issue.assigned_to && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-bold">Assigned To</span>
                  </div>
                  <p className="text-slate-800 font-semibold text-lg">
                    {users.get(issue.assigned_to)?.full_name || 'Unknown'}
                  </p>
                  {issue.assigned_at && (
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(issue.assigned_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {issue.due_date && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-amber-600 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-bold">Due Date</span>
                  </div>
                  <p className="text-slate-800 font-semibold text-lg">
                    {new Date(issue.due_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {currentCategory && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-sm mb-3" style={{ color: currentCategory.color }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: currentCategory.color + '20' }}>
                      <FileText className="w-4 h-4" style={{ color: currentCategory.color }} />
                    </div>
                    <span className="font-bold">Category</span>
                  </div>
                  <p className="text-slate-800 font-semibold text-lg">
                    {currentCategory.name}
                  </p>
                  {currentCategory.description && (
                    <p className="text-xs text-slate-500 mt-2">
                      {currentCategory.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t-2 border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  Work Notes
                </h3>
                <span className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm">
                  {workNotes.length}
                </span>
              </div>

              <div className="space-y-4 mb-6">
                {workNotes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No work notes yet. Add one to track progress!</p>
                  </div>
                ) : (
                  workNotes.map((note) => (
                    <div key={note.id} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                            {users.get(note.user_id)?.full_name?.charAt(0) || 'U'}
                          </div>
                          <span className="font-bold text-slate-800">
                            {users.get(note.user_id)?.full_name || 'Unknown User'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap ml-13">{note.comment_text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add work note..."
                  rows={3}
                  className="flex-1 px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-8 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {changePrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Work Note Required</h3>
                <p className="text-sm text-slate-600 mb-4">
                  You are changing <span className="font-semibold">{changePrompt.field}</span> from <span className="font-semibold text-red-600">"{changePrompt.oldValue}"</span> to <span className="font-semibold text-green-600">"{changePrompt.newValue}"</span>
                </p>
                <p className="text-sm text-slate-700 mb-4">
                  Please provide a work note explaining this change:
                </p>
                <textarea
                  value={promptWorkNote}
                  onChange={(e) => setPromptWorkNote(e.target.value)}
                  placeholder="Explain why you're making this change..."
                  rows={4}
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setChangePrompt(null);
                  setPromptWorkNote('');
                }}
                className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmChange}
                disabled={loading || !promptWorkNote.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteIssue}
        title="Delete Issue"
        message={`Are you sure you want to delete issue ${issue.issue_number}? This action cannot be undone and all related work notes and history will be permanently removed.`}
        confirmText="Delete Issue"
        cancelText="Cancel"
        type="danger"
        isLoading={deleting}
      />
    </>
  );
}
