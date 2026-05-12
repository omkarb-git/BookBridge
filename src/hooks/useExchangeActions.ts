import { useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Book {
  id: string;
  title: string;
  author: string;
  ownerId: string;
  ownerName: string;
  [key: string]: any;
}

interface UseExchangeActionsProps {
  currentUser: { uid: string; displayName?: string | null; email?: string | null } | null;
}

/** Generate a random 6-digit OTP */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function useExchangeActions({ currentUser }: UseExchangeActionsProps) {
  const [isSending, setIsSending] = useState(false);
  const [sentExchangeIds, setSentExchangeIds] = useState<Set<string>>(new Set());

  const getDisplayName = () => {
    return currentUser?.displayName || currentUser?.email?.split('@')[0] || 'A reader';
  };

  const getBookIdsForExchange = (exchange: any) =>
    [exchange.bookId, exchange.offeredBookId].filter(Boolean);

  const findConflictingPendingExchanges = async (exchange: any) => {
    const exchangeIds = getBookIdsForExchange(exchange);
    if (exchangeIds.length === 0) return [];

    const snap = await getDocs(collection(db, 'exchanges'));
    return snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((candidate: any) => {
        if (candidate.id === exchange.id) return false;
        if (candidate.status !== 'pending') return false;
        return exchangeIds.includes(candidate.bookId) || exchangeIds.includes(candidate.offeredBookId);
      });
  };

  /**
   * Send an exchange request for a specific book.
   * Creates an exchange document and a notification for the book owner — atomically.
   */
  const sendExchangeRequest = async (
    book: Book, 
    offeredBookId: string, 
    offeredBookTitle: string
  ): Promise<'success' | 'error' | 'already_sent'> => {
    if (!currentUser) return 'error';
    if (sentExchangeIds.has(book.id)) return 'already_sent';
    if (book.ownerId === currentUser.uid) return 'error'; // Can't exchange with yourself

    setIsSending(true);
    try {
      const batch = writeBatch(db);

      const requesterName = getDisplayName();

      // 1. Create the exchange document
      const exchangeRef = doc(collection(db, 'exchanges'));
      batch.set(exchangeRef, {
        status: 'pending',
        requesterId: currentUser.uid,
        requesterName,
        ownerId: book.ownerId,
        ownerName: book.ownerName,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        offeredBookId,
        offeredBookTitle,
        // participants array allows us to query exchanges for both users
        participants: [currentUser.uid, book.ownerId],
        // Legacy fields for compatibility with existing ExchangesPage
        partner: book.ownerName,
        myBook: offeredBookTitle,
        theirBook: book.title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Create a real-time notification for the book owner
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: book.ownerId,
        type: 'exchange_request',
        title: 'New Exchange Request!',
        body: `${requesterName} wants to exchange "${offeredBookTitle}" for your "${book.title}"`,
        exchangeId: exchangeRef.id,
        icon: 'repeat',
        read: false,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setSentExchangeIds((prev) => new Set([...prev, book.id]));
      return 'success';
    } catch (err) {
      console.error('Error sending exchange request:', err);
      return 'error';
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Accept an incoming exchange request.
   * Updates the exchange status and notifies the requester.
   */
  const acceptExchangeRequest = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    const conflictingExchanges = await findConflictingPendingExchanges(exchange);

    // Update exchange status
    batch.update(doc(db, 'exchanges', exchange.id), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    // 2. Mark the books as "exchanging" so they vanish from Discover/Home
    if (exchange.bookId) {
      batch.update(doc(db, 'books', exchange.bookId), {
        status: 'exchanging',
        updatedAt: serverTimestamp()
      });
    }
    if (exchange.offeredBookId) {
      batch.update(doc(db, 'books', exchange.offeredBookId), {
        status: 'exchanging',
        updatedAt: serverTimestamp()
      });
    }

    conflictingExchanges.forEach((candidate: any) => {
      batch.update(doc(db, 'exchanges', candidate.id), {
        status: 'cancelled',
        cancelledReason: 'Another exchange for one of these books was accepted.',
        updatedAt: serverTimestamp(),
      });

      const notifyIds = [candidate.requesterId, candidate.ownerId].filter((uid) => uid && uid !== currentUser.uid);
      notifyIds.forEach((uid) => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: uid,
          type: 'exchange_cancelled',
          title: 'Request Closed',
          body: 'This exchange request was closed because one of the books is no longer available.',
          exchangeId: candidate.id,
          icon: 'x',
          read: false,
          createdAt: serverTimestamp(),
        });
      });
    });

    // Notify the requester
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: exchange.requesterId,
      type: 'exchange_accepted',
      title: 'Request Accepted! 🎉',
      body: `${exchange.ownerName || 'The owner'} accepted your request for "${exchange.bookTitle}"`,
      exchangeId: exchange.id,
      icon: 'check',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  };

  /**
   * Reject an incoming exchange request.
   */
  const rejectExchangeRequest = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });

    // Notify the requester
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: exchange.requesterId,
      type: 'exchange_rejected',
      title: 'Exchange Request Declined',
      body: `Your request for "${exchange.bookTitle}" was not accepted this time.`,
      exchangeId: exchange.id,
      icon: 'x',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  };

  /**
   * Send a chat message within an exchange.
   */
  const sendMessage = async (exchangeId: string, text: string): Promise<void> => {
    if (!currentUser || !text.trim()) return;
    await addDoc(collection(db, 'messages'), {
      exchangeId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  };

  /**
   * Mark a notification as read.
   */
  const markNotificationRead = async (notifId: string): Promise<void> => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  };

  /**
   * Propose a meeting.
   */
  const proposeMeeting = async (exchange: any, location: string, time: string, coords: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      proposedMeeting: location,
      proposedMeetingTime: time,
      proposedMeetingCoords: coords,
      proposedBy: currentUser.uid,
      // If meeting was previously locked, clear lock so it needs re-approval
      ...(exchange.meetingLocked ? {
        meetingLocked: false,
        meeting: null,
        meetingCoords: null,
        meetingDate: null,
        status: 'accepted',
      } : {}),
      updatedAt: serverTimestamp(),
    });

    const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: partnerId,
      type: 'meeting_proposed',
      title: exchange.meetingLocked ? 'Meeting Rescheduled! 📅' : 'New Meeting Proposal!',
      body: `${getDisplayName()} proposed a meeting at ${location}`,
      exchangeId: exchange.id,
      icon: 'map-pin',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  };

  /**
   * Approve and lock a meeting location.
   */
  const approveMeeting = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    let meetingDateString = 'Date TBD';
    try {
      if (exchange.proposedMeetingTime) {
        const dateObj = new Date(exchange.proposedMeetingTime);
        if (!isNaN(dateObj.getTime())) {
          meetingDateString = dateObj.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        }
      }
    } catch (e) {
      console.error('Date parsing error:', e);
    }

    batch.update(doc(db, 'exchanges', exchange.id), {
      status: 'meeting_scheduled',
      meeting: exchange.proposedMeeting,
      meetingCoords: exchange.proposedMeetingCoords,
      meetingLocked: true,
      meetingDate: meetingDateString,
      proposedMeeting: null,
      proposedMeetingCoords: null,
      proposedMeetingTime: null,
      proposedBy: null,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    // Create notification separately so it doesn't block the core update if it fails
    try {
      const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
      await addDoc(collection(db, 'notifications'), {
        userId: partnerId,
        type: 'meeting_approved',
        title: 'Meeting Location Locked! 🔒',
        body: `${getDisplayName()} approved the meeting at ${exchange.proposedMeeting}. See you there!`,
        exchangeId: exchange.id,
        icon: 'check-circle',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Notification failed but update succeeded:', e);
    }
  };

  /**
   * Decline a meeting proposal.
   */
  const declineMeetingProposal = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      proposedMeeting: null,
      proposedMeetingTime: null,
      proposedMeetingCoords: null,
      proposedBy: null,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Create notification separately
    try {
      const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
      await addDoc(collection(db, 'notifications'), {
        userId: partnerId,
        type: 'meeting_declined',
        title: 'Meeting Proposal Declined',
        body: `${getDisplayName()} declined your meeting proposal. Please try another location.`,
        exchangeId: exchange.id,
        icon: 'x',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Notification failed but decline succeeded:', e);
    }
  };

  /**
   * Start live tracking - generates unique OTPs for each user.
   * Each user gets their own OTP that they share with the partner verbally.
   */
  const startTracking = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      status: 'in_transit',
      trackingStartedAt: serverTimestamp(),
      // Reset arrived + OTP state — OTPs generated only when both physically arrive
      arrived: {},
      otpCodes: {},
      otpsGenerated: false,
      updatedAt: serverTimestamp(),
    });

    const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: partnerId,
      type: 'tracking_started',
      title: 'Live Tracking Started! 🚀',
      body: `${getDisplayName()} is on the way! Open the exchange to track live.`,
      exchangeId: exchange.id,
      icon: 'navigation',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  };

  /**
   * Confirm arrival at meeting point.
   */
  const confirmArrival = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      [`arrived.${currentUser.uid}`]: true,
      updatedAt: serverTimestamp(),
    });

    const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: partnerId,
      type: 'partner_arrived',
      title: 'Partner Has Arrived! 📍',
      body: `${getDisplayName()} has arrived at the meeting point!`,
      exchangeId: exchange.id,
      icon: 'map-pin',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Check if BOTH users have now arrived — fetch fresh state
    const updatedDoc = await getDoc(doc(db, 'exchanges', exchange.id));
    if (!updatedDoc.exists()) return;
    const data = updatedDoc.data();

    const allArrived = data.arrived?.[data.requesterId] && data.arrived?.[data.ownerId];

    if (allArrived && !data.otpsGenerated) {
      // Both physically present — now generate OTPs
      const otp1 = generateOTP();
      const otp2 = generateOTP();

      await updateDoc(doc(db, 'exchanges', exchange.id), {
        otpCodes: {
          [data.requesterId]: otp1,
          [data.ownerId]: otp2,
        },
        otpsGenerated: true,
        otpVerified: {},
        updatedAt: serverTimestamp(),
      });

      // Notify both users that swap codes are ready
      const otpBatch = writeBatch(db);
      [data.requesterId, data.ownerId].forEach((uid) => {
        const nRef = doc(collection(db, 'notifications'));
        otpBatch.set(nRef, {
          userId: uid,
          type: 'otps_ready',
          title: 'Both Arrived! Swap Codes Ready 🔑',
          body: "Both of you are at the meeting point! Check your swap code and verify your partner's.",
          exchangeId: exchange.id,
          icon: 'key',
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await otpBatch.commit();
    }
  };

  /**
   * Verify OTP entered by user. Each user enters the OTP shown to the partner.
   * Returns true if verified, false if wrong.
   */
  const verifyOTP = async (exchange: any, enteredOTP: string): Promise<boolean> => {
    if (!currentUser) return false;

    // Get fresh exchange data
    const exchangeDoc = await getDoc(doc(db, 'exchanges', exchange.id));
    if (!exchangeDoc.exists()) return false;

    const data = exchangeDoc.data();
    const partnerId = currentUser.uid === data.requesterId ? data.ownerId : data.requesterId;
    
    // User enters the partner's OTP (the one the partner is showing them)
    const partnerOTP = data.otpCodes?.[partnerId];
    
    if (enteredOTP !== partnerOTP) return false;

    const batch = writeBatch(db);

    // Mark this user's OTP as verified
    batch.update(doc(db, 'exchanges', exchange.id), {
      [`otpVerified.${currentUser.uid}`]: true,
      updatedAt: serverTimestamp(),
    });

    // Notify partner
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: partnerId,
      type: 'otp_verified',
      title: 'OTP Verified! ✅',
      body: `${getDisplayName()} has verified the OTP.`,
      exchangeId: exchange.id,
      icon: 'check-circle',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Check if both have verified — if so, auto-complete
    const updatedDoc = await getDoc(doc(db, 'exchanges', exchange.id));
    if (updatedDoc.exists()) {
      const updated = updatedDoc.data();
      const allVerified = updated.otpVerified?.[updated.requesterId] && updated.otpVerified?.[updated.ownerId];
      const allArrived = updated.arrived?.[updated.requesterId] && updated.arrived?.[updated.ownerId];

      if (allVerified && allArrived) {
        await completeExchange(exchange);
      }
    }

    return true;
  };

  /**
   * Complete the exchange — called automatically when both users verify OTP.
   */
  const completeExchange = async (exchange: any): Promise<void> => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    const requesterDisplayName = exchange.requesterName || 'Reader';
    const ownerDisplayName = exchange.ownerName || 'Reader';

    batch.update(doc(db, 'exchanges', exchange.id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Mark books as exchanged
    if (exchange.bookId) {
      batch.update(doc(db, 'books', exchange.bookId), {
        ownerId: exchange.requesterId,
        ownerName: requesterDisplayName,
        status: 'exchanged',
        previousOwnerId: exchange.ownerId,
        previousOwnerName: ownerDisplayName,
        lastExchangeId: exchange.id,
        lastExchangedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    if (exchange.offeredBookId) {
      batch.update(doc(db, 'books', exchange.offeredBookId), {
        ownerId: exchange.ownerId,
        ownerName: ownerDisplayName,
        status: 'exchanged',
        previousOwnerId: exchange.requesterId,
        previousOwnerName: requesterDisplayName,
        lastExchangeId: exchange.id,
        lastExchangedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Update summary counters for both participants
    [exchange.requesterId, exchange.ownerId].forEach((uid) => {
      batch.update(doc(db, 'users', uid), {
        exchangesCompleted: increment(1),
        points: increment(100),
        updatedAt: serverTimestamp()
      });

      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: uid,
        type: 'exchange_completed',
        title: 'Exchange Complete! 🎉📚',
        body: `The exchange for "${exchange.bookTitle}" has been completed successfully!`,
        exchangeId: exchange.id,
        icon: 'check-circle',
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  };

  /**
   * Update exchange status (legacy, used for non-OTP flows).
   */
  const updateExchangeStatus = async (exchange: any, newStatus: string): Promise<void> => {
    if (!currentUser) return;

    // For in_transit, use startTracking instead
    if (newStatus === 'in_transit') {
      return startTracking(exchange);
    }

    const batch = writeBatch(db);

    batch.update(doc(db, 'exchanges', exchange.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    const partnerId = currentUser.uid === exchange.requesterId ? exchange.ownerId : exchange.requesterId;
    const statusLabel = newStatus === 'in_transit' ? 'is in transit!' : 'is complete!';
    
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      userId: partnerId,
      type: 'status_update',
      title: 'Exchange Status Updated',
      body: `The exchange for "${exchange.bookTitle}" ${statusLabel}`,
      exchangeId: exchange.id,
      icon: newStatus === 'completed' ? 'check-circle' : 'navigation',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  };

  return {
    sendExchangeRequest,
    acceptExchangeRequest,
    rejectExchangeRequest,
    sendMessage,
    markNotificationRead,
    proposeMeeting,
    approveMeeting,
    declineMeetingProposal,
    startTracking,
    confirmArrival,
    verifyOTP,
    completeExchange,
    updateExchangeStatus,
    isSending,
    sentExchangeIds,
  };
}
