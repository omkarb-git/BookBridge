import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, BookOpen, Repeat, MapPin, Loader2, ArrowUpRight, TrendingUp, Zap, Award, Info } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, limit, onSnapshot, where, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL: string;
  points: number;
  pastPoints: number;
  weeklyPoints: number;
  rank: number;
  prevRank: number;
  stats: {
    booksAdded: number;
    exchangesCompleted: number;
    epubsUploaded: number;
  };
  location: string;
  status: 'rising' | 'stable' | 'elite';
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all time' | 'this month'>('all time');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // Proactive Sync for Current User
  useEffect(() => {
    if (!currentUser) return;

    const syncKarma = async () => {
      try {
        const uid = currentUser.uid;
        const [booksSnap, epubsSnap, exchangesSnap] = await Promise.all([
          getDocs(query(collection(db, 'books'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'epubs'), where('uploadedBy', '==', uid))),
          getDocs(query(collection(db, 'exchanges'), where('participants', 'array-contains', uid)))
        ]);

        const books = booksSnap.docs.length;
        const epubs = epubsSnap.docs.length;
        const exchanges = exchangesSnap.docs.filter(d => d.data().status === 'completed').length;
        const total = (books * 10) + (epubs * 50) + (exchanges * 100);

        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data() || {};

        if (currentData.points !== total || currentData.booksAdded !== books || currentData.exchangesCompleted !== exchanges) {
          await updateDoc(userRef, {
            points: total,
            booksAdded: books,
            exchangesCompleted: exchanges,
            epubsUploaded: epubs,
            updatedAt: serverTimestamp()
          });
          console.log('Leaderboard: Karma synced for current user');
        }
      } catch (err) {
        console.error('Leaderboard sync error:', err);
      }
    };

    syncKarma();
  }, [currentUser]);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('User Data for', data.displayName, ':', data);
        
        // Map field names carefully - support multiple naming conventions for legacy data
        const booksCount = data.booksAdded || data.booksUploaded || data.physicalBooksCount || 0;
        const exchangesCount = data.exchangesCompleted || data.completedExchangesCount || 0;
        const epubsCount = data.epubsUploaded || data.digitalBooksCount || 0;
        
        // Match ProfilePage.tsx multipliers: 
        // Physical: 10, Exchange: 100, EPUB: 50
        const calculatedPoints = (booksCount * 10) + (exchangesCount * 100) + (epubsCount * 50);
        const totalPoints = data.points || calculatedPoints;
        
        // Realistic simulation based on user ID for deterministic but dynamic feel
        const hash = doc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const randomVariance = (hash % 200) + 50;
        const pastPoints = data.pastPoints || Math.max(totalPoints - randomVariance, 0);
        const weeklyPoints = totalPoints - pastPoints;

        // Determine status
        let status: 'rising' | 'stable' | 'elite' = 'stable';
        if (weeklyPoints > 150) status = 'rising';
        if (totalPoints > 1000) status = 'elite';

        return {
          id: doc.id,
          displayName: data.displayName || 'Reader',
          photoURL: data.photoURL || '',
          points: Math.max(totalPoints, 0),
          pastPoints: pastPoints,
          weeklyPoints: weeklyPoints,
          stats: {
            booksAdded: booksCount,
            exchangesCompleted: exchangesCount,
            epubsUploaded: epubsCount,
          },
          location: data.locationName || 'Unknown Location',
          status: status
        } as LeaderboardUser;
      });

      // Sort by current points
      fetchedUsers.sort((a, b) => b.points - a.points);
      
      // Calculate ranks
      const prevSorted = [...fetchedUsers].sort((a, b) => b.pastPoints - a.pastPoints);
      
      const rankedUsers = fetchedUsers.map((user, index) => {
        const rank = index + 1;
        const prevRank = prevSorted.findIndex(u => u.id === user.id) + 1;
        return {
          ...user,
          rank,
          prevRank
        };
      });

      setUsers(rankedUsers);
      setLoading(false);
    }, (err) => {
      console.error('Leaderboard sync error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [timeframe]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-16 h-16 text-[var(--c-emerald)] animate-spin mb-4" />
        <p className="text-xl font-bold font-mono uppercase text-[var(--c-ink)]">Syncing World Rankings...</p>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 space-y-6 animate-fade-in">
      {/* Simple Header */}
      <div className="flex justify-between items-center px-2">
        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--c-ink)]">Leaderboard</h1>
        
        {/* Timeframe Toggles */}
        <div className="flex gap-4 text-[10px] font-black uppercase">
          {(['all time', 'this month'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`transition-colors ${
                timeframe === t ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-40 hover:opacity-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Simple List */}
      <div className="space-y-1 text-xs px-2">
        {users.length > 0 ? (
          users.map((user) => {
            const isTopUser = user.rank === 1;
            return (
              <div 
                key={user.id} 
                className={`flex justify-between items-center py-2 px-3 ${
                  isTopUser ? 'bg-[var(--c-emerald)]/10 text-[var(--c-emerald)] font-bold rounded-lg' : 'text-[var(--c-ink)]'
                } border-b border-[var(--c-emerald)]/5`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono opacity-50">#{user.rank}</span>
                  <span className="uppercase tracking-tight">{user.displayName}</span>
                  {isTopUser && <Trophy size={12} className="inline ml-1" />}
                </div>
                <div className="font-mono">
                  {user.points.toLocaleString()}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 opacity-30 uppercase tracking-widest">
            No records found
          </div>
        )}
      </div>
    </div>
  );
}
