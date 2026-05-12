import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ArrowLeft, X } from 'lucide-react';

interface NeumorphicCalendarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const NeumorphicCalendar: React.FC<NeumorphicCalendarProps> = ({ value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'date' | 'time'>('date');
  const [currentDate, setCurrentDate] = useState(new Date(value || Date.now()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? new Date(value) : null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStep('date');
      if (triggerRef.current) triggerRef.current.focus();
    }
  }, [isOpen]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (selectedDate) {
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
    } else {
      newDate.setHours(12);
      newDate.setMinutes(0);
    }
    setSelectedDate(newDate);
    setStep('time');
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: number) => {
    const newDate = new Date(selectedDate || new Date());
    if (type === 'hours') newDate.setHours(val);
    else newDate.setMinutes(val);
    setSelectedDate(newDate);
    updateValue(newDate);
  };

  const updateValue = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    onChange(formatted);
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10 md:h-12 md:w-12" />);
    }

    for (let i = 1; i <= totalDays; i++) {
      const checkDate = new Date(year, month, i);
      const isPast = checkDate < new Date(new Date().setHours(0, 0, 0, 0));
      
      const isToday = new Date().getDate() === i && 
        new Date().getMonth() === month && 
        new Date().getFullYear() === year;

      const isSelected = selectedDate && 
        selectedDate.getDate() === i && 
        selectedDate.getMonth() === month && 
        selectedDate.getFullYear() === year;

      days.push(
        <button
          key={i}
          type="button"
          onClick={() => !isPast && handleDateClick(i)}
          disabled={isPast}
          className={`h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200
            ${isSelected 
              ? 'nm-inset text-white scale-105' 
              : isToday
                ? 'nm-flat text-[var(--c-emerald)] ring-1 ring-[var(--c-emerald)]/20'
                : isPast
                  ? 'text-[var(--c-ink)] opacity-10 cursor-not-allowed'
                  : 'nm-flat text-[var(--c-ink)] opacity-80 hover:nm-inset hover:scale-105'
            }`}
          style={isSelected ? { background: 'linear-gradient(135deg, var(--c-emerald), var(--c-teal))' } : {}}
        >
          {i}
        </button>
      );
    }
    return days;
  };

  const formatDisplay = (val: string) => {
    if (!val) return '';
    const d = new Date(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' @ ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setIsOpen(false)} />
      
      <div ref={modalRef} className="relative nm-flat bg-[var(--c-bg)] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden w-[92%] max-w-[400px] animate-fade-up">
        {step === 'date' && (
          <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 nm-flat hover:nm-inset rounded-full transition-all z-10">
            <X size={18} className="text-[var(--c-ink)]" />
          </button>
        )}

        {step === 'date' ? (
          <div className="p-6 md:p-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-[var(--c-ink)] uppercase tracking-widest">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-2">
                <button type="button" onClick={handlePrevMonth} className="p-2 nm-flat hover:nm-inset rounded-xl transition-all"><ChevronLeft size={16} /></button>
                <button type="button" onClick={handleNextMonth} className="p-2 nm-flat hover:nm-inset rounded-xl transition-all"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <div key={day} className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center text-[10px] font-black text-[var(--c-ink)] opacity-20 uppercase tracking-widest">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {renderDays()}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-8 nm-inset bg-opacity-30 flex items-center justify-between rounded-b-[2rem]">
              <button onClick={() => setStep('date')} className="p-2 nm-flat hover:nm-inset rounded-xl transition-all text-[var(--c-emerald)] flex items-center gap-2">
                <ArrowLeft size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-widest nm-inset px-4 py-2 rounded-full">
                  {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 nm-flat hover:nm-inset rounded-full transition-all">
                  <X size={18} className="text-[var(--c-ink)]" />
                </button>
              </div>
            </div>

            <div className="flex h-[360px] p-4 gap-4">
              <div className="flex-1 flex flex-col nm-inset rounded-[2rem] overflow-hidden relative">
                <div className="p-4 text-center text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-widest border-b border-[var(--c-bg)]">Hours</div>
                <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 space-y-2" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleTimeChange('hours', i)}
                      className={`w-full py-4 rounded-2xl text-lg font-mono font-bold transition-all
                        ${selectedDate?.getHours() === i ? 'nm-inset text-[var(--c-emerald)] scale-110' : 'text-[var(--c-ink)] opacity-70 hover:nm-flat hover:opacity-100'}`}
                    >
                      {i.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col nm-inset rounded-[2rem] overflow-hidden relative">
                <div className="p-4 text-center text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-widest border-b border-[var(--c-bg)]">Minutes</div>
                <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 space-y-2" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((i) => (
                    <button
                      key={i}
                      onClick={() => handleTimeChange('minutes', i)}
                      className={`w-full py-4 rounded-2xl text-lg font-mono font-bold transition-all
                        ${selectedDate?.getMinutes() === i ? 'nm-inset text-[var(--c-emerald)] scale-110' : 'text-[var(--c-ink)] opacity-70 hover:nm-flat hover:opacity-100'}`}
                    >
                      {i.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8">
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-5 nm-flat text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(to right, var(--c-emerald), var(--c-teal))' }}
              >
                Confirm Time
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <button 
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full p-5 rounded-2xl transition-all duration-300 flex items-center gap-5 text-left focus:outline-none ${isOpen ? 'nm-inset' : 'nm-flat hover:nm-inset'}`}
      >
        <div className={`p-3 rounded-xl transition-all ${value ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat text-[var(--c-emerald)] opacity-70'}`}>
          <CalendarIcon size={22} />
        </div>
        <div className="flex-1">
          <div className="text-[9px] font-black text-[var(--c-emerald)] opacity-70 uppercase tracking-[0.3em] mb-1">Schedule</div>
          <div className={`text-sm font-bold uppercase tracking-tight ${value ? 'text-[var(--c-emerald)]' : 'text-[var(--c-emerald)] opacity-70'}`}>
            {value ? formatDisplay(value) : placeholder || 'Choose date & time'}
          </div>
        </div>
      </button>
      {isOpen && createPortal(modalContent, document.body)}
    </div>
  );
};

export default NeumorphicCalendar;
