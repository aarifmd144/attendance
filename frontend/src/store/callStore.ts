import { create } from 'zustand';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { ChatUser, CallRecord, CallType } from '../types';
import {
  startIncomingRingtone,
  startOutgoingRingtone,
  playCallConnectedSound,
  playCallEndedSound,
} from '../utils/sound';
import toast from 'react-hot-toast';

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export interface GroupParticipantState {
  user: ChatUser;
  stream?: MediaStream;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

interface IncomingCallData {
  callId: string;
  conversationId: string;
  caller: ChatUser;
  callType: CallType;
  isGroup: boolean;
  groupTitle?: string;
  offer?: any;
}

interface CallStoreState {
  callState: 'idle' | 'outgoing' | 'incoming' | 'connected';
  callId: string | null;
  conversationId: string | null;
  callType: CallType;
  isGroup: boolean;
  partner: ChatUser | null;
  groupTitle: string | null;
  groupParticipants: Record<string, GroupParticipantState>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeakerView: boolean;
  activeSpeakerId: string | null;
  durationSeconds: number;
  isMinimized: boolean;
  incomingCallData: IncomingCallData | null;
  callHistory: CallRecord[];
  isLoadingHistory: boolean;
  showHistoryModal: boolean;

  // Actions
  initiateCall: (conversationId: string, recipient: ChatUser, callType: CallType) => Promise<void>;
  initiateGroupCall: (conversationId: string, groupTitle: string, callType: CallType) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: (endForEveryone?: boolean) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleSpeakerView: () => void;
  toggleMinimized: () => void;
  fetchCallHistory: (conversationId?: string) => Promise<void>;
  setShowHistoryModal: (show: boolean) => void;
  initCallListeners: () => void;
  cleanupCall: () => void;
}

// Module-level references for WebRTC and ringtones
let activePeerConnection: RTCPeerConnection | null = null;
const groupPeerConnections: Map<string, RTCPeerConnection> = new Map();
let stopCurrentRingtone: (() => void) | null = null;
let durationInterval: any = null;
let screenTrackOriginalVideo: MediaStreamTrack | null = null;

export const useCallStore = create<CallStoreState>((set, get) => ({
  callState: 'idle',
  callId: null,
  conversationId: null,
  callType: 'AUDIO',
  isGroup: false,
  partner: null,
  groupTitle: null,
  groupParticipants: {},
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isSpeakerView: false,
  activeSpeakerId: null,
  durationSeconds: 0,
  isMinimized: false,
  incomingCallData: null,
  callHistory: [],
  isLoadingHistory: false,
  showHistoryModal: false,

  initiateCall: async (conversationId: string, recipient: ChatUser, callType: CallType) => {
    try {
      const socket = getSocket();
      if (!socket) {
        toast.error('Network socket is disconnected');
        return;
      }

      // Request user media
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'VIDEO',
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          toast.error('Microphone or Camera access was denied. Please allow permissions in browser settings.');
        } else {
          toast.error('Unable to access audio/video devices.');
        }
        return;
      }

      set({
        callState: 'outgoing',
        conversationId,
        callType,
        isGroup: false,
        partner: recipient,
        localStream: stream,
        durationSeconds: 0,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isMinimized: false,
      });

      // Start outgoing telephone ringtone
      if (stopCurrentRingtone) stopCurrentRingtone();
      stopCurrentRingtone = startOutgoingRingtone();

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      activePeerConnection = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && get().callId) {
          socket.emit('call_candidate', {
            targetUserId: recipient.id,
            candidate: event.candidate,
            callId: get().callId,
          });
        }
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'VIDEO',
      });
      await pc.setLocalDescription(offer);

      // Emit call_user
      socket.emit(
        'call_user',
        {
          conversationId,
          recipientId: recipient.id,
          callType,
          offer,
        },
        (response: any) => {
          if (response?.success && response.callId) {
            set({ callId: response.callId });
          } else {
            get().endCall();
            toast.error(response?.message || 'Call failed to initiate');
          }
        }
      );
    } catch (err: any) {
      console.error('initiateCall error:', err);
      get().endCall();
      toast.error('Could not initiate call');
    }
  },

  initiateGroupCall: async (conversationId: string, groupTitle: string, callType: CallType) => {
    try {
      const socket = getSocket();
      if (!socket) {
        toast.error('Network socket is disconnected');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'VIDEO',
        });
      } catch (err: any) {
        toast.error('Unable to access audio or video devices.');
        return;
      }

      set({
        callState: 'connected',
        conversationId,
        callType,
        isGroup: true,
        groupTitle,
        localStream: stream,
        durationSeconds: 0,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isMinimized: false,
      });

      // Start duration counter
      if (durationInterval) clearInterval(durationInterval);
      durationInterval = setInterval(() => {
        set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
      }, 1000);

      socket.emit(
        'group_call_start',
        { conversationId, callType },
        (res: any) => {
          if (res?.success && res.callId) {
            set({ callId: res.callId });
            toast.success(`Group ${callType === 'VIDEO' ? 'video' : 'audio'} call started`);
          } else {
            get().endCall();
            toast.error(res?.message || 'Failed to start group call');
          }
        }
      );
    } catch (err) {
      console.error('initiateGroupCall error:', err);
      get().endCall();
      toast.error('Could not start group call');
    }
  },

  acceptIncomingCall: async () => {
    const data = get().incomingCallData;
    if (!data) return;

    if (stopCurrentRingtone) {
      stopCurrentRingtone();
      stopCurrentRingtone = null;
    }

    const socket = getSocket();
    if (!socket) return;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: data.callType === 'VIDEO',
        });
      } catch (err) {
        toast.error('Camera or Microphone access was denied.');
        get().rejectIncomingCall();
        return;
      }

      playCallConnectedSound();

      if (data.isGroup) {
        // Group Call Join
        set({
          callState: 'connected',
          callId: data.callId,
          conversationId: data.conversationId,
          callType: data.callType,
          isGroup: true,
          groupTitle: data.groupTitle || 'Group Meeting',
          localStream: stream,
          durationSeconds: 0,
          incomingCallData: null,
          isMinimized: false,
        });

        if (durationInterval) clearInterval(durationInterval);
        durationInterval = setInterval(() => {
          set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
        }, 1000);

        socket.emit(
          'group_call_join',
          { callId: data.callId, conversationId: data.conversationId },
          async (res: any) => {
            if (res?.success && res.existingParticipants) {
              // Initiate WebRTC peer connection to each existing participant
              for (const part of res.existingParticipants) {
                const pc = new RTCPeerConnection(RTC_CONFIG);
                groupPeerConnections.set(part.id, pc);

                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                pc.ontrack = (event) => {
                  if (event.streams && event.streams[0]) {
                    set((state) => ({
                      groupParticipants: {
                        ...state.groupParticipants,
                        [part.id]: {
                          user: part.user,
                          stream: event.streams[0],
                        },
                      },
                    }));
                  }
                };

                pc.onicecandidate = (event) => {
                  if (event.candidate) {
                    socket.emit('group_call_signal', {
                      callId: data.callId,
                      targetUserId: part.id,
                      signal: { type: 'candidate', candidate: event.candidate },
                    });
                  }
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.emit('group_call_signal', {
                  callId: data.callId,
                  targetUserId: part.id,
                  signal: { type: 'offer', offer },
                });
              }
            }
          }
        );
      } else {
        // 1-on-1 Call Accept
        const pc = new RTCPeerConnection(RTC_CONFIG);
        activePeerConnection = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            set({ remoteStream: event.streams[0] });
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('call_candidate', {
              targetUserId: data.caller.id,
              candidate: event.candidate,
              callId: data.callId,
            });
          }
        };

        if (data.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('call_accepted', {
            callId: data.callId,
            callerId: data.caller.id,
            answer,
          });
        }

        set({
          callState: 'connected',
          callId: data.callId,
          conversationId: data.conversationId,
          callType: data.callType,
          isGroup: false,
          partner: data.caller,
          localStream: stream,
          durationSeconds: 0,
          incomingCallData: null,
          isMinimized: false,
        });

        if (durationInterval) clearInterval(durationInterval);
        durationInterval = setInterval(() => {
          set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
        }, 1000);
      }
    } catch (err: any) {
      console.error('acceptIncomingCall error:', err);
      get().rejectIncomingCall();
      toast.error('Failed to connect call');
    }
  },

  rejectIncomingCall: () => {
    const data = get().incomingCallData;
    if (stopCurrentRingtone) {
      stopCurrentRingtone();
      stopCurrentRingtone = null;
    }

    if (data) {
      const socket = getSocket();
      if (socket) {
        socket.emit('call_rejected', {
          callId: data.callId,
          callerId: data.caller.id,
          conversationId: data.conversationId,
          callType: data.callType,
          reason: 'declined',
        });
      }
    }

    set({ incomingCallData: null });
  },

  endCall: (endForEveryone = false) => {
    if (stopCurrentRingtone) {
      stopCurrentRingtone();
      stopCurrentRingtone = null;
    }

    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    playCallEndedSound();

    const { callId, conversationId, isGroup, partner, durationSeconds, callType, localStream } = get();
    const socket = getSocket();

    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (screenTrackOriginalVideo) {
      screenTrackOriginalVideo.stop();
      screenTrackOriginalVideo = null;
    }

    // Close 1-on-1 RTCPeerConnection
    if (activePeerConnection) {
      activePeerConnection.close();
      activePeerConnection = null;
    }

    // Close all Group RTCPeerConnections
    groupPeerConnections.forEach((pc) => pc.close());
    groupPeerConnections.clear();

    // Notify backend
    if (socket && callId && conversationId) {
      if (isGroup) {
        if (endForEveryone) {
          socket.emit('group_call_end_all', { callId, conversationId, durationSeconds });
        } else {
          socket.emit('group_call_leave', { callId, conversationId });
        }
      } else {
        socket.emit('call_end', {
          callId,
          conversationId,
          recipientId: partner?.id,
          durationSeconds,
          callType,
        });
      }
    }

    set({
      callState: 'idle',
      callId: null,
      conversationId: null,
      partner: null,
      groupTitle: null,
      groupParticipants: {},
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      durationSeconds: 0,
      isMinimized: false,
      incomingCallData: null,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted, isGroup, callId } = get();
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted; // toggle
      const newMuted = !isMuted;
      set({ isMuted: newMuted });

      if (isGroup && callId) {
        const socket = getSocket();
        socket?.emit('group_call_speaking', { callId, isSpeaking: false });
      }
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOff; // toggle
      set({ isVideoOff: !isVideoOff });
    }
  },

  toggleScreenShare: async () => {
    const { isScreenSharing, localStream } = get();

    if (isScreenSharing) {
      // Revert to camera
      if (screenTrackOriginalVideo && localStream) {
        const currentVideoTrack = localStream.getVideoTracks()[0];
        if (currentVideoTrack) {
          localStream.removeTrack(currentVideoTrack);
          currentVideoTrack.stop();
        }
        localStream.addTrack(screenTrackOriginalVideo);

        // Replace track on RTCPeerConnections
        if (activePeerConnection) {
          const sender = activePeerConnection.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrackOriginalVideo);
        }
        groupPeerConnections.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrackOriginalVideo);
        });

        screenTrackOriginalVideo = null;
      }
      set({ isScreenSharing: false });
    } else {
      // Start Screen Share
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];

        if (localStream) {
          const oldVideoTrack = localStream.getVideoTracks()[0];
          screenTrackOriginalVideo = oldVideoTrack || null;
          if (oldVideoTrack) localStream.removeTrack(oldVideoTrack);

          localStream.addTrack(screenTrack);

          if (activePeerConnection) {
            const sender = activePeerConnection.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
          }
          groupPeerConnections.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
          });
        }

        screenTrack.onended = () => {
          get().toggleScreenShare();
        };

        set({ isScreenSharing: true });
      } catch (err) {
        // User cancelled picker
      }
    }
  },

  toggleSpeakerView: () => {
    set((s) => ({ isSpeakerView: !s.isSpeakerView }));
  },

  toggleMinimized: () => {
    set((s) => ({ isMinimized: !s.isMinimized }));
  },

  fetchCallHistory: async (conversationId?: string) => {
    try {
      set({ isLoadingHistory: true });
      const url = conversationId
        ? `/chat/calls/history?conversationId=${conversationId}`
        : '/chat/calls/history';
      const res = await api.get(url);
      set({ callHistory: res.data.data || [], isLoadingHistory: false });
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  setShowHistoryModal: (show: boolean) => {
    set({ showHistoryModal: show });
    if (show) get().fetchCallHistory();
  },

  initCallListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('incoming_call');
    socket.off('group_call_incoming');
    socket.off('call_accepted');
    socket.off('call_rejected');
    socket.off('call_candidate');
    socket.off('call_ended');
    socket.off('group_call_user_joined');
    socket.off('group_call_signal');
    socket.off('group_call_speaking');
    socket.off('group_call_user_left');
    socket.off('group_call_ended');

    // 1-on-1 Incoming Call
    socket.on(
      'incoming_call',
      (data: {
        callId: string;
        conversationId: string;
        caller: ChatUser;
        callType: CallType;
        offer: any;
      }) => {
        // If already in a call, reject with busy
        if (get().callState !== 'idle') {
          socket.emit('call_rejected', {
            callId: data.callId,
            callerId: data.caller.id,
            conversationId: data.conversationId,
            reason: 'busy',
          });
          return;
        }

        if (stopCurrentRingtone) stopCurrentRingtone();
        stopCurrentRingtone = startIncomingRingtone();

        set({
          callState: 'incoming',
          incomingCallData: {
            callId: data.callId,
            conversationId: data.conversationId,
            caller: data.caller,
            callType: data.callType,
            isGroup: false,
            offer: data.offer,
          },
        });
      }
    );

    // Group Incoming Call
    socket.on(
      'group_call_incoming',
      (data: {
        callId: string;
        conversationId: string;
        groupTitle: string;
        initiator: ChatUser;
        callType: CallType;
      }) => {
        if (get().callState !== 'idle') return;

        if (stopCurrentRingtone) stopCurrentRingtone();
        stopCurrentRingtone = startIncomingRingtone();

        set({
          callState: 'incoming',
          incomingCallData: {
            callId: data.callId,
            conversationId: data.conversationId,
            caller: data.initiator,
            callType: data.callType,
            isGroup: true,
            groupTitle: data.groupTitle,
          },
        });
      }
    );

    // 1-on-1 Call Accepted by recipient
    socket.on('call_accepted', async (data: { callId: string; answer: any }) => {
      if (stopCurrentRingtone) {
        stopCurrentRingtone();
        stopCurrentRingtone = null;
      }

      playCallConnectedSound();

      if (activePeerConnection && data.answer) {
        await activePeerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      set({ callState: 'connected', durationSeconds: 0 });

      if (durationInterval) clearInterval(durationInterval);
      durationInterval = setInterval(() => {
        set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
      }, 1000);
    });

    // 1-on-1 Call Rejected
    socket.on('call_rejected', (data: { callId: string; reason: string }) => {
      if (stopCurrentRingtone) {
        stopCurrentRingtone();
        stopCurrentRingtone = null;
      }
      toast.error(data.reason === 'busy' ? 'User is busy on another call' : 'Call declined');
      get().endCall();
    });

    // ICE Candidate
    socket.on('call_candidate', async (data: { candidate: any }) => {
      try {
        if (activePeerConnection && data.candidate) {
          await activePeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    // 1-on-1 Call Ended by partner
    socket.on('call_ended', () => {
      toast('Call ended by partner');
      get().endCall();
    });

    // Group Member Joined
    socket.on('group_call_user_joined', async (data: { userId: string; user: ChatUser; callId: string }) => {
      const { localStream } = get();
      if (!localStream) return;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      groupPeerConnections.set(data.userId, pc);

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set((state) => ({
            groupParticipants: {
              ...state.groupParticipants,
              [data.userId]: {
                user: data.user,
                stream: event.streams[0],
              },
            },
          }));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('group_call_signal', {
            callId: data.callId,
            targetUserId: data.userId,
            signal: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      // Set user in participant list
      set((state) => ({
        groupParticipants: {
          ...state.groupParticipants,
          [data.userId]: { user: data.user },
        },
      }));

      toast.success(`${data.user.name} joined the call`);
    });

    // Group Signal (offer / answer / candidate)
    socket.on(
      'group_call_signal',
      async (data: { callId: string; fromUserId: string; fromUser?: ChatUser; signal: any }) => {
        const { localStream } = get();
        if (!localStream) return;

        let pc = groupPeerConnections.get(data.fromUserId);

        if (!pc) {
          pc = new RTCPeerConnection(RTC_CONFIG);
          groupPeerConnections.set(data.fromUserId, pc);

          localStream.getTracks().forEach((track) => pc!.addTrack(track, localStream));

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              set((state) => ({
                groupParticipants: {
                  ...state.groupParticipants,
                  [data.fromUserId]: {
                    user: data.fromUser || state.groupParticipants[data.fromUserId]?.user || {
                      id: data.fromUserId,
                      email: '',
                      name: 'Participant',
                      role: 'EMPLOYEE',
                    },
                    stream: event.streams[0],
                  },
                },
              }));
            }
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('group_call_signal', {
                callId: data.callId,
                targetUserId: data.fromUserId,
                signal: { type: 'candidate', candidate: event.candidate },
              });
            }
          };
        }

        if (data.signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('group_call_signal', {
            callId: data.callId,
            targetUserId: data.fromUserId,
            signal: { type: 'answer', answer },
          });
        } else if (data.signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
        } else if (data.signal.type === 'candidate' && data.signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      }
    );

    // Group Speaking Indicator
    socket.on('group_call_speaking', (data: { userId: string; isSpeaking: boolean }) => {
      set((state) => {
        const part = state.groupParticipants[data.userId];
        if (!part) return state;
        return {
          groupParticipants: {
            ...state.groupParticipants,
            [data.userId]: { ...part, isSpeaking: data.isSpeaking },
          },
          activeSpeakerId: data.isSpeaking ? data.userId : state.activeSpeakerId,
        };
      });
    });

    // Group User Left
    socket.on('group_call_user_left', (data: { userId: string }) => {
      const pc = groupPeerConnections.get(data.userId);
      if (pc) {
        pc.close();
        groupPeerConnections.delete(data.userId);
      }

      set((state) => {
        const updated = { ...state.groupParticipants };
        const name = updated[data.userId]?.user.name;
        delete updated[data.userId];
        if (name) toast(`${name} left the call`);
        return { groupParticipants: updated };
      });
    });

    // Group Call Ended
    socket.on('group_call_ended', () => {
      toast('Group meeting ended');
      get().endCall();
    });
  },

  cleanupCall: () => {
    get().endCall();
  },
}));
