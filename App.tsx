import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from './services/geminiService';
import { unyraService } from './services/unyraService';
import { Message, LoadingState, SubAccount, UserProfile, Attachment } from './types';
import { MOCK_SUBACCOUNTS, MOCK_ADMIN_USER, MOCK_CLIENT_USER } from './constants';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import LocationSelector from './components/LocationSelector';
import { LifeBuoy, Zap, Database, CheckCircle2, Bot, Users, LayoutDashboard, Ticket, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  // State for User Role (Mocking Authentication)
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_ADMIN_USER);

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
      const apiKey = import.meta.env.VITE_GHL_API_KEY;
      if (!apiKey) {
        setFetchError("❌ Error Critical: Falta VITE_GHL_API_KEY en las variables de entorno de Vercel.");
        return;
      }

      try {
        // 1. Fetch all (Assuming Admin Key)
        const allAccounts = await unyraService.getSubaccounts();

        if (allAccounts.length === 0) {
          setFetchError("⚠️ Conexión exitosa, pero no se encontraron subcuentas (o la API Key no tiene permisos).");
          // Keep loading/fallback state
        } else {
          setFetchError(null);
        }

        // 2. Filter based on Role
        // In a real app, 'currentUser' would come from auth context.
        // Here, we act as if we are:
        // - Admin: See all.
        // - Client: See only the one matching VITE_GHL_LOCATION_ID.

        if (currentUser.role === 'admin') {
          setSubaccounts(allAccounts);
          if (allAccounts.length > 0 && !selectedAccount) {
            setSelectedAccount(allAccounts[0]);
          }
        } else {
          // Client Mode: Filter to specific ID
          const myLocationId = import.meta.env.VITE_GHL_LOCATION_ID;
          const myAccount = allAccounts.find(a => a.id === myLocationId) || allAccounts[0]; // Fallback

          if (myAccount) {
            setSubaccounts([myAccount]);
            setSelectedAccount(myAccount);
          }
        }
      } catch (err: any) {
        setFetchError(`❌ Error de Conexión: ${err.message || 'Error desconocido al conectar con GHL'}`);
      }
    };

    fetchAccounts();
  }, [currentUser]); // Re-fetch/filter if role changes (for demo switch)


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

  // Switch Role Handler (For Demo Purposes)
  const handleRoleSwitch = () => {
    if (currentUser.role === 'admin') {
      // Switch to Client
      // Assuming VITE_GHL_LOCATION_ID is the "Client's" location
      const clientLocId = import.meta.env.VITE_GHL_LOCATION_ID;

      setCurrentUser({
        id: 'client_user',
        name: 'Cliente (Role)',
        role: 'client',
        assignedLocationId: clientLocId
      });
      // Effect will re-filter subaccounts
    } else {
      // Switch to Admin
      setCurrentUser(MOCK_ADMIN_USER);
      // Effect will fetch all
    }
  };

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
            <span>v3.0.0 (Multimodal)</span>
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
                  <span>Mis Tickets (3)</span>
                </li>
              </ul>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-slate-700 space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-xs truncate text-slate-300">
              {currentUser.name}
            </div>
          </div>

          {/* Role Toggle for Demo */}
          <button
            onClick={handleRoleSwitch}
            className="w-full flex items-center justify-center gap-2 text-xs py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors border border-slate-700"
          >
            <RotateCcw size={12} />
            <span>Switch Role (Demo)</span>
          </button>
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