import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

function userSessionsPath(userId) {
  return collection(db, 'users', userId, 'sessions');
}

function sessionRef(userId, sessionId) {
  return doc(db, 'users', userId, 'sessions', sessionId);
}

function responsesPath(userId, sessionId) {
  return collection(db, 'users', userId, 'sessions', sessionId, 'responses');
}

function notesRef(userId, sessionId) {
  return doc(db, 'users', userId, 'sessions', sessionId, 'data', 'notes');
}

export async function createSession(userId, userName, company) {
  const sessionDoc = doc(userSessionsPath(userId));
  const data = {
    userName,
    company: company || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(sessionDoc, data);
  return { id: sessionDoc.id, userName, company };
}

export async function getNotes(userId, sessionId) {
  const snap = await getDoc(notesRef(userId, sessionId));
  return snap.exists() ? snap.data() : { content: '' };
}

export async function saveNotes(userId, sessionId, content) {
  await setDoc(notesRef(userId, sessionId), {
    content,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveResponse(userId, sessionId, responseData) {
  const responseDoc = doc(responsesPath(userId, sessionId));
  const data = {
    ...responseData,
    createdAt: serverTimestamp(),
  };
  await setDoc(responseDoc, data);
  return { id: responseDoc.id, ...responseData };
}

export async function deleteResponse(userId, sessionId, responseId) {
  await deleteDoc(doc(responsesPath(userId, sessionId), responseId));
}

export async function clearResponses(userId, sessionId) {
  const snap = await getDocs(responsesPath(userId, sessionId));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export function subscribeToResponses(userId, sessionId, callback) {
  const q = query(responsesPath(userId, sessionId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
    }));
    callback(items);
  });
}

export async function updateSessionTimestamp(userId, sessionId) {
  await setDoc(sessionRef(userId, sessionId), { updatedAt: serverTimestamp() }, { merge: true });
}
