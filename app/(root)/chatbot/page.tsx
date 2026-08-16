'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import stringSimilarity from 'string-similarity';

type Message = { author: 'user' | 'bot'; text: string };

const faqData: { question: string; answer: string }[] = [
  {
    question: 'What is BankEase?',
    answer:
      'BankEase is a modern banking app that lets users register, link banks, transfer funds, and view balances securely using Plaid, Dwolla, and Appwrite.',
  },
  {
    question: 'How can I link a bank?',
    answer:
      "Click 'Connect Bank' in the sidebar. We use Plaid to securely connect your bank without storing any credentials.",
  },
  {
    question: 'How do I send money?',
    answer:
      "Head to 'Transfer Funds', enter the recipient's shareable ID and amount. Transfers are processed via Dwolla through the ACH network.",
  },
  {
    question: 'What is Dwolla?',
    answer:
      'Dwolla is a secure U.S. payment provider that handles bank-to-bank ACH transfers used inside BankEase.',
  },
  {
    question: 'How do I create an account?',
    answer:
      "Click 'Sign Up', fill in your personal and contact details, and sign up. Your account is handled via Appwrite's secure auth system.",
  },
];

const normalize = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const FaqChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getBestMatchFromFAQ = (userInput: string) => {
    const userNormalized = normalize(userInput);
    const questions = faqData.map((item) => normalize(item.question));
    const match = stringSimilarity.findBestMatch(userNormalized, questions);
    const bestScore = match.bestMatch.rating;
    const bestIndex = match.bestMatchIndex;

    // Only return match if confidence is high enough
    return bestScore > 0.6 ? faqData[bestIndex] : null;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { author: 'user', text: userMessage }]);
    setInput('');

    const matchedFAQ = getBestMatchFromFAQ(userMessage);

    if (matchedFAQ) {
      setMessages((prev) => [...prev, { author: 'bot', text: matchedFAQ.answer }]);
      return;
    }

    try {
      const res = await axios.post('/api/chat', { message: userMessage });
      const reply = res.data.reply || '🤖 No reply received.';
      setMessages((prev) => [...prev, { author: 'bot', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          author: 'bot',
          text: 'I don’t know, sorry. If you need assistance, you can select from the given options above.',
        },
      ]);
    }
  };

  const handleClick = (question: string, answer: string) => {
    setMessages((prev) => [
      ...prev,
      { author: 'user', text: question },
      { author: 'bot', text: answer },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* FAQ Buttons - Always visible */}
      <div className="flex flex-wrap gap-2 mt-4 mb-4 px-2">
        {faqData.map((item, index) => (
          <button
            key={index}
            className="rounded-xl bg-[#2a9e93] px-4 py-2 text-white text-sm hover:bg-[#24887e] transition"
            onClick={() => handleClick(item.question, item.answer)}
          >
            {item.question}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start px-2 ${
              msg.author === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.author === 'bot' && (
              <img
                src="/icons/chatgpt.png"
                alt="Bot"
                className="w-8 h-8 rounded-full mr-2"
              />
            )}
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                msg.author === 'user'
                  ? 'bg-[#2a9e93] text-white'
                  : 'bg-[#f1f1f1] text-black'
              }`}
            >
              {msg.text}
            </div>
            {msg.author === 'user' && (
              <img
                src="/icons/user.png"
                alt="User"
                className="w-8 h-8 rounded-full ml-2"
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="flex items-center border-t p-2">
        <input
          className="flex-1 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a9e93]"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about BankEase..."
        />
        <button
          onClick={sendMessage}
          className="ml-2 rounded-full bg-[#2a9e93] px-4 py-2 text-white text-sm hover:bg-[#24887e] transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default FaqChat;
