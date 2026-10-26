import React, { useState } from 'react';
import WhatsAppClient from './components/WhatsAppClient';

function generateFreshSessionPhone() {
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  return `+9198${randomSuffix}`;
}

export default function App() {
  // Fresh phone session created on every page reload
  const [activePhone, setActivePhone] = useState(generateFreshSessionPhone);

  const startNewChat = () => {
    setActivePhone(generateFreshSessionPhone());
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      <WhatsAppClient
        key={activePhone}
        activePhone={activePhone}
        setActivePhone={setActivePhone}
        onNewChat={startNewChat}
      />
    </div>
  );
}
