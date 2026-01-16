import React, { useState } from 'react';
import { SubAccount } from '../types';
import { Building2, ChevronDown, Check, Lock } from 'lucide-react';

interface LocationSelectorProps {
  accounts: SubAccount[];
  selectedAccount: SubAccount;
  onSelect: (account: SubAccount) => void;
  locked?: boolean;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ accounts, selectedAccount, onSelect, locked = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    if (!locked) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative">
      <div className="px-4 mb-2 flex justify-between items-center">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          Subcuenta Activa
        </label>
        {locked && <Lock size={10} className="text-slate-500" />}
      </div>
      
      <button
        onClick={toggleOpen}
        disabled={locked}
        className={`w-full flex items-center justify-between px-4 py-3 bg-slate-800 transition-colors border-l-4 border-indigo-500 ${
          locked ? 'cursor-default' : 'hover:bg-slate-700 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
            <Building2 size={16} />
          </div>
          <div className="flex flex-col items-start truncate">
            <span className="text-sm font-medium text-slate-200 truncate w-full text-left">
              {selectedAccount.name}
            </span>
            <span className="text-[10px] text-slate-400">
              ID: {selectedAccount.id}
            </span>
          </div>
        </div>
        {!locked && (
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !locked && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-slate-800 border border-slate-700 shadow-xl rounded-md overflow-hidden max-h-60 overflow-y-auto mx-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  onSelect(account);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-700 transition-colors ${
                  selectedAccount.id === account.id ? 'bg-slate-700/50 text-indigo-300' : 'text-slate-300'
                }`}
              >
                <div className="flex flex-col">
                  <span>{account.name}</span>
                  <span className="text-[10px] opacity-60">{account.plan}</span>
                </div>
                {selectedAccount.id === account.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LocationSelector;