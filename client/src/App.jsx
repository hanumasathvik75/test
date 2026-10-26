import React, { useState } from 'react';
import WhatsAppClient from './components/WhatsAppClient';

export default function App() {
  const [activePhone, setActivePhone] = useState('+919876543210');

  return (
    <div className="h-screen w-screen overflow-hidden">
      <WhatsAppClient activePhone={activePhone} setActivePhone={setActivePhone} />
    </div>
  );
}
