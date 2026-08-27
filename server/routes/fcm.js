const express = require('express');
const router = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

// POST /api/fcm/token - บันทึก FCM Token
router.post('/token', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.uid; 
    const platform = req.headers['user-agent'] || 'unknown';

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // บันทึก Token เป็น Document ID เพื่อป้องกันการซ้ำซ้อน
    await db.collection('fcm_tokens').doc(token).set({
      userId,
      token,
      platform,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: 'Token saved successfully' });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/fcm/token - ลบ FCM Token เมื่อล็อกเอาท์
router.delete('/token', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await db.collection('fcm_tokens').doc(token).delete();
    res.status(200).json({ success: true, message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ฟังก์ชันส่ง Push Notification ไปยังผู้ใช้งาน
const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const tokensSnapshot = await db.collection('fcm_tokens').where('userId', '==', userId).get();
    
    if (tokensSnapshot.empty) {
      console.log(`No FCM tokens found for user ${userId}`);
      return;
    }

    const promises = [];
    tokensSnapshot.forEach(doc => {
      const tokenDoc = doc.data();
      const message = {
        token: tokenDoc.token,
        notification: {
          title,
          body
        },
        data
      };

      promises.push(
        admin.messaging().send(message).catch(async (error) => {
          // หาก token ไม่สามารถใช้งานได้แล้วให้ลบออกจากระบบ
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            console.log(`Deleting invalid token: ${tokenDoc.token}`);
            await db.collection('fcm_tokens').doc(tokenDoc.token).delete();
          } else {
            console.error('Error sending push notification:', error);
          }
        })
      );
    });

    await Promise.all(promises);
    console.log(`Push notifications sent to user ${userId}`);
  } catch (error) {
    console.error('Error in sendPushToUser:', error);
  }
};

module.exports = router;
module.exports.sendPushToUser = sendPushToUser;
