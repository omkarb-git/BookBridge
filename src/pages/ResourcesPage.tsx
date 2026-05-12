import React from 'react';
import { BookOpen, HelpCircle, Shield, FileText, Code, ArrowLeft } from 'lucide-react';

interface ResourcesPageProps {
  type: string;
  onBack: () => void;
}

interface ResourceItem {
  title: string;
  desc: string;
  details: string;
}

const CONTENT_MAP: Record<string, { title: string; icon: any; content: string; items: ResourceItem[] }> = {
  'blog': {
    title: 'The Reader\'s Blog',
    icon: BookOpen,
    content: 'Discover deep dives into literature, community stories, and the future of sustainable reading.',
    items: [
      { 
        title: 'Top 10 Hidden Gems in Our Library', 
        desc: 'Uncovering the most underrated physical books currently available for swap.',
        details: 'From 1950s first editions to modern indie poetry, our community has listed some truly rare finds. This week, we highlight a signed copy of "The Alchemist" and a rare architectural digest found in Mumbai.'
      },
      { 
        title: 'How to Host a Local Book Swap', 
        desc: 'A step-by-step guide to organizing a physical meetup in your neighborhood.',
        details: 'Start by choosing a public place—a park or a cafe. Use the BookBridge "Meeting Tracker" to coordinate with up to 5 people at once. Bring a bag, a smile, and your most loved books.'
      },
      { 
        title: 'The Psychology of Physical Books', 
        desc: 'Why the smell and feel of paper enhances our retention and emotional connection.',
        details: 'Studies show that physical tactile interaction with paper triggers deeper spatial memory. When you flip a page, your brain maps the information to a physical location, making it harder to forget.'
      },
      { 
        title: 'Sustainable Reading', 
        desc: 'Why second-hand book swapping is the most eco-friendly way to read.',
        details: 'The carbon footprint of a new book is roughly 7.5kg of CO2. By swapping, you extend the life of a book indefinitely, reducing the need for new paper production and high-intensity shipping.'
      }
    ]
  },
  'help-center': {
    title: 'Help Center',
    icon: HelpCircle,
    content: 'Everything you need to know about swapping, listing, and reading on BookBridge.',
    items: [
      { 
        title: 'Getting Started Guide', 
        desc: 'New here? Learn how to list your first book and find a match in minutes.',
        details: '1. Tap the "+" icon. 2. Scan or type the ISBN. 3. Set your location. 4. Wait for a "Match" notification. Once matched, you can chat directly with the other reader.'
      },
      { 
        title: 'Safety and Meeting Up', 
        desc: 'Essential tips for a safe and pleasant physical exchange experience.',
        details: 'Always meet in public, well-lit areas. Tell a friend where you are going. Use the in-app map to find "Safe Zones"—partnered cafes and community centers.'
      },
      { 
        title: 'Troubleshooting EPUB Reader', 
        desc: 'Fixing common issues with digital library access and font rendering.',
        details: 'If a book fails to load, ensure your file is a standard .epub format. Clear your browser cache or try re-uploading the file to your private vault.'
      },
      { 
        title: 'Managing Exchange Requests', 
        desc: 'Understanding the lifecycle of an exchange: Pending, Accepted, and Completed.',
        details: 'When you receive a request, you have 48 hours to accept. Once accepted, the book is marked as "In Negotiation" and hidden from other search results.'
      }
    ]
  },
  'privacy': {
    title: 'Privacy Policy',
    icon: Shield,
    content: 'Your data is yours. We believe in total transparency and zero tracking.',
    items: [
      { 
        title: 'How We Use Location Data', 
        desc: 'Your precise location is never shared without explicit permission.',
        details: 'We use coarse location (city level) for discovery and precise location only during active "Meeting" mode to help you find the exchange partner.'
      },
      { 
        title: 'Securing Your Communications', 
        desc: 'Our messaging system uses industry-standard encryption.',
        details: 'Your chats are stored securely in Firestore and are only accessible to the participants of the conversation. We never sell your chat data to third parties.'
      },
      { 
        title: 'Your Rights Under GDPR', 
        desc: 'You have the right to download or delete your entire data profile.',
        details: 'Head to Settings > Data Privacy to request a full export of your account data or to permanently delete your account and all associated listings.'
      },
      { 
        title: 'Cookie Policy', 
        desc: 'We use zero tracking or advertising cookies.',
        details: 'We only use "Essential Session Cookies" to keep you logged in. No Google Analytics, no Facebook Pixels, no third-party marketing trackers.'
      }
    ]
  },
  'terms': {
    title: 'Terms of Service',
    icon: FileText,
    content: 'The simple rules that keep our community safe and fair for everyone.',
    items: [
      { 
        title: 'Fair Play in Exchanges', 
        desc: 'The Golden Rule: Give what you take.',
        details: 'BookBridge is a non-monetary platform. Selling books discovered here is strictly prohibited and will result in a permanent ban.'
      },
      { 
        title: 'Community Conduct Guidelines', 
        desc: 'Respect, kindness, and punctuality are our core values.',
        details: 'Be respectful in chats. If you cannot make it to a meeting, give at least 2 hours notice. Harassment of any kind is never tolerated.'
      },
      { 
        title: 'Listing Ownership', 
        desc: 'Only list books that you physically possess and have the right to swap.',
        details: 'You are responsible for the accuracy of your listings. Do not use stock photos if the book has significant wear or damage.'
      },
      { 
        title: 'Dispute Resolution Process', 
        desc: 'How we handle disagreements between readers.',
        details: 'If an exchange goes wrong, use the "Report" button in the chat. Our community moderators will review the case within 24 hours.'
      }
    ]
  },
  'api-docs': {
    title: 'Developer API',
    icon: Code,
    content: 'Build on top of the world\'s largest open book exchange network.',
    items: [
      { 
        title: 'Authentication', 
        desc: 'How to obtain and use your API Bearer tokens.',
        details: 'Generate an API Key in the Developer Dashboard. All requests must include an Authorization header: `Bearer YOUR_API_KEY`.'
      },
      { 
        title: 'Fetching Public Book Data', 
        desc: 'Retrieve metadata and availability for millions of shared books.',
        details: 'Endpoint: `GET /v1/books`. Use query parameters like `city`, `genre`, and `isAvailable` to filter results efficiently.'
      },
      { 
        title: 'Webhooks for Events', 
        desc: 'Get real-time notifications for exchange status changes.',
        details: 'Configure your webhook URL in settings. We will send a POST request for events like `exchange.created` and `exchange.completed`.'
      },
      { 
        title: 'Rate Limits', 
        desc: 'Guidelines for responsible use of the BookBridge infrastructure.',
        details: 'Standard accounts are limited to 1,000 requests per hour. If you need higher throughput for non-profit research, please contact our API team.'
      }
    ]
  }
};

export default function ResourcesPage({ type, onBack }: ResourcesPageProps) {
  const resource = CONTENT_MAP[type] || CONTENT_MAP['help-center'];
  const [activeItem, setActiveItem] = React.useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] py-20 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="nm-flat w-12 h-12 flex items-center justify-center rounded-2xl hover:nm-inset transition-all"
          >
            <ArrowLeft size={20} className="text-[var(--c-emerald)]" />
          </button>
          <div className="text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em]">Resource Section</div>
        </div>

        {/* Content Block */}
        <div className="nm-flat p-12 md:p-20 rounded-[4rem] space-y-10">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="w-24 h-24 nm-inset flex items-center justify-center rounded-[2rem] text-[var(--c-emerald)]">
              <resource.icon size={40} />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl font-black text-[var(--c-ink)] tracking-tighter uppercase leading-none">
                {resource.title}
              </h1>
              <p className="text-lg font-medium text-[var(--c-ink)] opacity-80 max-w-xl">
                {resource.content}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 pt-10 border-t border-[var(--c-ink)] border-opacity-5">
            {resource.items.map((item, i) => (
              <div 
                key={i} 
                onClick={() => setActiveItem(activeItem === i ? null : i)}
                className={`nm-flat p-8 rounded-3xl group transition-all cursor-pointer ${activeItem === i ? 'nm-inset scale-[0.98]' : 'hover:scale-[1.02]'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-8 h-8 nm-inset flex items-center justify-center rounded-xl text-[var(--c-emerald)] transition-all text-xs font-black ${activeItem === i ? 'nm-flat rotate-180' : ''}`}>
                    {activeItem === i ? '-' : `0${i + 1}`}
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeItem === i ? 'text-[var(--c-emerald-deep)] opacity-100' : 'opacity-20'}`}>
                    {activeItem === i ? 'Reading Now' : 'Click to Read'}
                  </div>
                </div>
                <h3 className={`font-extrabold text-lg transition-colors mb-3 ${activeItem === i ? 'text-[var(--c-emerald-deep)]' : 'text-[var(--c-ink)] group-hover:text-[var(--c-emerald-deep)]'}`}>
                  {item.title}
                </h3>
                <p className={`text-sm font-medium transition-all ${activeItem === i ? 'text-[var(--c-ink)]' : 'text-[var(--c-ink)] opacity-80'}`}>
                  {activeItem === i ? item.details : item.desc}
                </p>
                {activeItem === i && (
                   <div className="mt-6 pt-6 border-t border-[var(--c-ink)] border-opacity-5 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--c-emerald)] animate-pulse" />
                      <span className="text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-widest">End of Article</span>
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support CTA */}
        <div className="nm-inset p-10 rounded-[3rem] text-center space-y-4">
          <p className="text-sm font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-widest">
            Need more specific help?
          </p>
          <button className="text-[var(--c-emerald)] font-black uppercase text-xs tracking-widest hover:underline">
            Contact Support Team
          </button>
        </div>
      </div>
    </div>
  );
}
