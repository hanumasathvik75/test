import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Paperclip, Mic, MoreVertical, Phone, Video,
  Check, CheckCheck, MapPin, FileText, Image as ImageIcon,
  Shield, User, RefreshCw, Sparkles
} from 'lucide-react';

export default function WhatsAppClient({ activePhone }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(activePhone)}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setLead(data.lead || null);
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 1500);
    return () => clearInterval(interval);
  }, [activePhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (customText = null, payload = {}) => {
    const textToSend = customText !== null ? customText : inputText;
    if (!textToSend.trim() && !payload.mediaUrl && !payload.location && !payload.type) return;
    setInputText('');
    setShowAttachMenu(false);
    setLoading(true);
    try {
      await fetch('/api/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activePhone, text: textToSend, ...payload })
      });
      fetchMessages();
    } catch (e) {
      console.error('Error sending:', e);
    } finally {
      setLoading(false);
    }
  };

  const triggerSimulation = async (endpoint) => {
    try {
      await fetch(`/api/simulate/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activePhone })
      });
      fetchMessages();
    } catch (e) {
      console.error('Simulation error:', e);
    }
  };

  // Extract numbered option buttons from bot messages
  const extractQuickButtons = (text) => {
    if (!text) return [];
    const lines = text.split('\n');
    const buttons = [];
    const optionRegex = /^([0-9])\s*(=|→|-|:)\s*(.+)$/i;
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(optionRegex);
      if (match) {
        buttons.push({ id: match[1], label: `${match[1]} → ${match[3].trim()}` });
      }
    }
    return buttons;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b141a] text-[#e9edef]">

      {/* ── TOP HEADER ── */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-black font-extrabold text-lg shadow">
            M
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-[#e9edef]">
              <span>Milo Drive</span>
              <span className="text-[10px] bg-[#00a884] text-black px-1.5 py-0.5 rounded-full font-bold">VERIFIED</span>
            </div>
            <div className="text-xs text-[#8696a0] flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884] inline-block"></span>
              <span>{lead?.handoffActive ? 'Milo Ops Agent Connected' : 'Book rides · Driver onboarding · Fleet support'}</span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3 text-[#aebac1]">
          <button
            onClick={() => triggerSimulation('reset')}
            title="Reset chat"
            className="p-2 rounded-full hover:bg-[#374248] hover:text-white transition-colors"
          >
            <RefreshCw size={18} />
          </button>
          <Phone size={18} className="cursor-pointer hover:text-white" />
          <Video size={18} className="cursor-pointer hover:text-white" />
          <MoreVertical size={18} className="cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* ── MESSAGE FEED ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 md:px-20 lg:px-40 space-y-3"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #1f2c34 1px, transparent 0)', backgroundSize: '32px 32px' }}
      >
        {/* Encryption notice */}
        <div className="flex justify-center my-2">
          <div className="bg-[#182229] border border-[#222e35] text-[#ffd279] text-[11px] px-4 py-1.5 rounded-lg max-w-sm text-center flex items-center gap-1.5">
            <Shield size={13} className="flex-shrink-0" />
            <span>Messages and calls are end-to-end encrypted. Aadhaar numbers are securely masked.</span>
          </div>
        </div>

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center text-[#8696a0]">
            <div className="text-5xl mb-3">🚗</div>
            <p className="text-sm font-semibold text-[#e9edef] mb-1">Welcome to Milo Drive</p>
            <p className="text-xs max-w-xs">
              Book a ride, onboard as a driver, or get fleet support — all on WhatsApp.
            </p>
            <button
              onClick={() => handleSend('Hi')}
              className="mt-4 px-6 py-2 bg-[#00a884] hover:bg-[#02906f] text-black font-bold text-sm rounded-full shadow transition-colors"
            >
              Start Chat
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const isOperator = msg.sender === 'operator';
          const buttons = !isUser ? extractQuickButtons(msg.text) : [];

          return (
            <div key={msg.id || index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[75%] md:max-w-[60%] rounded-lg p-3 text-sm shadow relative ${
                  isUser
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm'
                    : isOperator
                    ? 'bg-[#3b2d54] text-white rounded-tl-sm'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-sm'
                }`}
              >
                {/* Operator badge */}
                {isOperator && (
                  <div className="text-[11px] text-[#c084fc] font-semibold mb-1 flex items-center gap-1">
                    <User size={11} />
                    <span>{msg.operatorName || 'Milo Ops Agent'}</span>
                  </div>
                )}

                {/* Maya Call Taxi Ride Card */}
                {msg.isMayaTaxiCard && msg.bookingDetails ? (
                  <div className="rounded-lg bg-[#111b21] p-3 text-white border border-[#00a884]/40">
                    <div className="flex items-center justify-between border-b border-[#222e35] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-black font-bold text-sm">M</div>
                        <div>
                          <div className="font-bold text-sm text-[#00a884]">MILO RIDE CONFIRMED</div>
                          <div className="text-[10px] text-[#8696a0]">Booking #{msg.bookingDetails.id}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-bold uppercase">{msg.bookingDetails.status}</span>
                    </div>
                    <div className="bg-[#202c33] rounded p-2.5 mb-2 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#8696a0]">Driver:</span>
                        <span className="font-semibold">{msg.bookingDetails.assignedDriver?.name} ({msg.bookingDetails.assignedDriver?.rating})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8696a0]">Vehicle:</span>
                        <span>{msg.bookingDetails.assignedDriver?.vehicle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8696a0]">Plate:</span>
                        <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[#ffd279] font-bold">{msg.bookingDetails.assignedDriver?.plateNumber}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#2a3942] pt-1.5">
                        <span className="text-[#8696a0]">Start Ride OTP:</span>
                        <span className="text-lg font-extrabold text-[#00a884] tracking-widest">{msg.bookingDetails.otp}</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-green-400">●</span>
                        <span className="text-[#8696a0]">From:</span>
                        <span className="truncate">{msg.bookingDetails.pickup}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-400">●</span>
                        <span className="text-[#8696a0]">To:</span>
                        <span className="truncate">{msg.bookingDetails.drop}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] pt-2 border-t border-[#222e35]">
                      <span className="text-[#00a884] font-bold">● Assigned</span>
                      <span className="text-[#00a884] font-bold">● En Route</span>
                      <span className="text-[#8696a0]">● Arrived</span>
                      <span className="text-[#8696a0]">● Completed</span>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                )}

                {/* Media & location previews */}
                {msg.mediaUrl && (
                  <div className="mt-2 rounded bg-black/30 p-2 flex items-center gap-2 border border-white/10">
                    <ImageIcon size={18} className="text-[#00a884]" />
                    <span className="text-xs text-[#aebac1]">Attached Document / Photo</span>
                  </div>
                )}
                {msg.location && (
                  <div className="mt-2 rounded bg-black/30 p-2 flex items-center gap-2 border border-white/10">
                    <MapPin size={18} className="text-red-400" />
                    <span className="text-xs text-[#aebac1]">Location: {msg.location.latitude}, {msg.location.longitude}</span>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-[#8696a0]">
                  <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</span>
                  {isUser && <CheckCheck size={13} className="text-[#53bdeb]" />}
                </div>
              </div>

              {/* Quick Reply Buttons */}
              {buttons.length > 0 && !isUser && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[75%] md:max-w-[60%]">
                  {buttons.map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => handleSend(btn.id)}
                      className="px-3 py-1.5 rounded-full bg-[#202c33] hover:bg-[#00a884] hover:text-black text-[#00a884] border border-[#00a884]/50 text-xs font-semibold transition-all shadow-sm"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ── ATTACHMENT POPUP ── */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-4 bg-[#202c33] rounded-xl shadow-2xl border border-[#222e35] p-3 w-60 space-y-2 z-30">
          <div className="text-xs font-semibold text-[#8696a0] mb-1">Simulate Attachment</div>
          <button
            onClick={() => handleSend('Document Upload', { type: 'photo', mediaUrl: 'https://example.com/licence_front.jpg' })}
            className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
          >
            <FileText size={15} className="text-[#00a884]" />
            <span>Send Document / Photo (D9)</span>
          </button>
          <button
            onClick={() => handleSend('12.9716, 77.5946', { type: 'location', location: { latitude: 12.9716, longitude: 77.5946 } })}
            className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
          >
            <MapPin size={15} className="text-red-400" />
            <span>Share Location Pin (B4/B5)</span>
          </button>
          <button
            onClick={() => handleSend(null, { type: 'voice' })}
            className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
          >
            <Mic size={15} className="text-yellow-400" />
            <span>Send Voice Note</span>
          </button>
        </div>
      )}

      {/* ── BOTTOM INPUT BAR ── */}
      <div className="flex-shrink-0 px-4 py-3 bg-[#202c33] flex items-center gap-3 border-t border-[#222e35]">
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className={`p-2 rounded-full transition-colors ${showAttachMenu ? 'bg-[#00a884] text-black' : 'text-[#8696a0] hover:text-white'}`}
        >
          <Paperclip size={20} />
        </button>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex-1"
        >
          <input
            type="text"
            placeholder={
              lead?.handoffActive
                ? 'Chatting with Milo team — type 0 to return to bot...'
                : 'Type a message...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            autoFocus
            className="w-full bg-[#2a3942] rounded-lg px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884] transition"
          />
        </form>

        <button
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
          className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#02906f] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-black transition-colors flex items-center justify-center shadow"
        >
          <Send size={18} />
        </button>
      </div>

    </div>
  );
}
