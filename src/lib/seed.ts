import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { MOCK_BOOKS, MOCK_EXCHANGES, MOCK_MESSAGES, MOCK_NOTIFICATIONS } from '../data/mockData';

export const seedDatabase = async () => {
  try {
    const batch = writeBatch(db);

    // Seed Books
    MOCK_BOOKS.forEach((book) => {
      const docRef = doc(collection(db, 'books'), book.id);
      batch.set(docRef, book);
    });

    // Seed Exchanges
    MOCK_EXCHANGES.forEach((exchange) => {
      const docRef = doc(collection(db, 'exchanges'), exchange.id);
      batch.set(docRef, exchange);
    });

    // Seed Messages
    MOCK_MESSAGES.forEach((conv) => {
      const docRef = doc(collection(db, 'conversations'), conv.id);
      batch.set(docRef, conv);
    });

    // Seed Notifications
    MOCK_NOTIFICATIONS.forEach((notification) => {
      const docRef = doc(collection(db, 'notifications'), notification.id);
      batch.set(docRef, notification);
    });

    await batch.commit();
    console.log('Database seeded successfully!');
    alert('Database seeded successfully! You can now remove mockData.');
  } catch (error) {
    console.error('Error seeding database:', error);
    alert('Error seeding database. Check console.');
  }
};
