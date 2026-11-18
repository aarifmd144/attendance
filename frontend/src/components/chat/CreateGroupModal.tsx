import React, { useState } from 'react';
import { Users, X, Search, Check, Shield, User, Sparkles } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { THEME_PRESETS } from '../../utils/theme';
import { ChatUser } from '../../types';
import toast from 'react-hot-toast';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { availableUsers, createGroup } = useChatStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState('classic-blue');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one employee or staff member');
      return;
    }

    setIsSubmitting(true);
    try {
      const convId = await createGroup(
        title.trim(),
        selectedUserIds,
        description.trim(),
        selectedThemeId
      );
      if (convId) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = availableUsers.filter((u) => {
    if (!searchMember) return true;
    const term = searchMember.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.department && u.department.toLowerCase().includes(term)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-primary-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-600 text-white shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Create New Group Chat</h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-100 text-primary-700">
                  <Shield className="w-3 h-3" /> Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Setup team collaboration, messaging and themes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Group Title / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Engineering & IT Team"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Daily standups, announcements, and project discussions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Initial Group Theme Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                <span>Admin Group Theme</span>
              </label>
              <span className="text-[10px] text-slate-400">All members will see this theme</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEME_PRESETS).slice(0, 4).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedThemeId(key)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedThemeId === key
                      ? 'border-primary-600 ring-2 ring-primary-500/20 bg-primary-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full mx-auto block mb-1 ${preset.previewColor}`} />
                  <span className="text-[10px] font-semibold text-slate-800 block truncate">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Select Group Members <span className="text-red-500">*</span>
              </label>
              <span className="text-xs font-bold text-primary-600">
                {selectedUserIds.length} Selected
              </span>
            </div>

            {/* Member Search input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees by name, department, ID..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            {/* Scrollable list */}
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-1 bg-slate-50/30">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No users found</div>
              ) : (
                filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked ? 'bg-primary-50/80' : 'hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          {u.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-xs text-slate-900 leading-tight">
                            {u.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {u.employeeId ? `ID: ${u.employeeId} • ` : ''}
                            {u.department || u.designation || u.email}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isChecked
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer inside form */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || selectedUserIds.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl shadow-md shadow-primary-600/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
