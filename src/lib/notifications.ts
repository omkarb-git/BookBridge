import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'request' | 'approval' | 'proposal' | 'message' | 'system';

export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationType = 'system',
  icon: string = 'bell'
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      type,
      icon,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
