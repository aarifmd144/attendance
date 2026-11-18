import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Smile,
  X,
  Volume2,
  VolumeX,
  Plus,
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  Presentation,
  Film,
  Image as ImageIcon,
  Download,
  Trash2,
  Utensils,
  Shield,
  User,
  Circle,
  MoreVertical,
  AlertCircle,
  Palette,
  Users,
  UserPlus,
  PhoneCall,
  PhoneMissed,
  Sparkles,
  Mic,
  StopCircle,
  ExternalLink,
  Copy,
  Pin,
  Share2,
  Calendar,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';
import { ChatConversation, ChatMessage, ChatUser, MessageType } from '../../types';
import { getThemeBackgroundStyle, THEME_PRESETS, DEFAULT_THEME } from '../../utils/theme';

import ThemeSettingsModal from './ThemeSettingsModal';
import CreateGroupModal from './CreateGroupModal';
import ForwardMessageModal from './ForwardMessageModal';
import AudioPlayer from './AudioPlayer';

export default function LiveChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cidFromUrl = searchParams.get('cid');

  const { user } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    messages,
    onlineUserIds,
    typingUsers,
    availableUsers,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    soundEnabled,
    fetchConversations,
    fetchAvailableUsers,
    selectConversation,
    sendMessage,
    startConversationWithUser,
    deleteMessage,
    pinMessage,
    emitTyping,
    toggleSound,
    initChat,
    getActiveTheme,
  } = useChatStore();

  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'EMPLOYEE' | 'ADMIN' | 'FOOD_OWNER' | 'GROUP'>('ALL');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [orderNoteInput, setOrderNoteInput] = useState('');

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingStartTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket and chat on mount
  useEffect(() => {
    initChat();
    fetchAvailableUsers();
  }, [initChat, fetchAvailableUsers]);

  // Handle URL cid parameter
  useEffect(() => {
    if (cidFromUrl && cidFromUrl !== activeConversationId) {
      selectConversation(cidFromUrl);
    }
  }, [cidFromUrl, activeConversationId, selectConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeConversationId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeConversationId]);

  // Clean up recording stream on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const otherUser = activeConversation?.otherUser;
  const isGroup = activeConversation?.conversationType === 'GROUP';
  const isOtherUserOnline = otherUser ? onlineUserIds.includes(otherUser.id) : false;
  const isTyping = activeConversationId ? !!typingUsers[activeConversationId] : false;

  // Active theme calculation
  const activeTheme = getActiveTheme();
  const isDarkMode = activeTheme.mode === 'dark';
  const themeBgStyle = getThemeBackgroundStyle(activeTheme);
  const bubbleBgColor = activeTheme.bubbleColor || '#2563eb';

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (!activeConversationId) return;

    if (otherUser) {
      emitTyping(activeConversationId, otherUser.id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (otherUser) {
        emitTyping(activeConversationId, otherUser.id, false);
      }
    }, 2000);
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      recordingStartTimeRef.current = Date.now();
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied. Please allow microphone access.');
      } else {
        toast.error('Could not access microphone.');
      }
    }
  };

  // Cancel voice recording
  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
    setIsRecordingVoice(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // Send voice recording
  const sendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !activeConversationId) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recordedSeconds = Math.max(
      1,
      Math.round((Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000)
    );

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (voiceStreamRef.current) {
          voiceStreamRef.current.getTracks().forEach((track) => track.stop());
          voiceStreamRef.current = null;
        }

        setIsRecordingVoice(false);
        setRecordingDuration(0);

        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([audioBlob], `voice-note-${Date.now()}-${recordedSeconds}s.${ext}`, {
          type: recorder.mimeType || 'audio/webm',
        });

        setFileUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await api.post('/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const uploaded = uploadRes.data.data;
        const attachmentData = {
          url: uploaded.url,
          name: uploaded.filename,
          size: uploaded.size,
          type: `${uploaded.mimetype};duration=${recordedSeconds}`,
          duration: recordedSeconds,
        };
        setFileUploading(false);

        const mins = Math.floor(recordedSeconds / 60);
        const secs = Math.floor(recordedSeconds % 60);
        const formattedTimer = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

        await sendMessage(
          activeConversationId,
          `🎤 Voice Message (${formattedTimer})`,
          'AUDIO',
          attachmentData
        );
      } catch (err: any) {
        setFileUploading(false);
        toast.error('Failed to send voice message');
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversationId) return;

    const trimmed = inputText.trim();
    if (!trimmed && !selectedFile) return;

    try {
      let attachmentData: any = null;

      if (selectedFile) {
        setFileUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await api.post('/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const uploaded = uploadRes.data.data;
        attachmentData = {
          url: uploaded.url,
          name: uploaded.filename,
          size: uploaded.size,
          type: uploaded.mimetype,
        };
        setSelectedFile(null);
        setFileUploading(false);
      }

      const msgType: MessageType = attachmentData
        ? attachmentData.type.startsWith('image/')
          ? 'IMAGE'
          : attachmentData.type.startsWith('video/')
          ? 'VIDEO'
          : attachmentData.type.startsWith('audio/')
          ? 'AUDIO'
          : 'DOCUMENT'
        : 'TEXT';

      const content = trimmed || (attachmentData ? attachmentData.name : '');

      setInputText('');
      if (otherUser) {
        emitTyping(activeConversationId, otherUser.id, false);
      }

      await sendMessage(activeConversationId, content, msgType, attachmentData);
    } catch (err: any) {
      setFileUploading(false);
      toast.error(err?.response?.data?.message || 'Failed to send message');
    }
  };

  // Send food order ready notification (Food Owner specific quick action)
  const handleSendOrderNotification = async () => {
    if (!activeConversationId || !orderNumberInput.trim()) return;

    try {
      const orderContent = `🍽️ ORDER READY ALERT: Order #${orderNumberInput.trim()} is ready for pickup at the cafeteria counter! ${
        orderNoteInput.trim() ? `Note: ${orderNoteInput.trim()}` : ''
      }`;

      await sendMessage(activeConversationId, orderContent, 'ORDER_ALERT');
      toast.success('Food order notification sent to employee!');
      setShowOrderModal(false);
      setOrderNumberInput('');
      setOrderNoteInput('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send order notification');
    }
  };

  // Quick reply templates
  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  // Start chat with user from modal
  const handleStartChat = async (targetUser: ChatUser) => {
    try {
      const convId = await startConversationWithUser(targetUser.id);
      if (convId) {
        setSearchParams({ cid: convId });
        setShowNewChatModal(false);
      }
    } catch {
      toast.error('Could not start conversation');
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const isConvGroup = c.conversationType === 'GROUP';

    if (roleFilter === 'GROUP' && !isConvGroup) return false;
    if (roleFilter !== 'ALL' && roleFilter !== 'GROUP') {
      if (isConvGroup) return false;
      if (c.otherUser?.role !== roleFilter) return false;
    }

    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();

    if (isConvGroup) {
      return (
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    if (!c.otherUser) return false;
    return (
      c.otherUser.name.toLowerCase().includes(q) ||
      c.otherUser.email.toLowerCase().includes(q) ||
      (c.otherUser.employeeId && c.otherUser.employeeId.toLowerCase().includes(q)) ||
      (c.otherUser.department && c.otherUser.department.toLowerCase().includes(q))
    );
  });

  // Filter users for new chat modal
  const filteredNewUsers = availableUsers.filter((u) => {
    if (newChatSearch === '') return true;
    return (
      u.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(newChatSearch.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(newChatSearch.toLowerCase()))
    );
  });

  const formatMessageTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'hh:mm a');
    } catch {
      return '';
    }
  };

  const formatMessageDateHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isToday(d)) return 'Today';
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'MMM dd, yyyy');
    } catch {
      return '';
    }
  };

  const formatRecordingTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getFileIcon = (name?: string | null, type?: string | null) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (['ppt', 'pptx'].includes(ext || '')) {
      return <Presentation className="w-4 h-4 text-orange-500 shrink-0" />;
    }
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '') || type?.startsWith('video/')) {
      return <Film className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-primary-500 shrink-0" />;
  };

  const extractAudioDuration = (msg: ChatMessage): number => {
    if (msg.duration && msg.duration > 0) return msg.duration;
    if (msg.attachmentType) {
      const match = msg.attachmentType.match(/duration=(\d+(\.\d+)?)/);
      if (match) return Math.round(parseFloat(match[1]));
    }
    if (msg.attachmentName) {
      const match = msg.attachmentName.match(/[-_](\d+)s\./);
      if (match) return parseInt(match[1], 10);
    }
    if (msg.messageContent) {
      const match = msg.messageContent.match(/\((\d+):(\d+)\)/);
      if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
    }
    return 0;
  };

  const copyMessageContent = (msg: ChatMessage) => {
    const text = msg.messageContent || msg.attachmentUrl || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard!');
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400', 'rounded-2xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'rounded-2xl'), 2500);
    }
  };

  const renderMessageContent = (content: string, isSentByMe: boolean, isOrderAlert: boolean) => {
    if (!content) return null;
    const urlPattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
    const parts = content.split(urlPattern);

    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`underline font-semibold break-all hover:opacity-85 transition-opacity ${
              isSentByMe
                ? 'text-sky-200 decoration-sky-300'
                : isOrderAlert
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-primary-600 dark:text-primary-400'
            }`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-100 text-primary-700">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'FOOD_OWNER':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
            <Utensils className="w-3 h-3" /> Cafeteria
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
            <User className="w-3 h-3" /> Employee
          </span>
        );
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row relative">
      <ThemeSettingsModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        activeConversation={activeConversation}
      />
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
      />
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
      />

      {/* ============================================================ */}
      {/* SIDEBAR: CONVERSATION LIST */}
      {/* ============================================================ */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Live Chat</h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="flex items-center gap-1">
              {/* Theme Settings Button */}
              <button
                onClick={() => setShowThemeModal(true)}
                title="Chat Theme Settings"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Palette className="w-4 h-4" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Mute notification sounds' : 'Unmute notification sounds'}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </button>

              {/* New Group Button (Admin Only) */}
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  title="Create New Team Group"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg shadow-xs transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Group</span>
                </button>
              )}

              {/* New Chat Button */}
              <button
                onClick={() => setShowNewChatModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations, teams, name, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'GROUP', label: '👥 Groups' },
              { id: 'EMPLOYEE', label: 'Employees' },
              { id: 'ADMIN', label: 'Admin' },
              { id: 'FOOD_OWNER', label: 'Cafeteria' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id as any)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors ${
                  roleFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingConversations ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-700 mb-1">No conversations found</p>
              <p className="text-[11px] text-slate-500 mb-4">
                Start a direct chat or create a team group.
              </p>
              <div className="flex items-center justify-center gap-2">
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200"
                  >
                    <Users className="w-3.5 h-3.5" /> Create Group
                  </button>
                )}
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Start Chat
                </button>
              </div>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isConvGroup = conv.conversationType === 'GROUP';
              const other = conv.otherUser;
              const isOnline = other ? onlineUserIds.includes(other.id) : false;
              const isSelected = activeConversationId === conv.id;
              const isCurrentTyping = typingUsers[conv.id];

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    selectConversation(conv.id);
                    setSearchParams({ cid: conv.id });
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary-50/70 border-l-4 border-primary-600'
                      : 'hover:bg-slate-100/70'
                  }`}
                >
                  {/* Avatar & Online status dot */}
                  <div className="relative shrink-0 mt-0.5">
                    {isConvGroup ? (
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
                        <Users className="w-5 h-5" />
                      </div>
                    ) : other?.avatar ? (
                      <img
                        src={other.avatar}
                        alt={other.name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                        {other?.name ? other.name[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    {!isConvGroup && (
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    )}
                  </div>

                  {/* Info & preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {isConvGroup ? conv.title || 'Team Group' : other?.name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatMessageTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      {isConvGroup ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <Users className="w-2.5 h-2.5" /> {conv.participants?.length || 0} members
                        </span>
                      ) : (
                        getRoleBadge(other?.role)
                      )}
                      {!isConvGroup && other?.employeeId && (
                        <span className="text-[10px] text-slate-400">ID: {other.employeeId}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 truncate">
                        {isCurrentTyping ? (
                          <span className="text-primary-600 font-medium italic animate-pulse">
                            typing...
                          </span>
                        ) : conv.lastMessage ? (
                          conv.lastMessage.messageType === 'ORDER_ALERT' ? (
                            <span className="text-amber-700 font-semibold truncate flex items-center gap-1">
                              <Utensils className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">
                                {conv.lastMessage.messageContent.split('\n')[0] || 'Food Order'}
                              </span>
                            </span>
                          ) : conv.lastMessage.messageType === 'CALL_LOG' ? (
                            <span className="text-primary-600 font-medium">
                              {conv.lastMessage.messageContent}
                            </span>
                          ) : conv.lastMessage.messageType === 'AUDIO' ? (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Mic className="w-3 h-3 text-primary-600" /> Voice Message
                            </span>
                          ) : conv.lastMessage.messageType === 'VIDEO' ? (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Film className="w-3 h-3 text-indigo-600" /> Video Attachment
                            </span>
                          ) : conv.lastMessage.messageType === 'IMAGE' ? (
                            <span>📷 Image</span>
                          ) : conv.lastMessage.messageType === 'DOCUMENT' ? (
                            <span>📄 {conv.lastMessage.attachmentName || 'Attachment'}</span>
                          ) : (
                            conv.lastMessage.messageContent
                          )
                        ) : (
                          <span className="italic text-slate-400">No messages yet</span>
                        )}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary-600 text-white rounded-full shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN CHAT AREA */}
      {/* ============================================================ */}
      <div className={`flex-1 flex flex-col bg-white ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation && (isGroup || otherUser) ? (
          <>
            {/* Chat Header */}
            <div
              className={`h-16 px-4 md:px-6 border-b flex items-center justify-between shrink-0 transition-colors ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => {
                    selectConversation(null);
                    setSearchParams({});
                  }}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Avatar */}
                <div className="relative">
                  {isGroup ? (
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : otherUser?.avatar ? (
                    <img
                      src={otherUser.avatar}
                      alt={otherUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                      {otherUser?.name ? otherUser.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  {!isGroup && (
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        isOtherUserOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {isGroup ? activeConversation.title || 'Group Chat' : otherUser?.name}
                    </h3>
                    {isGroup ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                        Group ({activeConversation.participants?.length || 0})
                      </span>
                    ) : (
                      getRoleBadge(otherUser?.role)
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isGroup ? (
                      <span>
                        {activeConversation.description ||
                          `${activeConversation.participants?.length || 0} team members`}
                      </span>
                    ) : isTyping ? (
                      <span className="text-primary-600 font-medium animate-pulse">Typing...</span>
                    ) : isOtherUserOnline ? (
                      <span className="text-emerald-600 font-medium">Active now</span>
                    ) : otherUser?.lastSeenAt ? (
                      <span>Last seen {format(new Date(otherUser.lastSeenAt), 'MMM d, h:mm a')}</span>
                    ) : (
                      <span>Offline</span>
                    )}

                    {!isGroup && otherUser?.employeeId && <span>• ID: {otherUser.employeeId}</span>}
                    {!isGroup && otherUser?.department && <span>• {otherUser.department}</span>}
                  </div>
                </div>
              </div>

              {/* Header Actions: Theme Settings */}
              <div className="flex items-center gap-1.5 md:gap-2">
                {/* Theme Customizer Button */}
                <button
                  onClick={() => setShowThemeModal(true)}
                  className={`p-2.5 rounded-xl transition-colors ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  title={isGroup ? 'Group Theme (Admin Controlled)' : 'Customize Chat Theme'}
                >
                  <Palette className="w-4 h-4" />
                </button>

                {/* Quick button for Food Owner to notify ready order */}
                {user?.role === 'FOOD_OWNER' && !isGroup && (
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-colors shadow-sm"
                  >
                    <Utensils className="w-3.5 h-3.5 text-amber-600" />
                    <span>Order Ready Alert</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pinned Messages Header Banner */}
            {currentMessages.some((m) => m.isPinned && !m.isDeleted) && (
              <div className="bg-amber-50/95 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 flex items-center justify-between text-xs text-amber-950 dark:text-amber-200 backdrop-blur-md z-10 shadow-xs">
                <div
                  className="flex items-center gap-2 truncate cursor-pointer flex-1"
                  onClick={() => {
                    const firstPinned = currentMessages.find((m) => m.isPinned && !m.isDeleted);
                    if (firstPinned) scrollToMessage(firstPinned.id);
                  }}
                  title="Click to jump to pinned message"
                >
                  <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500 shrink-0" />
                  <span className="font-bold shrink-0">Pinned Message:</span>
                  <span className="truncate text-amber-900 dark:text-amber-200 font-medium text-[11px]">
                    {currentMessages.find((m) => m.isPinned && !m.isDeleted)?.messageContent?.split('\n')[0] ||
                      currentMessages.find((m) => m.isPinned && !m.isDeleted)?.attachmentName ||
                      'Pinned Item'}
                  </span>
                  {currentMessages.filter((m) => m.isPinned && !m.isDeleted).length > 1 && (
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                      +{currentMessages.filter((m) => m.isPinned && !m.isDeleted).length - 1} more
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    const firstPinned = currentMessages.find((m) => m.isPinned && !m.isDeleted);
                    if (firstPinned && activeConversationId) {
                      pinMessage(firstPinned.id, activeConversationId);
                    }
                  }}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 hover:underline shrink-0 ml-3"
                  title="Unpin message"
                >
                  Unpin
                </button>
              </div>
            )}

            {/* Messages Thread with Dynamic Theme Background */}
            <div
              style={themeBgStyle}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 transition-all duration-300"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading message history...
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                    <Send className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">
                    {isGroup
                      ? `Team conversation for ${activeConversation.title}`
                      : `Direct communication with ${otherUser?.name}`}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mb-4">
                    Send messages, voice recordings, and file attachments in real time.
                  </p>
                </div>
              ) : (
                currentMessages.map((msg, index) => {
                  const isSentByMe = msg.senderId === user?.id;
                  const prevMsg = index > 0 ? currentMessages[index - 1] : null;
                  const showDateHeader =
                    !prevMsg ||
                    format(new Date(prevMsg.createdAt), 'yyyy-MM-dd') !==
                      format(new Date(msg.createdAt), 'yyyy-MM-dd');

                  // Specialized Call Log Card
                  if (msg.messageType === 'CALL_LOG') {
                    const isMissed = msg.messageContent.toLowerCase().includes('missed');
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateHeader && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 text-slate-600">
                              {formatMessageDateHeader(msg.createdAt)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-center my-2">
                          <div
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-medium border shadow-xs ${
                              isMissed
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isMissed ? (
                              <PhoneMissed className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            ) : (
                              <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span>{msg.messageContent}</span>
                            <span className="text-[10px] opacity-60 ml-1">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateHeader && (
                        <div className="flex justify-center my-3">
                          <span
                            className={`px-3 py-0.5 rounded-full text-[10px] font-medium ${
                              isDarkMode
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : 'bg-slate-200/80 text-slate-600'
                            }`}
                          >
                            {formatMessageDateHeader(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      <div
                        id={`msg-${msg.id}`}
                        className={`flex items-end gap-2 group transition-all ${
                          isSentByMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Avatar for received messages */}
                        {!isSentByMe && (
                          <div className="shrink-0 mb-1">
                            {msg.sender?.avatar ? (
                              <img
                                src={msg.sender.avatar}
                                alt={msg.sender.name}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {msg.sender?.name ? msg.sender.name[0].toUpperCase() : 'U'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Bubble Container */}
                        <div className="max-w-[85%] md:max-w-[70%] space-y-1">
                          {/* Sender name for group chats */}
                          {isGroup && !isSentByMe && msg.sender && (
                            <span className="text-[10px] font-semibold text-slate-400 pl-1 block">
                              {msg.sender.name}
                            </span>
                          )}

                          <div
                            style={isSentByMe && msg.messageType !== 'ORDER_ALERT' && msg.messageType !== 'LEAVE_NOTICE' ? { backgroundColor: bubbleBgColor } : undefined}
                            className={`relative px-4 py-3 rounded-2xl shadow-sm text-xs leading-relaxed break-words ${
                              msg.messageType === 'ORDER_ALERT'
                                ? 'bg-amber-50/95 border-2 border-amber-300 text-slate-800 shadow-amber-500/10 dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-100 ' + (isSentByMe ? 'rounded-br-xs' : 'rounded-bl-xs')
                                : msg.messageType === 'LEAVE_NOTICE'
                                ? 'bg-indigo-50/95 border-2 border-indigo-300 text-slate-800 shadow-indigo-500/10 dark:bg-indigo-950/40 dark:border-indigo-700/60 dark:text-indigo-100 ' + (isSentByMe ? 'rounded-br-xs' : 'rounded-bl-xs')
                                : isSentByMe
                                ? 'text-white rounded-br-xs'
                                : isDarkMode
                                ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-xs'
                                : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
                            }`}
                          >
                            {/* Forwarded Header */}
                            {msg.isForwarded && (
                              <div className={`flex items-center gap-1 text-[10px] italic mb-1.5 ${isSentByMe && msg.messageType !== 'ORDER_ALERT' && msg.messageType !== 'LEAVE_NOTICE' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                <Share2 className="w-3 h-3" />
                                <span>Forwarded</span>
                              </div>
                            )}

                            {/* Pinned Indicator Header */}
                            {msg.isPinned && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold mb-1.5">
                                <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                                <span>Pinned message</span>
                              </div>
                            )}

                            {/* Special Leave Notice Banner */}
                            {msg.messageType === 'LEAVE_NOTICE' && (
                              <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-300 mb-2 pb-1.5 border-b border-indigo-200 dark:border-indigo-700/60">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-xs uppercase tracking-wider font-extrabold">Leave Notification</span>
                                </div>
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold px-2 py-0.5 rounded-full">
                                  Official Notice
                                </span>
                              </div>
                            )}

                            {/* Special Order Alert Banner */}
                            {msg.messageType === 'ORDER_ALERT' && (
                              <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300 mb-2 pb-1.5 border-b border-amber-300/80 dark:border-amber-700/60">
                                <div className="flex items-center gap-1.5">
                                  <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  <span className="text-xs uppercase tracking-wider font-extrabold">Cafeteria Food Order</span>
                                </div>
                                <span className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold px-2 py-0.5 rounded-full">
                                  Automated Order
                                </span>
                              </div>
                            )}

                            {/* Image Attachment */}
                            {msg.attachmentUrl && msg.messageType === 'IMAGE' && (
                              <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
                                <img
                                  src={msg.attachmentUrl}
                                  alt={msg.attachmentName || 'Attachment'}
                                  className="max-h-60 w-auto rounded-lg object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => window.open(msg.attachmentUrl!, '_blank')}
                                />
                              </div>
                            )}

                            {/* Video Attachment */}
                            {msg.attachmentUrl && msg.messageType === 'VIDEO' && (
                              <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/80">
                                <video
                                  src={msg.attachmentUrl}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="max-h-72 w-full rounded-lg bg-black"
                                />
                              </div>
                            )}

                            {/* Voice / Audio Attachment */}
                            {msg.attachmentUrl && msg.messageType === 'AUDIO' && (
                              <div className="mb-1.5">
                                <AudioPlayer
                                  src={msg.attachmentUrl}
                                  isSentByMe={isSentByMe}
                                  initialDuration={extractAudioDuration(msg)}
                                />
                              </div>
                            )}

                            {/* Document / Office Attachment */}
                            {msg.attachmentUrl && msg.messageType === 'DOCUMENT' && (
                              <div
                                className={`flex items-center gap-2 p-2.5 rounded-xl mb-1.5 transition-colors ${
                                  isSentByMe
                                    ? 'bg-black/20 text-white'
                                    : isDarkMode
                                    ? 'bg-slate-700/80 text-white'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {getFileIcon(msg.attachmentName, msg.attachmentType)}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate text-[11px]" title={msg.attachmentName || 'Download File'}>
                                    {msg.attachmentName || 'Download File'}
                                  </p>
                                  {msg.attachmentSize && (
                                    <p className="text-[9px] opacity-75">
                                      {(msg.attachmentSize / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Preview in browser */}
                                  <a
                                    href={msg.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                    title="Open / Preview in new tab"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                  {/* Direct Download with Content-Disposition */}
                                  <a
                                    href={`/api/chat/download/${msg.attachmentUrl.substring(msg.attachmentUrl.lastIndexOf('/') + 1)}?name=${encodeURIComponent(msg.attachmentName || 'file')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.attachmentName || 'file'}
                                    className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                    title="Download File"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Message text with clickable URL links */}
                            {msg.messageContent &&
                              !msg.messageContent.startsWith('🎤 Voice Message') &&
                              msg.messageContent !== msg.attachmentName && (
                                <p
                                  className={`whitespace-pre-wrap ${
                                    msg.messageType === 'ORDER_ALERT'
                                      ? 'font-mono text-[11.5px] leading-relaxed text-slate-800 dark:text-slate-100 font-medium'
                                      : ''
                                  }`}
                                >
                                  {renderMessageContent(msg.messageContent, isSentByMe, msg.messageType === 'ORDER_ALERT')}
                                </p>
                              )}

                            {/* Metadata footer */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] select-none ${
                                msg.messageType === 'ORDER_ALERT'
                                  ? 'text-amber-800/70 dark:text-amber-300/70 font-sans'
                                  : isSentByMe
                                  ? 'text-white/80'
                                  : isDarkMode
                                  ? 'text-slate-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              <span>{formatMessageTime(msg.createdAt)}</span>

                              {/* Delivery & Read Receipts for sent messages */}
                              {isSentByMe && (
                                <span title={msg.readAt ? 'Read' : msg.deliveredAt ? 'Delivered' : 'Sent'}>
                                  {msg.readAt ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                                  ) : msg.deliveredAt ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-white/70" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Message Action Bar: Copy, Forward, Pin, Delete */}
                        {!msg.isDeleted && (
                          <div
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-0.5 transition-all self-center shrink-0 mb-1"
                          >
                            {/* Copy */}
                            <button
                              type="button"
                              onClick={() => copyMessageContent(msg)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Copy message"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Forward */}
                            <button
                              type="button"
                              onClick={() => setForwardingMessage(msg)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Forward message"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Pin */}
                            <button
                              type="button"
                              onClick={() => {
                                if (activeConversationId) {
                                  pinMessage(msg.id, activeConversationId);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                msg.isPinned
                                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                                  : 'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                              title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                            >
                              <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </button>

                            {/* Delete (Only sender OR Admin can delete) */}
                            {(isSentByMe || user?.role === 'ADMIN') && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Delete this message?')) {
                                    deleteMessage(msg.id, activeConversationId);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates for Food Owner / Fast replies */}
            {user?.role === 'FOOD_OWNER' && !isGroup && (
              <div className="px-4 py-1.5 bg-amber-50/50 border-t border-amber-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-amber-700 shrink-0">Quick Replies:</span>
                {[
                  'Your order is ready for pickup! ☕',
                  'Your food is being freshly prepared 🍳',
                  'Item is ready at Cafeteria Counter 1 🥪',
                  'Please collect your tea/coffee',
                ].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(tpl)}
                    className="px-2 py-0.5 text-[11px] bg-white border border-amber-200 text-amber-800 rounded-md hover:bg-amber-100 whitespace-nowrap transition-colors"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            )}

            {/* Selected File Preview */}
            {selectedFile && (
              <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2 truncate">
                  {getFileIcon(selectedFile.name, selectedFile.type)}
                  <span className="font-medium truncate">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-500">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Message Input Bar with Voice Recording & Attachment Controls */}
            <form
              onSubmit={handleSend}
              className={`p-3 md:p-4 border-t transition-colors ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {isRecordingVoice ? (
                /* ================= Live Voice Recording Control Bar ================= */
                <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl animate-pulse">
                  <div className="flex items-center gap-2.5 text-red-600 font-semibold text-xs">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                    <span>Recording Voice Message...</span>
                    <span className="font-mono text-xs px-2 py-0.5 bg-red-100 rounded-md text-red-700">
                      {formatRecordingTimer(recordingDuration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Cancel Recording */}
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-100 transition-colors"
                      title="Discard Recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Send Voice Message */}
                    <button
                      type="button"
                      onClick={sendVoiceRecording}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs font-semibold text-xs transition-colors"
                      title="Send Voice Message"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ================= Normal Text & Attachment Bar ================= */
                <div className="flex items-center gap-2">
                  {/* File Attachment Button (Images, Videos, PDFs, Office Documents) */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.rtf"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Files (Images, Videos, PDFs, Word, Excel, PowerPoint)"
                    className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Input Text Box */}
                  <input
                    type="text"
                    placeholder={`Message ${isGroup ? activeConversation.title || 'team' : otherUser?.name}...`}
                    value={inputText}
                    onChange={handleInputChange}
                    className={`flex-1 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-900'
                    }`}
                  />

                  {/* Voice Recording Button */}
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    title="Record Voice Message"
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedFile) || isSendingMessage || fileUploading}
                    style={{ backgroundColor: bubbleBgColor }}
                    className="p-2.5 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all shrink-0"
                    title="Send Message"
                  >
                    {isSendingMessage || fileUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </form>
          </>
        ) : (
          /* Empty state when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="w-16 h-16 rounded-2xl bg-primary-100/60 text-primary-600 flex items-center justify-center mb-4 shadow-sm">
              <Send className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              WorkPulse Advanced Communication Center
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              Select an existing personal or group conversation to chat, share files, and record voice notes.
            </p>
            <div className="flex items-center gap-2">
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-all shadow-sm"
                >
                  <Users className="w-4 h-4" /> Create Team Group
                </button>
              )}
              <button
                onClick={() => setShowNewChatModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-600/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Start Direct Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* NEW CHAT MODAL */}
      {/* ============================================================ */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Start New Direct Conversation</h3>
                <p className="text-xs text-slate-500">Choose a colleague or staff member</p>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, employee ID, department..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
            </div>

            {/* User List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredNewUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No users found matching "{newChatSearch}"
                </div>
              ) : (
                filteredNewUsers.map((targetUser) => {
                  const isOnline = onlineUserIds.includes(targetUser.id);
                  return (
                    <div
                      key={targetUser.id}
                      onClick={() => handleStartChat(targetUser)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {targetUser.avatar ? (
                            <img
                              src={targetUser.avatar}
                              alt={targetUser.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                              {targetUser.name ? targetUser.name[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900">
                              {targetUser.name}
                            </span>
                            {getRoleBadge(targetUser.role)}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {targetUser.employeeId ? `ID: ${targetUser.employeeId} • ` : ''}
                            {targetUser.department || targetUser.designation || targetUser.email}
                          </p>
                        </div>
                      </div>

                      <button className="px-3 py-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        Chat
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FOOD OWNER: ORDER READY MODAL */}
      {/* ============================================================ */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-500/10">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">Send Food Ready Alert</h3>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Order Number / ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. ORD-1024"
                  value={orderNumberInput}
                  onChange={(e) => setOrderNumberInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note / Pickup Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please pick up at Counter 1"
                  value={orderNoteInput}
                  onChange={(e) => setOrderNoteInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!orderNumberInput.trim()}
                  onClick={handleSendOrderNotification}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                >
                  Send Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
