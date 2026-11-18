import React, { useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  Maximize2,
  Minimize2,
  Grid,
  User as UserIcon,
  Users,
  Shield,
  Volume2,
} from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';

// Helper component to render an HTML video element with an assigned MediaStream
function VideoTile({
  stream,
  name,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  role,
}: {
  stream?: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  role?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
  const showVideo = !isVideoOff && hasVideoTrack;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border-2 transition-all duration-300 shadow-md ${
        isSpeaking ? 'border-emerald-400 ring-4 ring-emerald-500/30' : 'border-slate-800'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Avoid local feedback loop
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          showVideo ? 'opacity-100' : 'opacity-0 absolute'
        } ${isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* Avatar Fallback if camera is disabled or audio-only */}
      {!showVideo && (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-bold border-2 border-slate-700 shadow-inner mb-2">
            {name ? name[0].toUpperCase() : 'U'}
          </div>
          <span className="text-xs font-semibold text-slate-200">{name}</span>
          {isSpeaking && (
            <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium animate-pulse">
              <Volume2 className="w-3 h-3" /> Speaking...
            </span>
          )}
        </div>
      )}

      {/* Overlay label */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-950/70 backdrop-blur-md text-white truncate max-w-[70%] border border-white/10">
          {isLocal ? 'You' : name}
        </span>

        {/* Audio Mute Indicator */}
        {isMuted && (
          <span className="p-1 rounded-md bg-red-600/90 text-white shadow-sm" title="Microphone muted">
            <MicOff className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

export default function ActiveCallOverlay() {
  const { user: currentUser } = useAuthStore();
  const {
    callState,
    callType,
    isGroup,
    partner,
    groupTitle,
    groupParticipants,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isSpeakerView,
    activeSpeakerId,
    durationSeconds,
    isMinimized,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleSpeakerView,
    toggleMinimized,
    endCall,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState !== 'connected' && callState !== 'outgoing') return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const participantList = Object.values(groupParticipants);
  const isVideoCall = callType === 'VIDEO' || isScreenSharing;

  // ============================================================
  // MINIMIZED PICTURE-IN-PICTURE FLOATING BADGE
  // ============================================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-in slide-in-from-bottom-4">
        {/* Local/Remote Miniature Thumbnail */}
        <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden relative flex items-center justify-center">
          {isVideoCall && (remoteStream || localStream) ? (
            <video
              ref={remoteStream ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
              {isGroup ? <Users className="w-4 h-4" /> : partner?.name ? partner.name[0].toUpperCase() : 'C'}
            </div>
          )}
          <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </div>

        <div>
          <p className="text-xs font-bold truncate max-w-[140px]">
            {isGroup ? groupTitle : partner?.name || 'Call'}
          </p>
          <p className="text-[10px] text-emerald-400 font-medium">
            {callState === 'outgoing' ? 'Calling...' : formatTimer(durationSeconds)}
          </p>
        </div>

        {/* Quick controls */}
        <button
          onClick={toggleMute}
          className={`p-2 rounded-xl transition-colors ${
            isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={toggleMinimized}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Expand Call View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => endCall(false)}
          className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
          title="End Call"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ============================================================
  // FULL EXPANDED IN-CHAT / OVERLAY CALL INTERFACE
  // ============================================================
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-4 md:p-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between text-white pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-800/80 border border-white/10 text-primary-400">
            {isGroup ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm md:text-base leading-tight">
                {isGroup ? groupTitle : partner?.name || 'In Call'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {callType === 'VIDEO' ? 'HD Video' : 'Voice Call'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {callState === 'outgoing' ? (
                <span className="italic animate-pulse">Calling recipient...</span>
              ) : (
                <span className="font-mono">{formatTimer(durationSeconds)}</span>
              )}
            </p>
          </div>
        </div>

        {/* View Toggle & Minimize */}
        <div className="flex items-center gap-2">
          {isGroup && (
            <button
              onClick={toggleSpeakerView}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/10"
              title={isSpeakerView ? 'Switch to Grid View' : 'Switch to Speaker View'}
            >
              <Grid className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleMinimized}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/10"
            title="Minimize to Floating Window (Chat while calling)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Call Video/Audio Grid */}
      <div className="flex-1 min-h-0 py-2 flex items-center justify-center">
        {isGroup ? (
          /* ================= Group Call Grid ================= */
          <div
            className={`w-full h-full grid gap-3 max-w-5xl mx-auto ${
              participantList.length <= 1
                ? 'grid-cols-1 md:grid-cols-2'
                : participantList.length <= 3
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-2 md:grid-cols-3'
            }`}
          >
            {/* Local Video Tile */}
            <VideoTile
              stream={localStream}
              name={currentUser?.employee?.name || currentUser?.email || 'You'}
              isLocal={true}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isSpeaking={false}
            />

            {/* Remote Participants */}
            {participantList.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <Users className="w-10 h-10 mb-2 opacity-50 text-primary-400" />
                <p className="text-sm font-semibold text-slate-300 mb-1">Waiting for members to join...</p>
                <p className="text-xs text-slate-500">
                  Notification invites have been dispatched to group participants.
                </p>
              </div>
            ) : (
              participantList.map((part) => (
                <VideoTile
                  key={part.user.id}
                  stream={part.stream}
                  name={part.user.name}
                  isMuted={part.isMuted}
                  isVideoOff={part.isVideoOff}
                  isSpeaking={part.isSpeaking}
                  role={part.user.role}
                />
              ))
            )}
          </div>
        ) : (
          /* ================= 1-on-1 Call View ================= */
          <div className="relative w-full h-full max-w-4xl mx-auto rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
            {/* Remote Video Stream or Avatar */}
            {callType === 'VIDEO' && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-center p-8">
                <div className="relative w-28 h-28 mb-4">
                  {partner?.avatar ? (
                    <img
                      src={partner.avatar}
                      alt={partner.name}
                      className="w-28 h-28 rounded-full object-cover border-4 border-slate-700 shadow-xl"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-primary-700 text-white flex items-center justify-center font-bold text-3xl border-4 border-slate-700 shadow-xl">
                      {partner?.name ? partner.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  {callState === 'connected' && (
                    <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  )}
                </div>

                <h4 className="font-bold text-xl text-white mb-1">{partner?.name}</h4>
                <p className="text-xs text-slate-400 mb-2">
                  {partner?.department || partner?.designation || partner?.email}
                </p>
                <p className="text-xs font-mono text-emerald-400">
                  {callState === 'outgoing' ? 'Ringing...' : formatTimer(durationSeconds)}
                </p>
              </div>
            )}

            {/* Local Video In Picture-in-Picture inset (if video call) */}
            {callType === 'VIDEO' && (
              <div className="absolute top-4 right-4 w-32 md:w-44 aspect-video rounded-2xl overflow-hidden bg-slate-950 border-2 border-white/20 shadow-2xl">
                {!isVideoOff && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-xs text-slate-400">
                    Camera Off
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="pt-4 shrink-0 flex items-center justify-center gap-3 md:gap-4">
        {/* Toggle Microphone */}
        <button
          onClick={toggleMute}
          className={`p-3.5 rounded-2xl transition-all shadow-md active:scale-95 ${
            isMuted
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl transition-all shadow-md active:scale-95 ${
            isVideoOff
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
          }`}
          title={isVideoOff ? 'Enable Camera' : 'Disable Camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Sharing */}
        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl transition-all shadow-md active:scale-95 ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
          }`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Leave Call (Group) */}
        {isGroup && (
          <button
            onClick={() => endCall(false)}
            className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all shadow-md"
            title="Leave this meeting"
          >
            Leave
          </button>
        )}

        {/* End Call for Everyone (Admin/Initiator) or Hang up (1-on-1) */}
        <button
          onClick={() => endCall(true)}
          className="px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 font-bold text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all"
          title={isGroup ? 'End call for everyone' : 'End Call'}
        >
          <PhoneOff className="w-5 h-5" />
          <span>{isGroup && currentUser?.role === 'ADMIN' ? 'End for All' : 'End Call'}</span>
        </button>
      </div>
    </div>
  );
}
