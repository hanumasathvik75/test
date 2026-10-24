import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Users, Car, Calendar, BookOpen, CheckCircle, 
  XCircle, Clock, Send, ShieldCheck, RefreshCw, Sparkles, Navigation, Phone
} from 'lucide-react';

export default function OpsDashboard({ onSelectPhoneForChat }) {
  const [activeTab, setActiveTab] = useState('escalations');
  const [escalations, setEscalations] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState(null);
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(false);

  // Operator reply form state
  const [replyText, setReplyText] = useState({});
  const [editingFacts, setEditingFacts] = useState({});

  const fetchData = async () => {
    try {
      const [escRes, driversRes, bookRes, cfgRes] = await Promise.all([
        fetch('/api/escalations'),
        fetch('/api/drivers'),
        fetch('/api/bookings'),
        fetch('/api/config')
      ]);

      setEscalations(await escRes.json());
      setDrivers(await driversRes.json());
      setBookings(await bookRes.json());
      const cfgData = await cfgRes.json();
      setConfig(cfgData.config);
      setSlots(cfgData.slots);
      setEditingFacts(cfgData.config?.factsSheet || {});
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Dispatch Ride (Maya Call Taxi instant confirmation!)
  const handleDispatchRide = async (bookingId) => {
    try {
      await fetch(`/api/bookings/${bookingId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: 'Rajesh Kumar',
          driverPhone: '+91 98450 12345',
          driverRating: '4.9 ★',
          vehicle: 'Tata Tigor EV (Emerald Green)',
          plateNumber: 'KA 01 MJ 8821',
          fare: '₹480',
          distance: '14.5 km',
          otp: String(Math.floor(1000 + Math.random() * 9000))
        })
      });
      fetchData();
    } catch (e) {
      console.error('Error dispatching ride:', e);
    }
  };

  // Update Ride Tracking Status
  const handleUpdateRideStatus = async (bookingId, status) => {
    try {
      await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  // Mark Test Drive Result
  const handleMarkTestDrive = async (phone, result) => {
    try {
      await fetch(`/api/drivers/${encodeURIComponent(phone)}/mark-test-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result })
      });
      fetchData();
    } catch (e) {
      console.error('Error marking test drive:', e);
    }
  };

  // Reply to Escalation
  const handleOperatorReply = async (escId) => {
    const text = replyText[escId];
    if (!text || !text.trim()) return;

    try {
      await fetch(`/api/escalations/${escId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText: text, operatorName: 'Milo Ops Lead' })
      });
      setReplyText(prev => ({ ...prev, [escId]: '' }));
      fetchData();
    } catch (e) {
      console.error('Error replying:', e);
    }
  };

  // Hand back to bot
  const handleHandback = async (escId) => {
    try {
      await fetch(`/api/escalations/${escId}/handback`, {
        method: 'POST'
      });
      fetchData();
    } catch (e) {
      console.error('Error handing back:', e);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f172a] text-[#f8fafc] overflow-hidden">
      
      {/* Top Navbar */}
      <div className="h-16 px-6 bg-[#1e293b] border-b border-[#334155] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-black text-xl shadow-md">
            M
          </div>
          <div>
            <div className="font-bold text-base tracking-wide flex items-center gap-2">
              <span>Milo Operations & Dispatch Hub</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="text-xs text-[#94a3b8]">Fleet Management, Escalations & AI Guardrails</div>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex items-center bg-[#0f172a] p-1 rounded-lg border border-[#334155] text-xs">
          <button
            onClick={() => setActiveTab('escalations')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'escalations' ? 'bg-emerald-500 text-black font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Escalations (H1)</span>
            {escalations.filter(e => e.status === 'open').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px]">
                {escalations.filter(e => e.status === 'open').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'drivers' ? 'bg-emerald-500 text-black font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Driver Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('rides')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'rides' ? 'bg-emerald-500 text-black font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Car size={14} />
            <span>Ride Dispatch (Maya Taxi)</span>
            {bookings.filter(b => b.status === 'requested').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {bookings.filter(b => b.status === 'requested').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('facts')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'facts' ? 'bg-emerald-500 text-black font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <BookOpen size={14} />
            <span>Facts Sheet & Criteria</span>
          </button>
        </div>

        <button 
          onClick={fetchData}
          className="p-2 text-[#94a3b8] hover:text-white rounded-lg hover:bg-[#334155] transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* TAB 1: ESCALATIONS & TEAM HANDOFF (H1) */}
        {activeTab === 'escalations' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">Live Escalations & Support Tickets</h2>
                <p className="text-xs text-[#94a3b8]">Chats handed off to Milo's team (9 AM – 8 PM IST)</p>
              </div>
            </div>

            {escalations.length === 0 ? (
              <div className="bg-[#1e293b] rounded-xl p-12 text-center text-[#94a3b8] border border-[#334155]">
                <CheckCircle size={36} className="mx-auto mb-2 text-emerald-400" />
                <p className="font-semibold text-white">No Active Escalations</p>
                <p className="text-xs mt-1">All chats are currently handled by the automated Milo WhatsApp bot.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {escalations.map(esc => {
                  const isOpen = esc.status === 'open';
                  return (
                    <div 
                      key={esc.id} 
                      className={`rounded-xl border p-4 transition-all ${
                        isOpen ? 'bg-[#1e293b] border-amber-500/40 shadow-lg' : 'bg-[#182234] border-[#334155] opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                            isOpen ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {esc.status}
                          </span>
                          <div>
                            <span className="font-bold text-white text-sm">{esc.topic || 'General Escalation'}</span>
                            <span className="text-xs text-[#94a3b8] ml-2">Ticket #{esc.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectPhoneForChat(esc.phone)}
                            className="px-3 py-1 bg-[#334155] hover:bg-[#475569] text-xs font-medium rounded text-white flex items-center gap-1"
                          >
                            <span>Open in WhatsApp</span>
                          </button>
                          {isOpen && (
                            <button
                              onClick={() => handleHandback(esc.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded text-white shadow"
                            >
                              Hand Back to Bot
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Escalation Context Details */}
                      <div className="bg-[#0f172a] rounded-lg p-3 text-xs mb-3 space-y-1.5 border border-[#334155]">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[#94a3b8]">
                          <div>User Phone: <span className="text-white font-mono">{esc.phone}</span></div>
                          <div>Escalated Step: <span className="text-emerald-400 font-mono">{esc.step}</span></div>
                          <div>Time: <span className="text-white">{new Date(esc.createdAt).toLocaleTimeString()}</span></div>
                          <div>Reason: <span className="text-amber-300">{esc.reason}</span></div>
                        </div>
                        {esc.question && (
                          <div className="border-t border-[#334155] pt-1.5 text-white">
                            <span className="text-[#94a3b8]">User Query:</span> "{esc.question}"
                          </div>
                        )}
                      </div>

                      {/* Operator Direct Reply Box */}
                      {isOpen && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type response to send directly to customer's WhatsApp..."
                            value={replyText[esc.id] || ''}
                            onChange={(e) => setReplyText({ ...replyText, [esc.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleOperatorReply(esc.id)}
                            className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-xs text-white placeholder-[#64748b] outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handleOperatorReply(esc.id)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <Send size={14} />
                            <span>Reply to WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DRIVER ONBOARDING & ENCRYPTED VERIFICATION */}
        {activeTab === 'drivers' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">Driver Applications & Verification Pipeline</h2>
                <p className="text-xs text-[#94a3b8]">AES-256 encrypted documents & Masked Aadhaar security</p>
              </div>
            </div>

            <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f172a] text-[#94a3b8] uppercase font-semibold border-b border-[#334155]">
                  <tr>
                    <th className="p-3">Applicant Phone / Name</th>
                    <th className="p-3">Hiring Criteria Check</th>
                    <th className="p-3">Experience & Apps</th>
                    <th className="p-3">Hub & Documents</th>
                    <th className="p-3">Test-Drive Status</th>
                    <th className="p-3 text-right">Actions (PDF Page 7)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {drivers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-[#94a3b8]">
                        No driver applicants registered yet. Start a chat with +919876543210!
                      </td>
                    </tr>
                  ) : (
                    drivers.map((drv, i) => {
                      const answers = drv.extra?.flow?.answers || {};
                      const isQualified = drv.stage === 'qualified' || drv.stage?.includes('test_drive') || drv.stage === 'docs_in';
                      const isNotEligible = drv.stage === 'not_eligible';

                      return (
                        <tr key={i} className="hover:bg-[#283548] transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-white">{drv.name || 'In Progress'}</div>
                            <div className="text-[11px] text-[#94a3b8] font-mono">{drv.phone}</div>
                          </td>

                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isQualified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              isNotEligible ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {drv.stage}
                            </span>
                          </td>

                          <td className="p-3 space-y-0.5">
                            <div>Exp: <span className="text-white">{answers.experience_band || 'N/A'}</span></div>
                            <div className="text-[11px] text-[#94a3b8]">
                              Apps: <span className="text-white">{answers.platforms?.join(', ') || 'None'}</span>
                            </div>
                          </td>

                          <td className="p-3 space-y-1">
                            <div className="font-medium text-white">{answers.hub?.toUpperCase() || 'HSR'}</div>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <ShieldCheck size={12} className="text-emerald-400" />
                              <span className="text-[#94a3b8]">
                                Aadhaar: {drv.docs?.aadhaar?.maskedDisplay || '•••• •••• 9876'}
                              </span>
                            </div>
                          </td>

                          <td className="p-3 space-y-0.5">
                            <div className="font-medium text-white">
                              {drv.testDrive?.slotText || 'Not Booked Yet'}
                            </div>
                            <div className="text-[10px] text-emerald-400">
                              {drv.testDrive?.status || '—'}
                            </div>
                          </td>

                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => handleMarkTestDrive(drv.phone, 'passed')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px]"
                            >
                              Passed
                            </button>
                            <button
                              onClick={() => handleMarkTestDrive(drv.phone, 'car_handed_over')}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[11px]"
                            >
                              Car Handover
                            </button>
                            <button
                              onClick={() => handleMarkTestDrive(drv.phone, 'no_show')}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[11px]"
                            >
                              No Show
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RIDE DISPATCH & MAYA CALL TAXI INTEGRATION */}
        {activeTab === 'rides' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">Ride Bookings & Maya Call Taxi Dispatch Hub</h2>
                <p className="text-xs text-[#94a3b8]">
                  Instant WhatsApp Confirmation Cards, Driver Assignments & Live Progression Updates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {bookings.length === 0 ? (
                <div className="bg-[#1e293b] rounded-xl p-12 text-center text-[#94a3b8] border border-[#334155]">
                  <Car size={36} className="mx-auto mb-2 text-emerald-400" />
                  <p className="font-semibold text-white">No Ride Requests Yet</p>
                  <p className="text-xs mt-1">Book a ride via WhatsApp with Priya (+919845012345) to see live dispatching!</p>
                </div>
              ) : (
                bookings.map(book => {
                  const isNow = book.when?.toLowerCase().includes('now');
                  const isDispatched = book.status === 'dispatched' || book.status === 'en_route' || book.status === 'arrived';
                  const isCompleted = book.status === 'completed';

                  return (
                    <div 
                      key={book.id} 
                      className={`rounded-xl border p-4 transition-all ${
                        isNow ? 'bg-[#1e293b] border-red-500/50 shadow-xl' : 'bg-[#1e293b] border-[#334155]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                            🚖
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">Booking #{book.id}</span>
                              {isNow && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-extrabold animate-pulse">
                                  URGENT NOW RIDE
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-[#94a3b8] font-bold uppercase">
                                {book.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#94a3b8]">
                              Rider: <span className="text-white font-medium">{book.riderName}</span> ({book.phone})
                            </div>
                          </div>
                        </div>

                        {/* Dispatch CTA */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectPhoneForChat(book.phone)}
                            className="px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-xs font-medium rounded text-white"
                          >
                            View WhatsApp
                          </button>
                          
                          {book.status === 'requested' && (
                            <button
                              onClick={() => handleDispatchRide(book.id)}
                              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg shadow-lg flex items-center gap-1.5 transition-all transform active:scale-95"
                            >
                              <Car size={14} />
                              <span>Dispatch Taxi (Send Maya Card)</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ride Specifics */}
                      <div className="bg-[#0f172a] rounded-lg p-3 text-xs mb-3 grid grid-cols-2 md:grid-cols-4 gap-3 border border-[#334155]">
                        <div>
                          <div className="text-[#94a3b8]">Ride Type:</div>
                          <div className="font-semibold text-white">{book.rideType}</div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8]">Timing:</div>
                          <div className="font-semibold text-emerald-400">{book.when} ({book.time || 'Immediate'})</div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8]">Pickup:</div>
                          <div className="font-medium text-white truncate">{book.pickup}</div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8]">Drop:</div>
                          <div className="font-medium text-white truncate">{book.drop}</div>
                        </div>
                      </div>

                      {/* Dispatched Driver Details & Status Progression */}
                      {book.assignedDriver && (
                        <div className="bg-[#182234] rounded-lg p-3 border border-emerald-500/30 mb-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">👨🏽‍✈️</span>
                              <div>
                                <span className="font-bold text-white">{book.assignedDriver.name}</span>
                                <span className="text-[#94a3b8] ml-2">({book.assignedDriver.rating})</span>
                                <div className="text-[11px] text-[#94a3b8]">
                                  {book.assignedDriver.vehicle} • <span className="text-amber-400 font-mono">{book.assignedDriver.plateNumber}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[11px] text-[#94a3b8]">Ride Start OTP:</div>
                              <div className="text-base font-extrabold text-emerald-400 tracking-wider font-mono">
                                {book.otp}
                              </div>
                            </div>
                          </div>

                          {/* Live Progression Controls */}
                          <div className="mt-3 pt-2 border-t border-[#334155] flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-[#94a3b8] font-semibold">Update Live Status:</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleUpdateRideStatus(book.id, 'en_route')}
                                className="px-2.5 py-1 bg-[#334155] hover:bg-emerald-600 text-xs rounded text-white"
                              >
                                🚕 En Route
                              </button>
                              <button
                                onClick={() => handleUpdateRideStatus(book.id, 'arrived')}
                                className="px-2.5 py-1 bg-[#334155] hover:bg-emerald-600 text-xs rounded text-white"
                              >
                                📍 Arrived
                              </button>
                              <button
                                onClick={() => handleUpdateRideStatus(book.id, 'in_progress')}
                                className="px-2.5 py-1 bg-[#334155] hover:bg-emerald-600 text-xs rounded text-white"
                              >
                                🟢 In Progress
                              </button>
                              <button
                                onClick={() => handleUpdateRideStatus(book.id, 'completed')}
                                className="px-2.5 py-1 bg-[#334155] hover:bg-emerald-600 text-xs rounded text-white"
                              >
                                🏁 Completed
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FACTS SHEET & HIRING CRITERIA CONFIG */}
        {activeTab === 'facts' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-lg font-bold text-white">Milo Facts Sheet & Hiring Rules (PDF Page 11)</h2>
              <p className="text-xs text-[#94a3b8]">
                Strictly governs AI answers (Rule 4 & 5). Bot only quotes numbers from this sheet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Facts Sheet Editor */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] space-y-3">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <BookOpen size={16} /> Facts Sheet Values
                </h3>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Weekly Rent (₹6,300):</label>
                  <input
                    type="text"
                    value={editingFacts.rent || ''}
                    onChange={(e) => setEditingFacts({ ...editingFacts, rent: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Refundable Deposit (₹10,000):</label>
                  <input
                    type="text"
                    value={editingFacts.deposit || ''}
                    onChange={(e) => setEditingFacts({ ...editingFacts, deposit: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Charging Terms:</label>
                  <input
                    type="text"
                    value={editingFacts.charging || ''}
                    onChange={(e) => setEditingFacts({ ...editingFacts, charging: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#94a3b8] block mb-1">Drive-to-Own Program Terms:</label>
                  <textarea
                    rows={2}
                    value={editingFacts.driveToOwn || ''}
                    onChange={(e) => setEditingFacts({ ...editingFacts, driveToOwn: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded p-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Hub Locations & Capacities */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] space-y-3">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <Calendar size={16} /> Hub Locations & Test-Drive Capacity
                </h3>

                {config?.hubs?.map(hub => (
                  <div key={hub.id} className="bg-[#0f172a] rounded-lg p-3 border border-[#334155] text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>{hub.name}</span>
                      <span className="text-[10px] text-emerald-400">3 slots/day</span>
                    </div>
                    <div className="text-[#94a3b8] text-[11px]">{hub.address}</div>
                    <div className="flex gap-1.5 mt-2">
                      {hub.slots.map(s => (
                        <span key={s.id} className="px-2 py-0.5 rounded bg-[#1e293b] text-[#cbd5e1] text-[10px]">
                          {s.time}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
