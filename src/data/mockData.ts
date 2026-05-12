export const GENRES = [
  { id: 1, name: 'Fiction', slug: 'fiction', color: '#73E6CB', count: 12453 },
  { id: 2, name: 'Non-Fiction', slug: 'non-fiction', color: '#3EBB9E', count: 8231 },
  { id: 3, name: 'Fantasy', slug: 'fantasy', color: '#00674F', count: 6892 },
  { id: 4, name: 'Mystery', slug: 'mystery', color: '#0A3C30', count: 5431 },
  { id: 5, name: 'Self-Help', slug: 'self-help', color: '#73E6CB', count: 4892 },
  { id: 6, name: 'Science', slug: 'science', color: '#3EBB9E', count: 3241 },
  { id: 7, name: 'Biography', slug: 'biography', color: '#00674F', count: 2891 },
  { id: 8, name: "Children's", slug: 'childrens', color: '#0A3C30', count: 2341 },
  { id: 9, name: 'Romance', slug: 'romance', color: '#73E6CB', count: 5672 },
  { id: 10, name: 'History', slug: 'history', color: '#3EBB9E', count: 1892 },
  { id: 11, name: 'Philosophy', slug: 'philosophy', color: '#00674F', count: 1234 },
  { id: 12, name: 'Comics', slug: 'comics', color: '#0A3C30', count: 3891 },
];

export const TESTIMONIALS = [
  {
    id: 1,
    name: 'Sneha R.',
    city: 'Mumbai',
    rating: 5,
    avatar: 'SR',
    color: '#73E6CB',
    text: "I've exchanged 47 books in 6 months and made 12 new friends who love fantasy as much as I do! BookBridge has completely changed how I read.",
  },
  {
    id: 2,
    name: 'Arjun M.',
    city: 'Bangalore',
    rating: 5,
    avatar: 'AM',
    color: '#3EBB9E',
    text: "Found a first edition Wodehouse I'd been looking for years. The real-time tracking made the meetup feel so safe and convenient.",
  },
  {
    id: 3,
    name: 'Ms. Chen',
    city: 'Delhi',
    rating: 5,
    avatar: 'MC',
    color: '#00674F',
    text: 'As a teacher, I upload EPUBs regularly. My students use BookBridge for their reading lists. The points system makes it so engaging!',
  },
  {
    id: 4,
    name: 'Ravi K.',
    city: 'Chennai',
    rating: 5,
    avatar: 'RK',
    color: '#0A3C30',
    text: "Decluttered 200+ books and they all went to real readers who wanted them. This is what sustainable reading looks like.",
  },
];

export type MockBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  condition: string;
  cover?: string;
  owner: { name: string; rating: number; exchanges: number; avatar: string };
  distance?: number;
  isMutualMatch?: boolean;
  wants: string;
  city: string;
  status: string;
};

export const MOCK_BOOKS: MockBook[] = [
  {
    id: '1',
    title: 'Atomic Habits',
    author: 'James Clear',
    genre: 'Self-Help',
    condition: 'like_new',
    owner: { name: 'Ravi K.', rating: 4.8, exchanges: 23, avatar: 'RK' },
    distance: 2.3,
    isMutualMatch: true,
    wants: 'Any Self-Help book',
    city: 'Bangalore',
    status: 'available',
  },
  {
    id: '2',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    genre: 'Fiction',
    condition: 'good',
    owner: { name: 'Priya S.', rating: 4.9, exchanges: 18, avatar: 'PS' },
    distance: 0.8,
    isMutualMatch: false,
    wants: 'Philosophy',
    city: 'Bangalore',
    status: 'available',
  },
  {
    id: '3',
    title: '1984',
    author: 'George Orwell',
    genre: 'Fiction',
    condition: 'fair',
    owner: { name: 'Marcus L.', rating: 4.7, exchanges: 31, avatar: 'ML' },
    distance: 5.1,
    isMutualMatch: true,
    wants: 'Mystery or Thriller',
    city: 'Bangalore',
    status: 'available',
  },
  {
    id: '4',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    genre: 'Non-Fiction',
    condition: 'like_new',
    owner: { name: 'Aisha T.', rating: 5.0, exchanges: 7, avatar: 'AT' },
    distance: 3.4,
    isMutualMatch: false,
    wants: 'Biography',
    city: 'Bangalore',
    status: 'available',
  },
  {
    id: '5',
    title: 'Ikigai',
    author: 'Héctor García',
    genre: 'Self-Help',
    condition: 'good',
    owner: { name: 'Sneha R.', rating: 4.6, exchanges: 47, avatar: 'SR' },
    distance: 1.2,
    isMutualMatch: true,
    wants: 'Atomic Habits',
    city: 'Mumbai',
    status: 'available',
  },
  {
    id: '6',
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Fantasy',
    condition: 'worn',
    owner: { name: 'Chen W.', rating: 4.3, exchanges: 12, avatar: 'CW' },
    distance: 7.8,
    isMutualMatch: false,
    wants: 'Sci-Fi',
    city: 'Delhi',
    status: 'available',
  },
];

export type MockEpub = {
  id: string;
  title: string;
  author: string;
  genre: string;
  cover?: string;
  downloads: number;
  uploadedBy: string;
  language: string;
  description: string;
};

export const MOCK_EPUBS: MockEpub[] = [
  {
    id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    genre: 'Fiction',
    downloads: 1234,
    uploadedBy: 'Arjun M.',
    language: 'English',
    description: 'A classic tale of the American Dream set in the Jazz Age.',
  },
  {
    id: '2',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    genre: 'Romance',
    downloads: 987,
    uploadedBy: 'Ms. Chen',
    language: 'English',
    description: "Austen's beloved story of love and social standing in 19th century England.",
  },
  {
    id: '3',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    genre: 'Philosophy',
    downloads: 743,
    uploadedBy: 'Ravi K.',
    language: 'English',
    description: 'Personal writings of the Roman Emperor, a masterpiece of Stoic philosophy.',
  },
  {
    id: '4',
    title: 'Moby Dick',
    author: 'Herman Melville',
    genre: 'Fiction',
    downloads: 621,
    uploadedBy: 'Marcus L.',
    language: 'English',
    description: 'The epic tale of Captain Ahab and his obsession with the white whale.',
  },
];

export const MOCK_EXCHANGES = [
  {
    id: 'E-2847',
    partner: 'Ravi K.',
    partnerAvatar: 'RK',
    myBook: 'The Alchemist',
    theirBook: 'Atomic Habits',
    status: 'meeting_scheduled',
    meeting: 'Café Coffee Day, MG Road',
    meetingDate: 'Saturday 11am',
    points: 150,
  },
  {
    id: 'E-2831',
    partner: 'Sneha R.',
    partnerAvatar: 'SR',
    myBook: '1984',
    theirBook: 'Ikigai',
    status: 'accepted',
    meeting: null,
    meetingDate: null,
    points: 150,
  },
  {
    id: 'E-2801',
    partner: 'Marcus L.',
    partnerAvatar: 'ML',
    myBook: 'Sapiens',
    theirBook: 'Dune',
    status: 'completed',
    meeting: 'Starbucks, Brigade Road',
    meetingDate: 'Last Monday',
    points: 150,
  },
];

export const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Arjun M.', city: 'Bangalore', points: 45230, tier: 'sage', avatar: 'AM', exchanges: 89, epubs: 34 },
  { rank: 2, name: 'Sneha R.', city: 'Mumbai', points: 38120, tier: 'scholar', avatar: 'SR', exchanges: 47, epubs: 22 },
  { rank: 3, name: 'Marcus L.', city: 'Delhi', points: 29450, tier: 'scholar', avatar: 'ML', exchanges: 31, epubs: 18 },
  { rank: 4, name: 'Ravi K.', city: 'Bangalore', points: 18920, tier: 'scholar', avatar: 'RK', exchanges: 23, epubs: 9 },
  { rank: 5, name: 'Ms. Chen', city: 'Delhi', points: 12340, tier: 'literati', avatar: 'MC', exchanges: 19, epubs: 41 },
  { rank: 6, name: 'Aisha T.', city: 'Chennai', points: 8750, tier: 'literati', avatar: 'AT', exchanges: 7, epubs: 15 },
  { rank: 7, name: 'Priya S.', city: 'Bangalore', points: 6230, tier: 'literati', avatar: 'PS', exchanges: 12, epubs: 3 },
  { rank: 198, name: 'You', city: 'Bangalore', points: 2620, tier: 'bibliophile', avatar: 'ME', exchanges: 8, epubs: 3, isCurrentUser: true },
];

export const MOCK_MESSAGES = [
  {
    id: '1',
    conversationId: 'conv-1',
    partner: 'Ravi K.',
    partnerAvatar: 'RK',
    lastMessage: "Perfect! Saturday 11am?",
    lastMessageAt: '2 min ago',
    unread: 0,
    exchangeId: 'E-2847',
    messages: [
      { id: 'm1', sender: 'them', content: "Hi! I'd love to exchange Atomic Habits for The Alchemist!", time: '10:30 AM' },
      { id: 'm2', sender: 'me', content: "Great! I'm in. When works for you?", time: '10:32 AM' },
      { id: 'm3', sender: 'them', content: "How about Café Coffee Day on MG Road?", time: '10:35 AM' },
      { id: 'm4', sender: 'me', content: "Perfect! Saturday 11am?", time: '10:36 AM' },
      { id: 'm5', sender: 'them', content: "Works for me!", time: '10:37 AM' },
    ],
  },
  {
    id: '2',
    conversationId: 'conv-2',
    partner: 'Sneha R.',
    partnerAvatar: 'SR',
    lastMessage: 'Looking forward to the exchange!',
    lastMessageAt: '1 hr ago',
    unread: 2,
    exchangeId: 'E-2831',
    messages: [
      { id: 'm1', sender: 'them', content: 'Hey! I saw you have 1984. I have Ikigai which you wanted!', time: '9:00 AM' },
      { id: 'm2', sender: 'me', content: "That's perfect! Mutual match", time: '9:05 AM' },
      { id: 'm3', sender: 'them', content: 'Looking forward to the exchange!', time: '9:10 AM' },
    ],
  },
];

export const POINTS_ACTIONS = [
  { action: 'Sign Up Bonus', points: 50, icon: 'gift' },
  { action: 'Complete Profile', points: 30, icon: 'check-circle' },
  { action: 'First Book Added', points: 25, icon: 'book' },
  { action: 'Each Book Added', points: 10, icon: 'book-plus' },
  { action: 'Exchange Completed', points: 150, icon: 'repeat' },
  { action: 'First Exchange of Month', points: 20, icon: 'award' },
  { action: 'EPUB Upload', points: 75, icon: 'file-up' },
  { action: 'EPUB Download (by others)', points: 5, icon: 'download' },
  { action: 'Leaving a Rating', points: 10, icon: 'star' },
  { action: 'Receiving 5-star Rating', points: 25, icon: 'star' },
  { action: '5 Consecutive Exchanges', points: 100, icon: 'flame' },
  { action: 'Referral Signup', points: 50, icon: 'users' },
];

export const TIERS = [
  { name: 'Bookworm', min: 0, max: 500, color: '#E8E8E2', textColor: '#0A3C30' },
  { name: 'Bibliophile', min: 501, max: 2000, color: '#3B82F6', textColor: '#fff' },
  { name: 'Literati', min: 2001, max: 5000, color: '#F59E0B', textColor: '#0A3C30' },
  { name: 'Scholar', min: 5001, max: 15000, color: '#EF4444', textColor: '#fff' },
  { name: 'Sage', min: 15001, max: Infinity, color: '#FF8C00', textColor: '#0A3C30' },
];

export const MOCK_NOTIFICATIONS = [
  { id: '1', type: 'exchange_request', title: 'New Exchange Request', body: 'Sneha R. wants to exchange Ikigai for your 1984', time: '5 min ago', read: false, icon: 'repeat' },
  { id: '2', type: 'points_earned', title: 'Points Earned!', body: 'You earned 150 points for completing an exchange', time: '2 hrs ago', read: false, icon: 'star' },
  { id: '3', type: 'new_message', title: 'New Message from Ravi K.', body: "Works for me!", time: '3 hrs ago', read: true, icon: 'message-circle' },
  { id: '4', type: 'match_found', title: 'Mutual Match Found!', body: 'Arjun has Dune and wants your Sapiens!', time: '1 day ago', read: true, icon: 'target' },
  { id: '5', type: 'epub_uploaded', title: 'New EPUB in Fantasy', body: 'A new EPUB matching your interests was uploaded', time: '2 days ago', read: true, icon: 'book' },
];
