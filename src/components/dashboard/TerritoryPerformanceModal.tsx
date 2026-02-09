import { X, Users } from 'lucide-react';

interface TerritoryData {
  id: string;
  name: string;
  formCount: number;
  customerCount: number;
}

interface TerritoryPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  territoryData: TerritoryData[];
}

export default function TerritoryPerformanceModal({ isOpen, onClose, territoryData }: TerritoryPerformanceModalProps) {
  if (!isOpen) return null;

  const maxActivity = Math.max(...territoryData.map(r => r.formCount), 1);
  const colors = [
    'from-emerald-500 to-teal-500',
    'from-sky-500 to-blue-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-indigo-500 to-blue-600',
    'from-pink-500 to-rose-500',
    'from-cyan-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-purple-500 to-indigo-500'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Territory Performance</h2>
            <p className="text-sm text-slate-500 mt-1">Complete activity breakdown by territory</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {territoryData.length > 0 ? (
            <div className="space-y-4">
              {territoryData
                .sort((a, b) => b.formCount - a.formCount)
                .map((territory, index) => {
                  const percentage = Math.round((territory.formCount / maxActivity) * 100);

                  return (
                    <div key={territory.id} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <div className="text-base font-semibold text-slate-800">{territory.name}</div>
                            <div className="text-sm text-slate-500">{territory.customerCount} customers</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-800">{territory.formCount}</div>
                          <div className="text-sm text-slate-500">activities</div>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No territory data available</p>
                <p className="text-xs mt-1">Create territories in settings to see performance</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">
              <span className="font-semibold">{territoryData.length}</span> territories total
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
