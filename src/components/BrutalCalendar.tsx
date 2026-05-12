import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ArrowLeft, X } from 'lucide-react';

interface BrutalCalendarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const BrutalCalendar: React.FC<BrutalCalendarProps> = ({ value, onChange, placeholder }) => {
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

  const handleDayKeyDown = (e: React.KeyboardEvent, day: number) => {
    let newDay = day;
    if (e.key === 'ArrowLeft') newDay = day - 1;
    else if (e.key === 'ArrowRight') newDay = day + 1;
    else if (e.key === 'ArrowUp') newDay = day - 7;
    else if (e.key === 'ArrowDown') newDay = day + 7;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDateClick(day);
      return;
    } else return;

    e.preventDefault();
    const totalDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    if (newDay >= 1 && newDay <= totalDays) {
      const el = modalRef.current?.querySelector(`[data-day="${newDay}"]`) as HTMLElement;
      el?.focus();
    }
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
      const isSelected = selectedDate && 
        selectedDate.getDate() === i && 
        selectedDate.getMonth() === month && 
        selectedDate.getFullYear() === year;
      
      const isToday = new Date().getDate() === i && 
        new Date().getMonth() === month && 
        new Date().getFullYear() === year;

      days.push(
        <button
          key={i}
          type="button"
          data-day={i}
          onClick={() => handleDateClick(i)}
          onKeyDown={(e) => handleDayKeyDown(e, i)}
          aria-label={`${i} ${currentDate.toLocaleString('default', { month: 'long' })} ${year}`}
          aria-pressed={isSelected}
          className={`h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full text-base font-bold transition-all duration-200 relative
            ${isSelected 
              ? 'bg-[var(--c-emerald)] text-white shadow-lg shadow-[var(--c-emerald)]/20' 
              : isToday
                ? 'text-[var(--c-emerald)] font-bold ring-1 ring-[var(--c-emerald)]'
                : 'text-gray-900 hover:bg-gray-100'
            } focus:outline-none focus:ring-2 focus:ring-[var(--c-emerald)] focus:ring-offset-1`}
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

  const modalContent = isOpen ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal Content */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl overflow-hidden w-full max-w-[400px] animate-in zoom-in-95 fade-in duration-200"
      >
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close calendar"
        >
          <X size={20} className="text-[var(--c-ink)]" />
        </button>

        {step === 'date' ? (
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight" aria-live="polite">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <button type="button" onClick={handlePrevMonth} aria-label="Previous month" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                <button type="button" onClick={handleNextMonth} aria-label="Next month" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-4" aria-hidden="true">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <div key={day} className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center text-[11px] font-black text-gray-300 uppercase tracking-widest">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid">
              {renderDays()}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <button 
                onClick={() => setStep('date')}
                className="group p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-[var(--c-ink)] hover:text-[var(--c-emerald)] flex items-center gap-2"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest">Date Selection</span>
              </button>
              <div className="text-xs font-black text-[var(--c-emerald)] uppercase tracking-widest bg-[var(--c-emerald)]/5 px-3 py-1 rounded-full">
                {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>

            <div className="flex h-[360px] divide-x divide-gray-50">
              {/* Hours */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 text-center text-[10px] font-black text-[var(--c-ink)] uppercase tracking-widest border-b border-gray-50">Hours</div>
                <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 snap-y" role="listbox" aria-label="Select hour">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      aria-selected={selectedDate?.getHours() === i}
                      onClick={() => handleTimeChange('hours', i)}
                      className={`w-full py-4 rounded-2xl text-lg font-mono font-bold transition-all snap-center mb-2
                        ${selectedDate?.getHours() === i ? 'bg-[var(--c-emerald)] text-white shadow-xl shadow-[var(--c-emerald)]/20 scale-110' : 'text-[var(--c-ink)] hover:bg-gray-50 hover:text-[var(--c-emerald)]'}`}
                    >
                      {i.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 text-center text-[10px] font-black text-[var(--c-ink)] uppercase tracking-widest border-b border-gray-50">Minutes</div>
                <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 snap-y" role="listbox" aria-label="Select minutes">
                  {[0, 15, 30, 45].map((i) => (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      aria-selected={selectedDate?.getMinutes() === i}
                      onClick={() => handleTimeChange('minutes', i)}
                      className={`w-full py-4 rounded-2xl text-lg font-mono font-bold transition-all snap-center mb-2
                        ${selectedDate?.getMinutes() === i ? 'bg-[var(--c-emerald)] text-white shadow-xl shadow-[var(--c-emerald)]/20 scale-110' : 'text-[var(--c-ink)] hover:bg-gray-50 hover:text-[var(--c-emerald)]'}`}
                    >
                      {i.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6">
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-5 bg-[var(--c-emerald)] text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-[var(--c-emerald)]/30 hover:translate-y-[-2px] active:translate-y-[0px] hover:shadow-[var(--c-emerald)]/40 transition-all"
              >
                Confirm Time
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full">
        <button 
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`w-full bg-white border border-gray-200 p-4 rounded-xl cursor-pointer transition-all duration-300 hover:border-[var(--c-emerald)] hover:shadow-xl hover:shadow-[var(--c-emerald)]/10 flex items-center gap-4 text-left focus:outline-none focus:ring-2 focus:ring-[var(--c-emerald)]/20
            ${isOpen ? 'border-[var(--c-emerald)] ring-2 ring-[var(--c-emerald)]/10' : ''}`}
        >
          <div className={`p-2 rounded-lg transition-colors duration-300 ${value ? 'bg-[var(--c-emerald)]/10 text-[var(--c-emerald)]' : 'bg-gray-100 text-[var(--c-ink)]'}`}>
            <CalendarIcon size={20} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black text-[var(--c-ink)] uppercase tracking-widest mb-0.5">Meeting Schedule</div>
            <div className={`text-sm font-bold ${value ? 'text-gray-900' : 'text-[var(--c-ink)] italic'}`}>
              {value ? formatDisplay(value) : placeholder || 'Choose date and time...'}
            </div>
          </div>
        </button>
      </div>
      {isOpen && createPortal(modalContent, document.body)}
    </>
  );
};

export default BrutalCalendar;
