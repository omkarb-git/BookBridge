import { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight, MessageSquare, SendHorizonal, Lock, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface MessagesPageProps {
  onNavigate: (page: string) => void;
}

export default function MessagesPage({ onNavigate }: MessagesPageProps) {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const selectedMessages = messages.length > 0 ? messages : [];

  const formatTimestamp = (value: any) => {
    if (!value) return '';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(
          collection(db, 'exchanges'),
          where('participants', 'array-contains', currentUser.uid)
        );

        const unsubscribeConvs = onSnapshot(q, async (snapshot) => {
          const convsData = await Promise.all(snapshot.docs.map(async (entry) => {
            const data = entry.data() as any;
            const partnerName = currentUser.uid === data.requesterId
              ? (data.ownerName || 'Reader')
              : (data.requesterName || data.partner || 'Reader');

            const latestMessageSnap = await getDocs(query(
              collection(db, 'messages'),
              where('exchangeId', '==', entry.id)
            ));

            const sortedMessages = latestMessageSnap.docs
              .map((doc) => doc.data() as any)
              .sort((a, b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
              });
            const latestMessage = sortedMessages[0];

            return {
              id: entry.id,
              exchangeId: entry.id,
              partner: partnerName,
              partnerAvatar: partnerName.slice(0, 2).toUpperCase(),
              lastMessage: latestMessage?.text || 'Open chat',
              lastMessageAt: formatTimestamp(latestMessage?.createdAt),
              lastMessageSort: latestMessage?.createdAt?.toMillis ? latestMessage.createdAt.toMillis() : 0,
              unread: 0,
              ...data,
            };
          }));

          convsData.sort((a, b) => {
            const aTime = a.lastMessageSort || (a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0);
            const bTime = b.lastMessageSort || (b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0);
            return bTime - aTime;
          });

          setConversations(convsData);
          if (convsData.length > 0 && !selectedConvId && window.innerWidth >= 768) {
            setSelectedConvId(convsData[0].id);
          }
          setLoading(false);
        });

        return () => unsubscribeConvs();
      }

      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [selectedConvId]);

  useEffect(() => {
    if (!selectedConvId || !db) return;

    const q = query(
      collection(db, 'messages'),
      where('exchangeId', '==', selectedConvId)
    );

    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const msgsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return aTime - bTime;
        });
      setMessages(msgsData);
    });

    return () => unsubscribeMsgs();
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user || !selectedConvId || !db) return;

    const msgText = text.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        exchangeId: selectedConvId,
        text: msgText,
        senderId: user.uid,
        senderName: user.displayName || user.email,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="h-[calc(100dvh-4.5rem)] flex overflow-hidden bg-[var(--c-bg)] relative">
      <div className={`w-full md:w-96 flex-shrink-0 bg-transparent overflow-y-auto flex flex-col z-20 transition-all p-4 sm:p-6 space-y-4 sm:space-y-6 ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="nm-flat p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white sticky top-0 z-10 flex items-center justify-between">
          <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-[0.2em] flex items-center gap-4">
            <div className="w-10 h-10 nm-inset flex items-center justify-center rounded-xl text-[var(--c-emerald)]">
              <MessageSquare size={20} />
            </div>
            Inbox
          </div>
          <div className="nm-inset px-4 py-1.5 rounded-full text-[10px] font-black text-[var(--c-emerald)]">
            {conversations.length} ACTIVE
          </div>
        </div>

        <div className="space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 nm-inset rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--c-emerald)] animate-spin" />
              </div>
              <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-widest">Syncing Inbox...</p>
            </div>
          )}

          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`w-full p-4 sm:p-6 text-left rounded-2xl sm:rounded-[2.5rem] transition-all group ${
                selectedConv?.id === conv.id ? 'nm-inset' : 'nm-flat hover:nm-inset'
              }`}
            >
              <div className="flex items-start gap-5">
                <div className={`w-14 h-14 flex-shrink-0 nm-inset rounded-2xl flex items-center justify-center font-black text-sm transition-all ${
                  selectedConv?.id === conv.id ? 'text-[var(--c-emerald)] scale-110' : 'text-[var(--c-ink)] opacity-70'
                }`}>
                  {conv.partnerAvatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-black text-[var(--c-ink)] uppercase tracking-tight">
                      {conv.partner}
                    </div>
                    <div className="text-[9px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest whitespace-nowrap">
                      {conv.lastMessageAt}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mb-4">
                    {conv.lastMessage}
                  </div>
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 nm-inset rounded-xl text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-widest">
                    <ArrowLeftRight size={10} /> ID: {conv.exchangeId.substring(0, 8)}
                  </div>
                </div>
                {conv.unread > 0 && (
                  <div className="w-6 h-6 nm-inset text-[var(--c-emerald)] text-[9px] font-black rounded-lg flex items-center justify-center shadow-lg animate-pulse">
                    {conv.unread}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={`${selectedConvId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden relative p-1 sm:p-6`}>
        {selectedConv ? (
          <div className="h-full flex flex-col nm-flat rounded-2xl md:rounded-[3.5rem] overflow-hidden bg-transparent">
            <div className="px-3 sm:px-10 py-3 sm:py-8 nm-flat bg-white flex items-center justify-between relative z-10 gap-2 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                <button 
                  onClick={() => setSelectedConvId(null)}
                  className="md:hidden w-10 h-10 nm-inset flex items-center justify-center rounded-xl text-[var(--c-emerald)] flex-shrink-0"
                >
                  <ArrowLeftRight className="rotate-180" size={18} />
                </button>
                <div className="w-10 h-10 sm:w-14 sm:h-14 nm-inset rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-[var(--c-emerald)] text-sm sm:text-lg flex-shrink-0">
                  {selectedConv.partnerAvatar}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-[var(--c-ink)] text-xs sm:text-xl uppercase tracking-tighter truncate">{selectedConv.partner}</div>
                  <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                       <span className="w-1 h-1 sm:w-2 sm:h-2 bg-[var(--c-emerald)] rounded-full animate-pulse"></span>
                       <span className="text-[7px] sm:text-[9px] font-bold text-[var(--c-emerald)] uppercase tracking-widest truncate">ACTIVE</span>
                    </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('exchanges')}
                className="nm-flat px-3 sm:px-8 py-2 sm:py-4 rounded-xl sm:rounded-2xl text-[7px] sm:text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-widest flex items-center gap-1.5 sm:gap-3 hover:scale-105 transition-all flex-shrink-0"
              >
                <ArrowLeftRight size={12} sm:size={14} /> <span className="hidden sm:inline">VIEW EXCHANGE</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-6 sm:space-y-10">
              <div className="text-center">
                <span className="nm-inset px-8 py-2 rounded-full text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.3em]">
                  SECURE CHANNEL OPEN • EXCHANGE #{selectedConv.exchangeId.substring(0, 12)}
                </span>
              </div>
              
              {selectedMessages.map((msg: any) => {
                const isMine = msg.senderId === user?.uid;
                return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && (
                    <div className="w-12 h-12 nm-inset rounded-2xl flex items-center justify-center font-black text-[var(--c-ink)] opacity-20 text-xs mr-4 flex-shrink-0 self-end mb-1">
                      {selectedConv.partnerAvatar}
                    </div>
                  )}
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] px-4 sm:px-6 py-4 sm:py-5 rounded-2xl md:rounded-[2rem] font-black text-xs sm:text-sm leading-relaxed transition-all ${
                        isMine
                          ? 'nm-flat bg-white border-2 border-emerald-800 text-emerald-900 rounded-tr-none shadow-xl'
                          : 'nm-flat bg-emerald-50 text-emerald-900 rounded-tl-none border-2 border-emerald-200 shadow-sm'
                      }`}
                    >
                      <div>{msg.text}</div>
                      <div className={`text-[8px] mt-4 font-black uppercase tracking-[0.2em] ${isMine ? 'text-emerald-700 text-right' : 'text-emerald-600 opacity-50 text-right'}`}>
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    </div>
                </div>
              )})}
              <div ref={messagesEndRef} />
            </div>

            {!['completed', 'rejected', 'cancelled'].includes(selectedConv.status) && (
              <div className="px-4 sm:px-10 py-3 sm:py-4 flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth">
                {["I've reached the location", 'Where exactly are you?', "I'm running 5 mins late", 'Please call me', 'Can we reschedule?'].map(qr => (
                  <button
                    key={qr}
                    onClick={() => handleSendMessage(qr)}
                    className="flex-shrink-0 px-6 py-3 nm-flat bg-white hover:nm-inset text-[9px] font-black text-[var(--c-ink)] opacity-80 uppercase tracking-widest transition-all rounded-full"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            <div className="p-4 sm:p-10 bg-transparent">
              {['completed', 'rejected', 'cancelled'].includes(selectedConv.status) ? (
                <div className="nm-inset p-10 rounded-[3rem] text-center bg-gray-50 bg-opacity-80">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 nm-inset rounded-2xl opacity-20 flex items-center justify-center">
                      <Lock size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70">
                        EXCHANGE {selectedConv.status.toUpperCase()}
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-[var(--c-ink)] opacity-20 mt-2">
                        CHAT ARCHIVED PERMANENTLY
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="MESSAGE..."
                    className="flex-1 nm-inset rounded-2xl sm:rounded-[2.5rem] px-5 sm:px-10 py-4 sm:py-6 text-xs sm:text-sm font-bold text-[var(--c-ink)] focus:outline-none placeholder:opacity-60 uppercase tracking-tight"
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage(newMessage)}
                  />
                  <button
                    onClick={() => handleSendMessage(newMessage)}
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 sm:w-16 sm:h-16 nm-flat text-[var(--c-emerald)] rounded-xl sm:rounded-[1.5rem] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-20"
                  >
                    <SendHorizonal size={20} sm:size={28} className={newMessage.trim() ? 'ml-0.5 sm:ml-1' : ''} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="w-32 h-32 nm-inset rounded-[3rem] flex items-center justify-center mb-10 text-[var(--c-emerald)] animate-float">
              <MessageSquare size={56} className="opacity-20" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--c-ink)] opacity-80 mb-3">SELECT A CONVERSATION</h3>
            <p className="text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-[0.4em] nm-flat px-10 py-3 rounded-full">SECURE ENCRYPTED CHANNEL</p>
          </div>
        )}
      </div>

      {!selectedConvId && (
        <div className="flex md:hidden flex-1 flex-col items-center justify-center p-10 relative">
          <div className="w-24 h-24 nm-inset rounded-[2.5rem] flex items-center justify-center mb-10 text-[var(--c-emerald)]">
            <MessageSquare size={48} className="opacity-20" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-[var(--c-ink)] opacity-80 mb-3 text-center">YOUR MESSAGES</h3>
          <p className="text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-[0.4em] nm-flat px-8 py-3 rounded-full text-center">SELECT CHAT TO START</p>
        </div>
      )}
    </div>
  );
}
