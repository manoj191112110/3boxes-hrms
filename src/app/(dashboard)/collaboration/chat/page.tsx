'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiMessageCircle, FiPlus, FiSend, FiUsers, FiLock, FiGlobe,
  FiCornerUpLeft, FiSearch, FiPhone, FiVideo, FiPaperclip,
  FiMoreVertical, FiStar, FiTrash2, FiX, FiCheck, FiHash,
  FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  status?: string;
}

interface ChatRoom {
  id: string;
  name: string | null;
  roomType: string;
  isE2EE: boolean;
  isAnnouncement: boolean;
  avatarUrl?: string | null;
  members: Array<{ userId: string; role: string }>;
  messages: Array<{ id: string; body: string; createdAt: string; senderId: string }>;
  lastMessageAt: string | null;
  unreadCount: number;
  _count?: { messages: number };
}

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isDeleted: boolean;
  dlpStatus?: string;
  detectedActions?: string | null;
  sender: { id: string; firstName: string; lastName: string; avatar?: string | null; email: string };
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatMembers, setNewChatMembers] = useState<string[]>([]);
  const [newChatName, setNewChatName] = useState('');
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // ─── Fetch Chat Rooms ──────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const r = await fetch('/api/collaboration/chat/rooms', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setRooms(d.rooms || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load chat rooms');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // ─── Fetch Employees for New Chat ──────────────
  const fetchEmployees = useCallback(async (search = '') => {
    setLoadingEmployees(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/employees?limit=50&search=${encodeURIComponent(search)}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setEmployees(d.employees || []);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  }, [scopeQuery]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // ─── Fetch Messages for Selected Room ──────────
  const fetchMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    try {
      const r = await fetch(`/api/collaboration/chat/rooms/${roomId}/messages?limit=100`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMessages(d.messages || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoom) fetchMessages(selectedRoom.id);
  }, [selectedRoom, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send Message ──────────────────────────────
  const handleSendMessage = async () => {
    if (!selectedRoom || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const r = await fetch(`/api/collaboration/chat/rooms/${selectedRoom.id}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ body: newMessage.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setNewMessage('');
      fetchMessages(selectedRoom.id);
      fetchRooms(); // Refresh unread counts
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSendingMessage(false);
    }
  };

  // ─── Create New Chat Room ──────────────────────
  const handleCreateRoom = async () => {
    if (newChatMembers.length === 0) {
      toast.error('Select at least one member');
      return;
    }
    try {
      const r = await fetch('/api/collaboration/chat/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newChatType === 'group' ? (newChatName || 'Group Chat') : undefined,
          roomType: newChatType,
          memberIds: newChatMembers,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');

      if (d.alreadyExisted) {
        toast.success('Direct chat already exists — opened existing room');
      } else {
        toast.success(`${newChatType === 'direct' ? 'Direct' : 'Group'} chat created`);
      }

      setShowNewChatModal(false);
      setNewChatMembers([]);
      setNewChatName('');
      setNewChatType('direct');
      fetchRooms();
      if (d.room) setSelectedRoom(d.room);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  // ─── Get room display name ─────────────────────
  const getRoomName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (room.roomType === 'direct') {
      const otherMember = room.members.find(m => m.userId !== user?.id);
      if (otherMember) {
        const emp = employees.find(e => e.id === otherMember.userId);
        if (emp) return `${emp.firstName} ${emp.lastName}`;
      }
      return 'Direct Chat';
    }
    return 'Group Chat';
  };

  const getRoomIcon = (room: ChatRoom) => {
    if (room.roomType === 'direct') return <FiMessageCircle className="w-4 h-4" />;
    if (room.roomType === 'announcement') return <FiGlobe className="w-4 h-4" />;
    return <FiHash className="w-4 h-4" />;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredRooms = rooms.filter(r => {
    if (!roomSearch) return true;
    const name = getRoomName(r).toLowerCase();
    return name.includes(roomSearch.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 thb-card overflow-hidden">
      {/* ─── Room List ─── */}
      <div className="w-80 border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Chats</h2>
            <button onClick={() => { setShowNewChatModal(true); fetchEmployees(); }} className="p-1.5 rounded-lg text-teal-500 hover:bg-teal-50 transition-colors" title="New Chat">
              <FiPlus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} placeholder="Search chats..." className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <FiMessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No chats yet. Start a new conversation!
            </div>
          ) : filteredRooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-slate-50 ${
                selectedRoom?.id === room.id ? 'bg-teal-50 border-l-2 border-l-teal-500' : 'hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                room.roomType === 'direct' ? 'bg-teal-100 text-teal-600' :
                room.roomType === 'announcement' ? 'bg-amber-100 text-amber-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {getRoomIcon(room)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-800 truncate">{getRoomName(room)}</p>
                  {room.isE2EE && <FiLock className="w-3 h-3 text-teal-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                    {room.messages?.[0]?.body || 'No messages yet'}
                  </p>
                  {room.unreadCount > 0 && (
                    <span className="ml-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-teal-500 text-white text-[9px] font-bold px-1">
                      {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Message Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRoom ? (
          <>
            {/* Room Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selectedRoom.roomType === 'direct' ? 'bg-teal-100 text-teal-600' :
                  selectedRoom.roomType === 'announcement' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {getRoomIcon(selectedRoom)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{getRoomName(selectedRoom)}</h3>
                  <p className="text-[10px] text-slate-400">
                    {selectedRoom.members.length} member{selectedRoom.members.length !== 1 ? 's' : ''}
                    {selectedRoom.isE2EE ? ' · E2EE' : ''}
                    {selectedRoom.isAnnouncement ? ' · Announcement' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-lg text-slate-400 hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Audio Call">
                  <FiPhone className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg text-slate-400 hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Video Call">
                  <FiVideo className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <FiRefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FiMessageCircle className="w-10 h-10 mb-2" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : messages.map(msg => {
                const isOwn = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                      {!isOwn && (
                        <p className="text-[10px] text-slate-500 mb-0.5 ml-1">{msg.sender.firstName} {msg.sender.lastName}</p>
                      )}
                      <div className={`px-3 py-2 rounded-xl text-sm ${
                        isOwn
                          ? 'bg-teal-500 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                        <p className={`text-[9px] ${isOwn ? 'text-teal-400' : 'text-slate-400'} mx-1`}>
                          {formatTime(msg.createdAt)}
                        </p>
                        {msg.dlpStatus === 'flagged' && <FiAlertCircle className="w-3 h-3 text-amber-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="px-4 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg text-slate-400 hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Attach file">
                  <FiPaperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-400"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="p-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Send"
                >
                  {sendingMessage ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FiMessageCircle className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">Select a chat to start messaging</p>
            <p className="text-xs mt-1">Or create a new conversation</p>
          </div>
        )}
      </div>

      {/* ─── New Chat Modal ─── */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">New Conversation</h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-slate-700">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Type */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setNewChatType('direct')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newChatType === 'direct' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiMessageCircle className="w-4 h-4 inline mr-1" /> Direct
              </button>
              <button
                onClick={() => setNewChatType('group')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newChatType === 'group' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiUsers className="w-4 h-4 inline mr-1" /> Group
              </button>
            </div>

            {newChatType === 'group' && (
              <input
                type="text"
                value={newChatName}
                onChange={e => setNewChatName(e.target.value)}
                placeholder="Group name..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            )}

            {/* Employee Search */}
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={e => { setEmployeeSearch(e.target.value); if (e.target.value.length >= 2) fetchEmployees(e.target.value); }}
                placeholder="Search employees..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Selected Members */}
            {newChatMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {newChatMembers.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return emp ? (
                    <span key={id} className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded-lg flex items-center gap-1">
                      {emp.firstName} {emp.lastName}
                      <button onClick={() => setNewChatMembers(prev => prev.filter(m => m !== id))} className="text-teal-500 hover:text-red-500">
                        <FiX className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Employee List */}
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
              {loadingEmployees ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
              ) : employees.filter(e => e.id !== user?.id).map(emp => (
                <button
                  key={emp.id}
                  onClick={() => {
                    if (newChatType === 'direct') {
                      setNewChatMembers([emp.id]);
                    } else {
                      setNewChatMembers(prev => prev.includes(emp.id) ? prev.filter(m => m !== emp.id) : [...prev, emp.id]);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors ${
                    newChatMembers.includes(emp.id) ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[10px] text-slate-400">{emp.department?.name || 'No Dept'}</p>
                  </div>
                  {newChatMembers.includes(emp.id) && <FiCheck className="w-3.5 h-3.5 text-teal-500 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={newChatMembers.length === 0}
              className="mt-4 w-full 3boxes-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlus className="w-4 h-4" />
              Create {newChatType === 'direct' ? 'Direct' : 'Group'} Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
