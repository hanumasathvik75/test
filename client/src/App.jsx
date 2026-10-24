import React, { useState } from 'react';
import WhatsAppClient from './components/WhatsAppClient';
import OpsDashboard from './components/OpsDashboard';
import ChecklistRunner from './components/ChecklistRunner';
import { MessageSquare, LayoutDashboard, CheckSquare, Columns, Sparkles } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('split'); // 'whatsapp' | 'ops' | 'split' | 'checklist'
  const [activePhone, setActivePhone] = useState('+919876543210');

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b141a] text-[#e9edef] overflow-hidden">
      
      {/* Top Global Mode Navigation Bar */}
      <header className="h-12 bg-[#202c33] border-b border-[#2a3942] px-4 flex items-center justify-between z-30 select-none">
        
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#00a884] flex items-center justify-center text-black font-extrabold text-sm shadow">
            M
          </div>
          <span className="font-bold text-sm tracking-wide text-white">Milo WhatsApp Agent & Fleet OS</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 font-semibold">
            Maya Call Taxi Integration
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-[#111b21] p-1 rounded-lg border border-[#2a3942] text-xs">
          
          <button
            onClick={() => setActiveView('split')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeView === 'split' ? 'bg-[#00a884] text-black font-bold shadow' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Columns size={14} />
            <span className="hidden md:inline">Split View (Chat + Ops)</span>
            <span className="md:hidden">Split</span>
          </button>

          <button
            onClick={() => setActiveView('whatsapp')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeView === 'whatsapp' ? 'bg-[#00a884] text-black font-bold shadow' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            <span>Big Chat WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveView('ops')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeView === 'ops' ? 'bg-[#00a884] text-black font-bold shadow' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>Operations Hub</span>
          </button>

          <button
            onClick={() => setActiveView('checklist')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
              activeView === 'checklist' ? 'bg-[#00a884] text-black font-bold shadow' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <CheckSquare size={14} />
            <span className="hidden md:inline">14-Point Checklist</span>
            <span className="md:hidden">Tests</span>
          </button>

        </div>

        {/* Info label */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#8696a0]">
          <span>Drive: <code className="text-[#00a884] font-mono">D:\milo-whatsapp-system</code></span>
        </div>

      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* VIEW 1: SPLIT SCREEN (WHATSAPP + OPS) */}
        {activeView === 'split' && (
          <div className="flex h-full w-full">
            <div className="w-1/2 h-full border-r border-[#2a3942]">
              <WhatsAppClient activePhone={activePhone} setActivePhone={setActivePhone} />
            </div>
            <div className="w-1/2 h-full">
              <OpsDashboard onSelectPhoneForChat={(phone) => { setActivePhone(phone); }} />
            </div>
          </div>
        )}

        {/* VIEW 2: FULL-SCREEN WHATSAPP CLIENT */}
        {activeView === 'whatsapp' && (
          <div className="h-full w-full">
            <WhatsAppClient activePhone={activePhone} setActivePhone={setActivePhone} />
          </div>
        )}

        {/* VIEW 3: FULL-SCREEN OPS DASHBOARD */}
        {activeView === 'ops' && (
          <div className="h-full w-full">
            <OpsDashboard onSelectPhoneForChat={(phone) => { setActivePhone(phone); setActiveView('whatsapp'); }} />
          </div>
        )}

        {/* VIEW 4: 14-POINT PDF TEST CHECKLIST */}
        {activeView === 'checklist' && (
          <div className="h-full w-full">
            <ChecklistRunner />
          </div>
        )}

      </main>

    </div>
  );
}
