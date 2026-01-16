import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Attachment } from '../types';
import { User, Bot, AlertCircle, FileAudio, Play } from 'lucide-react';

import TicketConfirmation from './TicketConfirmation';

interface ChatMessageProps {
  message: Message;
}

const AttachmentDisplay: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  if (attachment.type === 'image') {
    return (
      <div className="mb-2 max-w-xs rounded-lg overflow-hidden border border-slate-200">
        <img src={attachment.url} alt="User upload" className="w-full h-auto" />
      </div>
    );
  }
  if (attachment.type === 'video') {
    return (
      <div className="mb-2 max-w-xs rounded-lg overflow-hidden border border-slate-200 bg-black">
        <video controls src={attachment.url} className="w-full h-auto max-h-[200px]" />
      </div>
    );
  }
  if (attachment.type === 'audio') {
    return (
      <div className="mb-2 w-full max-w-xs flex items-center gap-2 p-2 bg-slate-100 rounded-lg border border-slate-200">
        <FileAudio size={20} className="text-slate-500" />
        <audio controls src={attachment.url} className="w-full h-8" />
      </div>
    );
  }
  return null;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) return null;

  // Logic to extract JSON Ticket Confirmation
  let displayContent = message.content;
  let ticketData = null;

  if (!isUser && !message.isError) {
    try {
      // 1. Try to find JSON code block
      const jsonBlockRegex = /```json\s*(\{[\s\S]*?"ticket_created":\s*true[\s\S]*?\})\s*```/;
      const matchBlock = message.content.match(jsonBlockRegex);

      if (matchBlock && matchBlock[1]) {
        ticketData = JSON.parse(matchBlock[1]);
        displayContent = message.content.replace(matchBlock[0], '').trim();
      } else {
        // 2. Try to find raw JSON at the end if no code block
        // Look for the last object that contains "ticket_created": true
        const rawJsonRegex = /(\{?[\s\S]*"ticket_created":\s*true[\s\S]*\}?)\s*$/;
        const matchRaw = message.content.match(rawJsonRegex);
        if (matchRaw) {
          // Basic attempt to extract the JSON object strings
          // This is fragle for raw text but standard for LLM output at end of message
          const potentialJson = matchRaw[0].trim();
          // Find first { and last }
          const firstBrace = potentialJson.indexOf('{');
          const lastBrace = potentialJson.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            const jsonString = potentialJson.substring(firstBrace, lastBrace + 1);
            try {
              const parsed = JSON.parse(jsonString);
              if (parsed.ticket_created) {
                ticketData = parsed;
                displayContent = message.content.replace(potentialJson, '').trim();
              }
            } catch (e) {
              // Failed to parse, ignore
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse ticket JSON", e);
    }
  }

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-emerald-600'
          }`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm w-full ${isUser
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : message.isError
                  ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none'
                  : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
              }`}
          >
            {/* Display User Attachments */}
            {isUser && message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {message.attachments.map((att, i) => (
                  <AttachmentDisplay key={i} attachment={att} />
                ))}
              </div>
            )}

            {message.isError ? (
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{message.content}</span>
              </div>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown
                  components={{
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                    a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                    img: ({ node, ...props }) => (
                      <div className="my-2 rounded-lg overflow-hidden border border-slate-200">
                        <img {...props} className="w-full h-auto max-h-[300px] object-cover" />
                      </div>
                    )
                  }}
                >
                  {displayContent}
                </ReactMarkdown>

                {/* Ticket Confirmation Visual */}
                {ticketData && (
                  <TicketConfirmation data={ticketData} />
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;