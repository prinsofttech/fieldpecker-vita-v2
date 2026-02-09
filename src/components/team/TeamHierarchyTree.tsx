import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Users } from 'lucide-react';
import type { TeamMember } from '../../lib/team/team-service';

interface TreeNode {
  id: string;
  full_name: string;
  email: string;
  role: {
    display_name: string;
  };
  department: {
    name: string;
  } | null;
  subordinates: TreeNode[];
  subordinateCount: number;
}

interface TeamHierarchyTreeProps {
  tree: TreeNode[];
  onSelectMember?: (member: TeamMember) => void;
}

export function TeamHierarchyTree({ tree, onSelectMember }: TeamHierarchyTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No Hierarchy Data</h3>
        <p className="text-slate-600">
          No organizational hierarchy found. Users need to be assigned reporting relationships.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Organization Hierarchy</h2>
      <div className="space-y-2">
        {tree.map((node) => (
          <TreeNodeComponent key={node.id} node={node} onSelectMember={onSelectMember} />
        ))}
      </div>
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  depth?: number;
  onSelectMember?: (member: TeamMember) => void;
}

function TreeNodeComponent({ node, depth = 0, onSelectMember }: TreeNodeComponentProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasSubordinates = node.subordinates && node.subordinates.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer`}
        style={{ paddingLeft: `${depth * 2 + 0.75}rem` }}
        onClick={() => {
          if (hasSubordinates) {
            setIsExpanded(!isExpanded);
          }
          if (onSelectMember) {
            onSelectMember(node as any);
          }
        }}
      >
        {hasSubordinates ? (
          <button
            className="p-1 hover:bg-slate-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div className="w-10 h-10 bg-gradient-to-br from-[#015324] to-[#016428] rounded-full flex items-center justify-center shadow-sm">
          <span className="text-white font-semibold text-sm">
            {node.full_name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{node.full_name}</p>
            {hasSubordinates && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <Users className="w-3 h-3" />
                {node.subordinateCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{node.role?.display_name}</span>
            {node.department && (
              <>
                <span>•</span>
                <span>{node.department.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {isExpanded && hasSubordinates && (
        <div className="space-y-1 mt-1">
          {node.subordinates.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelectMember={onSelectMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
