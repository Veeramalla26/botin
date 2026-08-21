import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
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

function draftRef(userId, sessionId) {
  return doc(db, 'users', userId, 'sessions', sessionId, 'data', 'draft');
}

function uiStateRef(userId, sessionId) {
  return doc(db, 'users', userId, 'sessions', sessionId, 'data', 'uiState');
}

function activeSessionRef(userId) {
  return doc(db, 'users', userId, 'profile', 'active');
}

function mapSessionDoc(sessionId, data) {
  return {
    id: sessionId,
    userName: data.userName,
    company: data.company,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

export async function setActiveSession(userId, sessionId) {
  await setDoc(activeSessionRef(userId), {
    sessionId,
    updatedAt: serverTimestamp(),
  });
}

export async function getSession(userId, sessionId) {
  const snap = await getDoc(sessionRef(userId, sessionId));
  if (!snap.exists()) return null;
  return mapSessionDoc(snap.id, snap.data());
}

export async function getActiveSession(userId) {
  const snap = await getDoc(activeSessionRef(userId));
  if (!snap.exists() || !snap.data().sessionId) return null;
  return getSession(userId, snap.data().sessionId);
}

export function subscribeToActiveSession(userId, callback) {
  return onSnapshot(activeSessionRef(userId), async (snap) => {
    if (!snap.exists() || !snap.data().sessionId) {
      callback(null);
      return;
    }
    const session = await getSession(userId, snap.data().sessionId);
    callback(session);
  });
}

export async function getMostRecentSession(userId) {
  const q = query(userSessionsPath(userId), orderBy('updatedAt', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return mapSessionDoc(docSnap.id, docSnap.data());
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
  await setActiveSession(userId, sessionDoc.id);
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

export function subscribeToNotes(userId, sessionId, callback) {
  return onSnapshot(notesRef(userId, sessionId), (snap) => {
    callback(snap.exists() ? snap.data() : { content: '' });
  });
}

export async function saveDraft(userId, sessionId, draft) {
  await setDoc(draftRef(userId, sessionId), {
    ...draft,
    updatedAt: serverTimestamp(),
  });
}

export async function clearDraft(userId, sessionId) {
  try {
    await deleteDoc(draftRef(userId, sessionId));
  } catch {
    /* draft may not exist */
  }
}

export function subscribeToDraft(userId, sessionId, callback) {
  return onSnapshot(draftRef(userId, sessionId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function saveUiState(userId, sessionId, state) {
  await setDoc(uiStateRef(userId, sessionId), {
    ...state,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeToUiState(userId, sessionId, callback) {
  return onSnapshot(uiStateRef(userId, sessionId), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
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
