import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CustomDropdown({ options, value, onChange, placeholder, className = '' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 transition-all duration-300 rounded-2xl ${
          isOpen ? 'nm-inset' : 'nm-flat hover:nm-inset'
        }`}
      >
        <span className={`text-[11px] font-black uppercase tracking-[0.15em] text-black ${!selectedOption ? 'opacity-30' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`transition-transform duration-300 text-black ${isOpen ? 'rotate-180' : 'opacity-30'}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-3 z-[100] nm-flat bg-[var(--c-bg)] rounded-2xl border-2 border-black border-opacity-10 shadow-2xl overflow-hidden animate-fade-in p-2">
          <div className="max-h-[250px] overflow-y-auto no-scrollbar space-y-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full p-4 text-left font-bold uppercase text-[10px] tracking-widest transition-all rounded-xl flex items-center justify-between group active:scale-[0.98] ${
                  value === option.value 
                    ? 'nm-inset border-2 border-black text-black' 
                    : 'text-black hover:nm-inset hover:translate-x-1'
                }`}
              >
                <span className={value === option.value ? 'font-black' : 'font-bold'}>
                  {option.label}
                </span>
                {value === option.value && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
