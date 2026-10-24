import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Mic, MoreVertical, Phone, Video, Search, 
  Check, CheckCheck, MapPin, FileText, Image as ImageIcon,
  Clock, Shield, Car, User, AlertCircle, RefreshCw, Sparkles, Navigation
} from 'lucide-react';

const SAMPLE_CONTACTS = [
  { phone: '+919876543210', name: 'Ramesh (Driver Applicant)', avatar: '👨🏽‍✈️', role: 'Driver' },
  { phone: '+919845012345', name: 'Priya (Rider)', avatar: '👩🏽', role: 'Rider' },
  { phone: '+919123456789', name: 'Suresh (Existing Driver)', avatar: '👨🏽', role: 'Existing Driver' }
];

export default function WhatsAppClient({ activePhone, setActivePhone }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSimMenu, setShowSimMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  // Poll / fetch messages
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
        body: JSON.stringify({
          phone: activePhone,
          text: textToSend,
          ...payload
        })
      });
      fetchMessages();
    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to trigger simulation events
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

  // Parse numbered options from bot text to render interactive buttons
  const extractQuickButtons = (text) => {
    if (!text) return [];
    // Match patterns like "1 = English", "1 · Yes", "1: HSR Layout"
    const lines = text.split('\n');
    const buttons = [];
    const optionRegex = /^([0-9])\s*(=|·|-|:)\s*(.+)$/i;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(optionRegex);
      if (match) {
        buttons.push({ id: match[1], label: `${match[1]} · ${match[3].trim()}` });
      } else if (trimmed.includes('·')) {
        // Multi-option inline line like "1 = Yes · 2 = No · 3 = I have applied"
        const segments = trimmed.split('·');
        for (const seg of segments) {
          const segMatch = seg.trim().match(optionRegex);
          if (segMatch) {
            buttons.push({ id: segMatch[1], label: `${segMatch[1]} · ${segMatch[3].trim()}` });
          }
        }
      }
    }
    return buttons;
  };

  const activeContact = SAMPLE_CONTACTS.find(c => c.phone === activePhone) || {
    phone: activePhone,
    name: activePhone,
    avatar: '📱',
    role: 'User'
  };

  return (
    <div className="flex h-full w-full bg-[#111b21] text-[#e9edef] overflow-hidden select-none">
      
      {/* LEFT SIDEBAR: WhatsApp Contacts */}
      <div className="w-80 md:w-96 flex flex-col border-r border-[#222e35] bg-[#111b21]">
        
        {/* Sidebar Header */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-xl">
              🚗
            </div>
            <div>
              <div className="font-semibold text-sm text-[#e9edef]">Milo WhatsApp Hub</div>
              <div className="text-xs text-[#8696a0]">WhatsApp Simulator</div>
            </div>
          </div>
          <button 
            onClick={() => triggerSimulation('reset')}
            title="Reset All Test Data"
            className="p-2 text-[#aebac1] hover:text-white rounded-full hover:bg-[#374248] transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="p-2 bg-[#111b21] border-b border-[#222e35]">
          <div className="bg-[#202c33] rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <Search size={16} className="text-[#8696a0]" />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[#e9edef] w-full placeholder-[#8696a0]"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {SAMPLE_CONTACTS.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)).map(contact => {
            const isSelected = contact.phone === activePhone;
            return (
              <div
                key={contact.phone}
                onClick={() => setActivePhone(contact.phone)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#202c33]/50 ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[#202c33] flex items-center justify-center text-2xl border border-[#222e35]">
                  {contact.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-medium text-sm text-[#e9edef] truncate">{contact.name}</span>
                    <span className="text-[11px] text-[#8696a0]">now</span>
                  </div>
                  <div className="text-xs text-[#8696a0] truncate flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#222e35] text-[#00a884] font-medium">
                      {contact.role}
                    </span>
                    <span>{contact.phone}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Lead State Card in Sidebar */}
        {lead && (
          <div className="p-3 bg-[#182229] border-t border-[#222e35] text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#8696a0] font-medium">Lead State Info</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00a884]/20 text-[#00a884] font-semibold uppercase">
                {lead.stage || 'new'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#aebac1]">
              <div>Step: <span className="text-white font-mono">{lead.extra?.flow?.step || 'L1'}</span></div>
              <div>Lang: <span className="text-white uppercase">{lead.language || 'none'}</span></div>
              <div>Branch: <span className="text-white">{lead.extra?.flow?.branch || 'none'}</span></div>
              <div>Opted Out: <span className={lead.optedOut ? 'text-red-400 font-bold' : 'text-green-400'}>{lead.optedOut ? 'YES' : 'NO'}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Active WhatsApp Chat Window */}
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
        
        {/* Chat Window Header */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-xl text-white font-bold">
              M
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-sm text-[#e9edef]">
                <span>Milo Drive</span>
                <span className="text-[10px] bg-[#00a884] text-black px-1.5 py-0.2 rounded-full font-bold">VERIFIED</span>
              </div>
              <div className="text-xs text-[#8696a0] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00a884]"></span>
                <span>{lead?.handoffActive ? 'Milo Ops Agent Connected' : 'Official WhatsApp Bot (Online)'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[#aebac1]">
            <button 
              onClick={() => setShowSimMenu(!showSimMenu)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showSimMenu ? 'bg-[#00a884] text-black font-semibold' : 'bg-[#222e35] text-[#e9edef] hover:bg-[#374248]'
              }`}
            >
              <Sparkles size={14} />
              <span>Edge Cases & Simulations</span>
            </button>
            <Phone size={18} className="cursor-pointer hover:text-white" />
            <Video size={18} className="cursor-pointer hover:text-white" />
            <MoreVertical size={18} className="cursor-pointer hover:text-white" />
          </div>
        </div>

        {/* Simulation Controls Dropdown */}
        {showSimMenu && (
          <div className="bg-[#1f2c34] border-b border-[#222e35] p-3 text-xs flex flex-wrap items-center gap-2 z-20 shadow-xl">
            <span className="font-semibold text-[#8696a0] mr-1">Simulate Scenario:</span>
            
            <button 
              onClick={() => triggerSimulation('nudge-2h')}
              className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#374248] text-white rounded transition-colors"
            >
              ⏱️ 2h Inactivity Nudge
            </button>

            <button 
              onClick={() => triggerSimulation('template-23h')}
              className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#374248] text-white rounded transition-colors"
            >
              📋 23h Utility Template
            </button>

            <button 
              onClick={() => triggerSimulation('return-days-later')}
              className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#374248] text-white rounded transition-colors"
            >
              👋 Return Days Later
            </button>

            <button 
              onClick={() => triggerSimulation('r1-reminder')}
              className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#374248] text-white rounded transition-colors"
            >
              🌙 R1 Evening Reminder
            </button>

            <button 
              onClick={() => triggerSimulation('r2-checkin')}
              className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#374248] text-white rounded transition-colors"
            >
              ☀️ R2 8:00 AM Check-in
            </button>

            <button 
              onClick={() => triggerSimulation('r2-timeout')}
              className="px-2.5 py-1 bg-[#b91c1c] hover:bg-red-700 text-white rounded transition-colors"
            >
              ⚠️ R2 9:30 AM Timeout Alert
            </button>
          </div>
        )}

        {/* Message Feed Container */}
        <div className="flex-1 overflow-y-auto p-4 md:px-12 wa-chat-bg space-y-3">
          
          {/* WhatsApp Encryption notice */}
          <div className="flex justify-center my-2">
            <div className="bg-[#182229] border border-[#222e35] text-[#ffd279] text-[11px] px-3 py-1.5 rounded-lg max-w-md text-center flex items-center gap-1.5 shadow-sm">
              <Shield size={14} className="flex-shrink-0" />
              <span>Messages and calls are end-to-end encrypted. Document Aadhaar numbers are securely masked.</span>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-[#8696a0]">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm font-medium">No messages yet with {activePhone}</p>
              <p className="text-xs mt-1">Send "Hi" or click any shortcut below to start the Milo agent flow.</p>
              <button 
                onClick={() => handleSend('Hi')}
                className="mt-3 px-4 py-1.5 bg-[#00a884] hover:bg-[#02906f] text-black font-semibold text-xs rounded-full shadow"
              >
                Send "Hi"
              </button>
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const isOperator = msg.sender === 'operator';
            const buttons = !isUser ? extractQuickButtons(msg.text) : [];

            return (
              <div key={msg.id || index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                
                {/* Bubble Container */}
                <div 
                  className={`max-w-[85%] md:max-w-[70%] rounded-lg p-2.5 text-sm shadow-sm relative ${
                    isUser ? 'wa-bubble-out' : isOperator ? 'bg-[#3b2d54] text-white' : 'wa-bubble-in'
                  }`}
                >
                  {/* Operator Header Badge if applicable */}
                  {isOperator && (
                    <div className="text-[11px] text-[#c084fc] font-semibold mb-1 flex items-center gap-1">
                      <User size={12} />
                      <span>{msg.operatorName || 'Milo Ops Agent'}</span>
                    </div>
                  )}

                  {/* MAYA CALL TAXI CONFIRMATION CARD */}
                  {msg.isMayaTaxiCard && msg.bookingDetails ? (
                    <div className="rounded-lg bg-[#111b21] p-3 text-white border border-[#00a884]/40 my-1">
                      <div className="flex items-center justify-between border-b border-[#222e35] pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-black font-bold">
                            🚖
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[#00a884]">MILO RIDE CONFIRMED</div>
                            <div className="text-[10px] text-[#8696a0]">Booking ID: #{msg.bookingDetails.id}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-bold uppercase">
                          {msg.bookingDetails.status}
                        </span>
                      </div>

                      {/* Driver & Car Specs */}
                      <div className="bg-[#202c33] rounded p-2.5 mb-2 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#8696a0]">Driver:</span>
                          <span className="font-semibold text-white">
                            {msg.bookingDetails.assignedDriver?.name} ({msg.bookingDetails.assignedDriver?.rating})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#8696a0]">Vehicle:</span>
                          <span className="text-white font-medium">{msg.bookingDetails.assignedDriver?.vehicle}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#8696a0]">Plate Number:</span>
                          <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[#ffd279] font-bold">
                            {msg.bookingDetails.assignedDriver?.plateNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#2a3942] pt-1">
                          <span className="text-[#8696a0]">Start Ride OTP:</span>
                          <span className="text-base font-extrabold text-[#00a884] tracking-wider">
                            {msg.bookingDetails.otp}
                          </span>
                        </div>
                      </div>

                      {/* Trip Points */}
                      <div className="space-y-1 text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-green-400">●</span>
                          <span className="text-[#8696a0]">From:</span>
                          <span className="text-white truncate">{msg.bookingDetails.pickup}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-red-400">●</span>
                          <span className="text-[#8696a0]">To:</span>
                          <span className="text-white truncate">{msg.bookingDetails.drop}</span>
                        </div>
                      </div>

                      {/* Live Status Progression Stepper */}
                      <div className="mt-2 pt-2 border-t border-[#222e35]">
                        <div className="text-[10px] text-[#8696a0] mb-1 font-semibold uppercase">Live Ride Tracker</div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#00a884] font-bold">● Assigned</span>
                          <span className="text-[#00a884] font-bold">→ En Route</span>
                          <span className="text-[#8696a0]">→ Arrived</span>
                          <span className="text-[#8696a0]">→ Completed</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Standard Message Content */
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  )}

                  {/* Attachment Previews */}
                  {msg.mediaUrl && (
                    <div className="mt-2 rounded bg-black/30 p-2 flex items-center gap-2 border border-white/10">
                      <ImageIcon size={20} className="text-[#00a884]" />
                      <span className="text-xs text-[#aebac1] truncate">Attached Document / Photo</span>
                    </div>
                  )}

                  {/* Location Previews */}
                  {msg.location && (
                    <div className="mt-2 rounded bg-black/30 p-2 flex items-center gap-2 border border-white/10">
                      <MapPin size={20} className="text-red-400" />
                      <span className="text-xs text-[#aebac1]">Pinned Location: {msg.location.latitude}, {msg.location.longitude}</span>
                    </div>
                  )}

                  {/* Timestamp & Status checkmarks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
                    <span>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                    </span>
                    {isUser && (
                      <CheckCheck size={14} className="text-[#53bdeb]" />
                    )}
                  </div>
                </div>

                {/* WhatsApp Quick Reply Buttons (where channel allows) */}
                {buttons.length > 0 && !isUser && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%] md:max-w-[70%]">
                    {buttons.map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => handleSend(btn.id)}
                        className="px-3 py-1.5 rounded-md bg-[#202c33] hover:bg-[#00a884] hover:text-black text-[#00a884] border border-[#00a884]/40 text-xs font-medium transition-all shadow-sm"
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

        {/* QUICK SHORTCUTS TOOLBAR: Indic Numerals, Multi-select, Facts QA */}
        <div className="bg-[#182229] border-t border-[#222e35] px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs whitespace-nowrap">
          <span className="text-[#8696a0] font-medium mr-1 flex items-center gap-1">
            <Sparkles size={12} /> Test Chips:
          </span>

          <button 
            onClick={() => handleSend('२')}
            title="Hindi Devanagari 2"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-[#00a884] border border-[#222e35]"
          >
            २ (Hindi 2)
          </button>

          <button 
            onClick={() => handleSend('೨')}
            title="Kannada 2"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-[#00a884] border border-[#222e35]"
          >
            ೨ (Kannada 2)
          </button>

          <button 
            onClick={() => handleSend('1 3')}
            title="Multi-select apps"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-white border border-[#222e35]"
          >
            "1 3" (Multi)
          </button>

          <button 
            onClick={() => handleSend('2 but what is the deposit?')}
            title="Compound choice and question"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-white border border-[#222e35]"
          >
            "2 but what is the deposit?"
          </button>

          <button 
            onClick={() => handleSend('what is the deposit?')}
            title="Facts Sheet Rule 4 test"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-white border border-[#222e35]"
          >
            "what is the deposit?"
          </button>

          <button 
            onClick={() => handleSend('8')}
            title="Skip Document"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-yellow-400 border border-[#222e35]"
          >
            8 (Skip Doc)
          </button>

          <button 
            onClick={() => handleSend('0')}
            title="Main Menu"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-cyan-400 border border-[#222e35]"
          >
            0 (Main Menu)
          </button>

          <button 
            onClick={() => handleSend('9')}
            title="Talk to Team"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-purple-400 border border-[#222e35]"
          >
            9 (Handoff)
          </button>

          <button 
            onClick={() => handleSend('cancel')}
            title="Test cancel vs STOP"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-orange-400 border border-[#222e35]"
          >
            "cancel"
          </button>

          <button 
            onClick={() => handleSend('STOP')}
            title="Opt out"
            className="px-2 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-red-400 border border-[#222e35]"
          >
            "STOP"
          </button>
        </div>

        {/* ATTACHMENT POPUP MODAL */}
        {showAttachMenu && (
          <div className="absolute bottom-20 left-6 bg-[#202c33] rounded-xl shadow-2xl border border-[#222e35] p-3 w-64 space-y-2 z-30">
            <div className="text-xs font-semibold text-[#8696a0] mb-1">Simulate Attachment</div>
            
            <button
              onClick={() => handleSend('Document Upload', { type: 'photo', mediaUrl: 'https://example.com/licence_front.jpg' })}
              className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
            >
              <FileText size={16} className="text-[#00a884]" />
              <span>Send Document / Photo (D9)</span>
            </button>

            <button
              onClick={() => handleSend('12.9716, 77.5946', { type: 'location', location: { latitude: 12.9716, longitude: 77.5946 } })}
              className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
            >
              <MapPin size={16} className="text-red-400" />
              <span>Share Location Pin (B4/B5)</span>
            </button>

            <button
              onClick={() => handleSend(null, { type: 'voice' })}
              className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-[#2a3942] text-left text-xs text-white"
            >
              <Mic size={16} className="text-yellow-400" />
              <span>Send Voice Note (Test Reject)</span>
            </button>
          </div>
        )}

        {/* BOTTOM MESSAGE INPUT BAR */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center gap-3 border-t border-[#222e35]">
          <button 
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`p-2 rounded-full transition-colors ${showAttachMenu ? 'bg-[#00a884] text-black' : 'text-[#8696a0] hover:text-white'}`}
          >
            <Paperclip size={20} />
          </button>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex-1 flex items-center"
          >
            <input 
              type="text"
              placeholder={lead?.handoffActive ? "Reply to Milo team (type 0 to return to bot)..." : "Type a message or number option..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              className="w-full bg-[#2a3942] rounded-lg px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] border-none outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          </form>

          <button 
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#02906f] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-black font-semibold transition-colors flex items-center justify-center shadow"
          >
            <Send size={18} />
          </button>
        </div>

      </div>

    </div>
  );
}
