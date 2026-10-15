const { db, COLLECTIONS, admin } = require('../config/firebase');
const { normalizeThaiMobilePhone } = require('../utils/thaiMobilePhone');
const { createHash } = require('crypto');
const { normalizeEmailAddress } = require('../utils/emailAddress');

class RegistrationConflictError extends Error {
  constructor(field) {
    super(field === 'email'
      ? 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว'
      : 'เบอร์โทรศัพท์นี้ถูกใช้กับบัญชีอื่นแล้ว');
    this.name = 'RegistrationConflictError';
    this.field = field;
  }
}

async function saveUserWithUniquePhone(uid, phone, profile) {
  const normalizedPhone = normalizeThaiMobilePhone(phone);
  const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
  const phoneRegistry = db.collection('phone_registry');
  const matchingPhonesQuery = db.collection(COLLECTIONS.USERS)
    .where('phone', '==', normalizedPhone);
  const requestedEmail = Object.hasOwn(profile, 'email')
    ? normalizeEmailAddress(profile.email)
    : null;

  await db.runTransaction(async (transaction) => {
    const [phoneRegistrySnapshot, matchingPhoneUsers, userSnapshot] =
      await Promise.all([
        transaction.get(phoneRegistry.doc(normalizedPhone)),
        transaction.get(matchingPhonesQuery),
        transaction.get(userRef),
      ]);
    const previousEmail = userSnapshot.exists
      ? normalizeEmailAddress(String(userSnapshot.data().email || ''))
      : '';
    const normalizedEmail = requestedEmail === null
      ? previousEmail
      : requestedEmail;
    const emailRegistry = db.collection('email_registry');
    const emailRegistryId = normalizedEmail
      ? createHash('sha256').update(normalizedEmail).digest('hex')
      : null;
    const requestedEmailRegistryRef = emailRegistryId
      ? emailRegistry.doc(emailRegistryId)
      : null;
    const matchingEmailUsersQuery = normalizedEmail
      ? db.collection(COLLECTIONS.USERS).where('email', '==', normalizedEmail)
      : null;
    const previousEmailRegistryRef = previousEmail && previousEmail !== normalizedEmail
      ? emailRegistry.doc(createHash('sha256').update(previousEmail).digest('hex'))
      : null;
    const previousPhone = userSnapshot.exists
      ? normalizeThaiMobilePhone(String(userSnapshot.data().phone || ''))
      : '';
    const previousPhoneRegistryRef = previousPhone && previousPhone !== normalizedPhone
      ? phoneRegistry.doc(previousPhone)
      : null;
    const [
      emailRegistrySnapshot,
      matchingEmailUsers,
      previousEmailRegistrySnapshot,
      previousPhoneRegistrySnapshot,
    ] = await Promise.all([
      requestedEmailRegistryRef
        ? transaction.get(requestedEmailRegistryRef)
        : Promise.resolve(null),
      matchingEmailUsersQuery
        ? transaction.get(matchingEmailUsersQuery)
        : Promise.resolve(null),
      previousEmailRegistryRef
        ? transaction.get(previousEmailRegistryRef)
        : Promise.resolve(null),
      previousPhoneRegistryRef
        ? transaction.get(previousPhoneRegistryRef)
        : Promise.resolve(null),
    ]);

    if (
      (phoneRegistrySnapshot.exists && phoneRegistrySnapshot.data().uid !== uid) ||
      matchingPhoneUsers.docs.some((doc) => doc.id !== uid)
    ) {
      throw new RegistrationConflictError('phone');
    }
    if (
      (emailRegistrySnapshot?.exists && emailRegistrySnapshot.data().uid !== uid) ||
      matchingEmailUsers?.docs.some((doc) => doc.id !== uid)
    ) {
      throw new RegistrationConflictError('email');
    }

    transaction.set(phoneRegistry.doc(normalizedPhone), {
      uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(userRef, {
      ...profile,
      uid,
      phone: normalizedPhone,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (normalizedEmail) {
      transaction.set(requestedEmailRegistryRef, {
        uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (
      previousEmailRegistrySnapshot?.exists &&
      previousEmailRegistrySnapshot.data().uid === uid
    ) {
      transaction.delete(previousEmailRegistryRef);
    }
    if (
      previousPhoneRegistrySnapshot?.exists &&
      previousPhoneRegistrySnapshot.data().uid === uid
    ) {
      transaction.delete(previousPhoneRegistryRef);
    }
  });
}

module.exports = { RegistrationConflictError, saveUserWithUniquePhone };
