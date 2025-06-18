// api/send-reminders.js
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK using the credentials from Vercel's environment variables
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) {
  console.error("Firebase admin initialization error", e.stack);
}

// This is the main function that Vercel will run on a schedule
module.exports = async (req, res) => {
  // Check for the secret cron key to ensure only Vercel can run this
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  const db = admin.firestore();
  const messaging = admin.messaging();

  // Calculate the time window for "tomorrow"
  const now = new Date();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  try {
    // 1. Find all bookings happening tomorrow
    const bookingsSnapshot = await db
      .collection("bookings")
      .where("bookingTimestamp", ">=", tomorrowStart)
      .where("bookingTimestamp", "<", tomorrowEnd)
      .get();

    if (bookingsSnapshot.empty) {
      return res.status(200).send("No bookings for tomorrow.");
    }

    // 2. Create a list of notifications to send
    const notificationPromises = bookingsSnapshot.docs.map(async (doc) => {
      const booking = doc.data();
      const userId = booking.userId;

      // 3. Find the user's device tokens
      const tokensSnapshot = await db.collection("users").doc(userId).collection("tokens").get();
      if (tokensSnapshot.empty) return;

      const tokens = tokensSnapshot.docs.map((tokenDoc) => tokenDoc.id);

      // 4. Create the notification message
      const message = {
        notification: {
          title: "Your Adventure Awaits! ⛰️",
          body: `Your trip to ${booking.attractionName} is tomorrow. Get ready!`,
        },
        tokens: tokens,
      };

      // 5. Send the message to all of the user's devices
      return messaging.sendEachForMulticast(message);
    });

    await Promise.all(notificationPromises);
    res.status(200).send(`Sent reminders for ${bookingsSnapshot.size} bookings.`);
  } catch (error) {
    console.error("Error sending notifications:", error);
    res.status(500).send("Error sending notifications.");
  }
};