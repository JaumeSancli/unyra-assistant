import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from './services/geminiService';
import { unyraService } from './services/unyraService';
import { sheetsService } from './services/sheetsService';
import { Message, LoadingState, SubAccount, UserProfile, Attachment } from './types';
import { MOCK_SUBACCOUNTS, MOCK_ADMIN_USER, MOCK_CLIENT_USER } from './constants';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import LocationSelector from './components/LocationSelector';
import { LifeBuoy, Zap, Database, CheckCircle2, Bot, Users, LayoutDashboard, Ticket, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  // Constants
  const ADMIN_EMAILS = ['unyra@intrepidum.net', 'laura@jaumesanclimens.com'];

  // State for current user (Derived from URL or Default)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || 'unyra@intrepidum.net'; // Default to admin for dev
    const name = params.get('name') || 'Admin Usuario';

    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'client';

    return {
      id: 'usr-1',
      name: name,
      email: email,
      role: role as 'admin' | 'client' || 'client',
      avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
    };
  });

  // State for subaccounts (Real Data)
  const [subaccounts, setSubaccounts] = useState<SubAccount[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State for active account
  const [selectedAccount, setSelectedAccount] = useState<SubAccount | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Subaccounts on Boot
  useEffect(() => {
    const fetchAccounts = async () => {
      // DEBUG: Check if API Key exists
      // Backend handles security, but we check env in UI for dev clues if needed

      try {
        // 1. Fetch all (Assuming Admin Key via Backend)
        const allAccounts = await unyraService.getSubaccounts();

        if (allAccounts.length === 0) {
          setFetchError("⚠️ Conexión exitosa, pero no se encontraron subcuentas.");
        } else {
          setFetchError(null);
        }

        // 2. Filter based on Role and URL Params
        const params = new URLSearchParams(window.location.search);
        const urlLocationId = params.get('location_id') || import.meta.env.VITE_GHL_LOCATION_ID;

        if (currentUser.role === 'admin') {
          setSubaccounts(allAccounts);
          if (allAccounts.length > 0 && !selectedAccount) {
            // Try to auto-select from URL if valid, else first account
            const target = allAccounts.find(a => a.id === urlLocationId) || allAccounts[0];
            setSelectedAccount(target);
          }
        } else {
          // Client Mode: Filter to specific ID
          const myAccount = allAccounts.find(a => a.id === urlLocationId);

          if (myAccount) {
            setSubaccounts([myAccount]);
            setSelectedAccount(myAccount);
          } else if (allAccounts.length > 0) {
            // Fallback: If URL param is missing/wrong, show error or nothing. 
            // Do NOT show random account to client.
            setFetchError("⚠️ No se encontró la subcuenta o no tienes permisos.");
            setSubaccounts([]);
          }
        }
      } catch (err: any) {
        setFetchError(`❌ Error de Conexión: ${err.message || 'Error desconocido'}`);
      }
    };

    fetchAccounts();
  }, [currentUser]); // Re-fetch logic if user changes


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initChat = async (account: SubAccount, user: UserProfile) => {
    if (!account) return;

    setLoadingState(LoadingState.THINKING);
    try {
      await geminiService.startChat(account);

      let welcomeText = "";
      if (user.role === 'admin') {
        welcomeText = `Hola ${user.name}. Estás supervisando la cuenta **${account.name}**. ¿Qué gestión deseas realizar hoy?`;
      } else {
        welcomeText = `Hola ${user.name}. Bienvenido al soporte de Unyra para **${account.name}**. ¿En qué puedo ayudarte? Puedes enviarme audio, video o texto.`;
      }

      setMessages([
        {
          id: 'welcome',
          role: 'model',
          content: welcomeText,
          timestamp: new Date()
        }
      ]);
    } catch (e) {
      console.error("Failed to init chat", e);
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  };

  // Ticket Count State
  const [ticketCount, setTicketCount] = useState<number>(0);

  // Fetch Tickets on User Change
  useEffect(() => {
    const fetchTickets = async () => {
      if (currentUser.email) {
        try {
          const tickets = await sheetsService.getTickets(currentUser.email);
          setTicketCount(tickets.length);
        } catch (e) {
          console.error("Failed to fetch tickets", e);
        }
      }
    };
    fetchTickets();
  }, [currentUser.email]);

  // Initialize chat when active account changes (and is valid)
  useEffect(() => {
    if (selectedAccount) {
      initChat(selectedAccount, currentUser);
    }
  }, [selectedAccount]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingState]);

  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachments: attachments,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setLoadingState(LoadingState.THINKING);

    try {
      // Execute Gemini Service
      const responseText = await geminiService.sendMessage(text, attachments, (toolName) => {
        setLoadingState(LoadingState.EXECUTING_TOOL);
        setCurrentTool(toolName);
      });

      const newBotMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newBotMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoadingState(LoadingState.IDLE);
      setCurrentTool(null);
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Sidebar */}
      <div className="hidden md:flex w-64 bg-slate-900 flex-col text-slate-300">
        {/* Error Banner */}
        {fetchError && (
          <div className="bg-red-500/10 border-b border-red-500/20 p-2 text-[10px] text-red-400 font-mono break-words">
            {fetchError}
          </div>
        )}
        <div className="p-4 border-b border-slate-700 mb-2">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Zap className="text-yellow-400 fill-yellow-400" />
            <span>UNYRA Support</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex justify-between items-center">
            <span>Jaume Sanclimens</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isAdmin ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Location Context Selector */}
        <LocationSelector
          accounts={subaccounts}
          selectedAccount={selectedAccount || subaccounts[0] || { id: 'loading', name: 'Cargando cuentas...', plan: '', status: 'active', email: '' }}
          onSelect={setSelectedAccount}
          locked={!isAdmin || subaccounts.length === 0}
        />

        <div className="p-4 space-y-6 flex-1 overflow-y-auto">

          {/* Menu for ADMIN */}
          {isAdmin && (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Administración Agencia</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <LayoutDashboard size={16} className="text-indigo-400" />
                    <span>Global Dashboard</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <Database size={16} className="text-indigo-400" />
                    <span>Base de Conocimientos</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <Users size={16} className="text-indigo-400" />
                    <span>Gestionar Subcuentas</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Supervisión</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <Ticket size={16} className="text-emerald-400" />
                    <span>Todos los Tickets</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <CheckCircle2 size={16} className="text-blue-400" />
                    <span>Tareas Globales</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Menu for CLIENT */}
          {!isAdmin && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Mi Cuenta</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2 text-white bg-slate-800 p-2 rounded cursor-default">
                  <LifeBuoy size={16} className="text-emerald-400" />
                  <span>Soporte & Chat</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400 cursor-not-allowed p-2">
                  <Ticket size={16} className="text-slate-600" />
                  <span>Mis Tickets ({ticketCount})</span>
                </li>
              </ul>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-slate-700 space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-200 truncate">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {currentUser.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <div className="flex items-center">
            <Zap className="text-indigo-600 mr-2" />
            <span className="font-bold text-slate-800">UNYRA</span>
          </div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
            {isAdmin ? 'Admin' : 'Client'}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Loading Indicator */}
            {loadingState !== LoadingState.IDLE && (
              <div className="flex w-full mb-6 justify-start">
                <div className="flex max-w-[75%] gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                    {loadingState === LoadingState.EXECUTING_TOOL ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        <span className="text-sm text-slate-600 font-medium">
                          Ejecutando herramienta: <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{currentTool}</span>
                        </span>
                      </>
                    ) : (
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={loadingState !== LoadingState.IDLE}
        />

      </div>
    </div>
  );
};

export default App;