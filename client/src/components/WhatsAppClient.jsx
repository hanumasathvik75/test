import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Paperclip, Mic, MoreVertical, Phone, Video,
  CheckCheck, MapPin, FileText, Image as ImageIcon,
  Shield, User, RefreshCw, Sparkles, Key, Bot, Plus, X
} from 'lucide-react';

export default function WhatsAppClient({ activePhone, setActivePhone, onNewChat }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Grok LLM integration state
  const [grokConfigured, setGrokConfigured] = useState(false);
  const [grokModel, setGrokModel] = useState('grok-2-latest');
  const [showGrokModal, setShowGrokModal] = useState(false);
  const [grokKeyInput, setGrokKeyInput] = useState('');
  const [savingGrokKey, setSavingGrokKey] = useState(false);
  const [grokStatusMsg, setGrokStatusMsg] = useState('');

  const messagesEndRef = useRef(null);

  // Check Grok status
  const checkGrokStatus = async () => {
    try {
      const res = await fetch('/api/grok/status');
      const data = await res.json();
      setGrokConfigured(Boolean(data.configured));
      if (data.model) setGrokModel(data.model);
    } catch (e) {
      // Ignore in offline mode
    }
  };

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
    checkGrokStatus();
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

  const handleSaveGrokKey = async () => {
    if (!grokKeyInput.trim()) return;
    setSavingGrokKey(true);
    setGrokStatusMsg('');
    try {
      const res = await fetch('/api/grok/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: grokKeyInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setGrokConfigured(true);
        setGrokStatusMsg('Connected to Grok LLM successfully!');
        setTimeout(() => {
          setShowGrokModal(false);
          setGrokStatusMsg('');
        }, 1200);
      } else {
        setGrokStatusMsg('Error: ' + (data.error || 'Failed to save key'));
      }
    } catch (e) {
      setGrokStatusMsg('Network error: ' + e.message);
    } finally {
      setSavingGrokKey(false);
    }
  };

  // Extract numbered option buttons from bot messages (splits multi-options on same line)
  const extractQuickButtons = (text) => {
    if (!text) return [];
    const buttons = [];
    const segments = text.split(/[\n\r·•|]+|[Â\u00c2][\u00b7\u2022]/g);
    const optionRegex = /(?:Reply\s+)?([0-9]+)\s*(=|→|-|:)\s*(.+)/i;

    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;
      const match = trimmed.match(optionRegex);
      if (match) {
        const id = match[1];
        const desc = match[3].trim();
        const label = `${id} = ${desc}`;
        if (!buttons.some(b => b.id === id && b.label === label)) {
          buttons.push({ id, label });
        }
      }
    }
    return buttons;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b141a] text-[#e9edef] relative select-none">

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
              {grokConfigured ? (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <Bot size={10} /> Grok AI Active
                </span>
              ) : null}
            </div>
            <div className="text-xs text-[#8696a0] flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884] inline-block"></span>
              <span>
                {lead?.handoffActive
                  ? 'Milo Ops Agent Connected'
                  : grokConfigured
                  ? 'Hybrid Flow: Rule-based + Grok AI reasoning'
                  : 'Book rides · Driver onboarding · Fleet support'}
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 md:gap-3 text-[#aebac1]">

          {/* Grok AI Settings Button */}
          <button
            onClick={() => setShowGrokModal(true)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
              grokConfigured
                ? 'bg-purple-900/30 text-purple-300 border-purple-500/40 hover:bg-purple-900/50'
                : 'bg-[#182229] text-[#8696a0] border-[#2a3942] hover:text-white hover:border-[#00a884]'
            }`}
            title="Configure xAI Grok LLM API Key"
          >
            <Key size={13} className={grokConfigured ? 'text-purple-400' : 'text-[#8696a0]'} />
            <span className="hidden sm:inline">{grokConfigured ? 'Grok Connected' : 'Connect Grok'}</span>
          </button>

          {/* New Chat Button */}
          <button
            onClick={() => onNewChat && onNewChat()}
            className="px-2.5 py-1 rounded-full bg-[#182229] hover:bg-[#00a884] hover:text-black text-[#00a884] border border-[#00a884]/40 text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
            title="Start fresh new chat session"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button
            onClick={() => onNewChat && onNewChat()}
            title="Reload fresh session"
            className="p-2 rounded-full hover:bg-[#374248] hover:text-white transition-colors"
          >
            <RefreshCw size={17} />
          </button>

          <Phone size={17} className="cursor-pointer hover:text-white hidden md:block" />
          <Video size={17} className="cursor-pointer hover:text-white hidden md:block" />
          <MoreVertical size={17} className="cursor-pointer hover:text-white" />
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
            <p className="text-base font-semibold text-[#e9edef] mb-1">Welcome to Milo Drive</p>
            <p className="text-xs max-w-xs mb-1">
              Book a ride, onboard as a driver, or ask questions anytime.
            </p>
            {grokConfigured && (
              <span className="text-[11px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-800/40 font-medium mb-3">
                ⚡ Powered by Grok LLM for instant doubt resolution
              </span>
            )}
            <button
              onClick={() => handleSend('Hi')}
              className="mt-2 px-6 py-2 bg-[#00a884] hover:bg-[#02906f] text-black font-bold text-sm rounded-full shadow transition-colors"
            >
              Start Chat
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const isOperator = msg.sender === 'operator';
          const isGrok = msg.isGrok;
          const buttons = !isUser ? extractQuickButtons(msg.text) : [];

          return (
            <div key={msg.id || index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-lg p-3 text-sm shadow relative ${
                  isUser
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm'
                    : isOperator
                    ? 'bg-[#3b2d54] text-white rounded-tl-sm'
                    : isGrok
                    ? 'bg-[#1e2330] border border-purple-500/30 text-[#e9edef] rounded-tl-sm'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-sm'
                }`}
              >
                {/* Operator or Grok badge */}
                {isOperator ? (
                  <div className="text-[11px] text-[#c084fc] font-semibold mb-1 flex items-center gap-1">
                    <User size={11} />
                    <span>{msg.operatorName || 'Milo Ops Agent'}</span>
                  </div>
                ) : isGrok ? (
                  <div className="text-[10px] text-purple-400 font-semibold mb-1 flex items-center gap-1">
                    <Bot size={11} />
                    <span>Milo AI (Grok LLM)</span>
                  </div>
                ) : null}

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
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%] md:max-w-[70%]">
                  {buttons.map((btn, bIdx) => (
                    <button
                      key={`${btn.id}-${bIdx}`}
                      onClick={() => handleSend(btn.id)}
                      className="px-3 py-1.5 rounded-full bg-[#202c33] hover:bg-[#00a884] hover:text-black text-[#00a884] border border-[#00a884]/50 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
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

      {/* ── GROK API KEY MODAL ── */}
      {showGrokModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a3942] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Grok LLM Intelligence</h3>
                  <p className="text-[11px] text-[#8696a0]">Model: {grokModel}</p>
                </div>
              </div>
              <button
                onClick={() => setShowGrokModal(false)}
                className="text-[#8696a0] hover:text-white p-1 rounded-full hover:bg-[#2a3942]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-[#aebac1] space-y-2">
              <p>
                <strong className="text-white">Hybrid Architecture:</strong> Standard numbered choices run with zero latency on the rule engine. When customers or drivers type doubts or questions, Grok understands and responds contextually using Milo's business facts.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#e9edef]">xAI Grok API Key</label>
              <input
                type="password"
                placeholder="xai-..."
                value={grokKeyInput}
                onChange={e => setGrokKeyInput(e.target.value)}
                className="w-full bg-[#111b21] rounded-lg px-3.5 py-2.5 text-xs text-[#e9edef] placeholder-[#8696a0] border border-[#2a3942] focus:border-[#00a884] outline-none"
              />
              <p className="text-[10px] text-[#8696a0]">
                Keys can also be set in <code className="text-[#00a884]">.env</code> or Vercel Environment Variables as <code className="text-[#00a884]">GROK_API_KEY</code>.
              </p>
            </div>

            {grokStatusMsg && (
              <div className={`text-xs p-2.5 rounded-lg ${grokStatusMsg.includes('Error') ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                {grokStatusMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGrokModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#8696a0] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGrokKey}
                disabled={savingGrokKey || !grokKeyInput.trim()}
                className="px-5 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-black font-bold text-xs shadow transition-colors flex items-center gap-1.5"
              >
                {savingGrokKey ? 'Connecting...' : 'Connect Grok'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                : grokConfigured
                ? 'Type a choice number or ask any question/doubt...'
                : 'Type a message or number option...'
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
