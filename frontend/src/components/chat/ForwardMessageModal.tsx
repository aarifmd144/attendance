import React, { useState } from 'react';
import { Share2, X, Search, Check, Users, User, Shield, Utensils, Send } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ChatMessage, ChatConversation, ChatUser } from '../../types';
import toast from 'react-hot-toast';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
}: ForwardMessageModalProps) {
  const { conversations, availableUsers, forwardMessage } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !message) return null;

  const toggleConvSelection = (convId: string) => {
    if (selectedConvIds.includes(convId)) {
      setSelectedConvIds(selectedConvIds.filter((id) => id !== convId));
    } else {
      setSelectedConvIds([...selectedConvIds, convId]);
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const totalSelected = selectedConvIds.length + selectedUserIds.length;

  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSelected === 0) {
      toast.error('Please select at least one recipient or conversation');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await forwardMessage(message.id, selectedConvIds, selectedUserIds);
      if (success) {
        onClose();
        setSelectedConvIds([]);
        setSelectedUserIds([]);
        setSearchTerm('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const term = searchTerm.toLowerCase().trim();

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!term) return true;
    if (c.conversationType === 'GROUP') {
      return (c.title || '').toLowerCase().includes(term);
    }
    return (
      (c.otherUser?.name || '').toLowerCase().includes(term) ||
      (c.otherUser?.email || '').toLowerCase().includes(term)
    );
  });

  // Filter users not already in conversation list
  const filteredUsers = availableUsers.filter((u) => {
    // Only show if user doesn't already have an active direct conversation shown above
    const hasConv = conversations.some(
      (c) => c.conversationType === 'DIRECT' && c.otherUser?.id === u.id
    );
    if (hasConv) return false;
    if (!term) return true;
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.department && u.department.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-primary-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-600 text-white shadow-sm">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Forward Message</h3>
              <p className="text-[11px] text-slate-500">
                Share this message with colleagues or groups
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

        {/* Message preview snippet */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Message Preview
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 line-clamp-3 leading-relaxed break-words">
            {message.messageContent || message.attachmentName || 'Attachment'}
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations, teams, contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Recipient Selection List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {/* Active Conversations */}
          {filteredConversations.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider block">
                Conversations
              </span>
              {filteredConversations.map((conv) => {
                const isSelected = selectedConvIds.includes(conv.id);
                const isGroup = conv.conversationType === 'GROUP';
                const title = isGroup ? conv.title || 'Group' : conv.otherUser?.name || 'User';

                return (
                  <div
                    key={conv.id}
                    onClick={() => toggleConvSelection(conv.id)}
                    className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isGroup ? (
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                      ) : conv.otherUser?.avatar ? (
                        <img
                          src={conv.otherUser.avatar}
                          alt={title}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {title[0]?.toUpperCase() || 'U'}
                        </div>
                      )}

                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{title}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {isGroup ? 'Group Conversation' : conv.otherUser?.email}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contacts / Users */}
          {filteredUsers.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider block">
                Contacts
              </span>
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {user.name ? user.name[0].toUpperCase() : 'U'}
                        </div>
                      )}

                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {user.designation || user.email}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredConversations.length === 0 && filteredUsers.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching conversations or contacts found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">
            {totalSelected > 0 ? `${totalSelected} selected` : 'Select recipients'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForward}
              disabled={totalSelected === 0 || isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Forwarding...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Forward ({totalSelected})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
