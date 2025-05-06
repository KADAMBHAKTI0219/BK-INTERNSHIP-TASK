import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../../../../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

export async function POST(req) {
  const { userId } = await req.json();

  if (!userId) {
    return new Response(JSON.stringify({ message: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const visaApplicationsRef = db.collection('users').doc(userId).collection('visaApplications');

    // Clear existing applications (optional)
    const querySnapshot = await visaApplicationsRef.get();
    for (const doc of querySnapshot.docs) {
      await doc.ref.delete();
    }

    // Dummy visa application data
    const dummyApplications = [
      {
        "referenceNumber": "VISA-2025-100001",
        "status": "Issued",
        "applicationDate": "2025-04-01T10:00:00Z",
        "validityStart": "2025-04-10T00:00:00Z",
        "validityEnd": "2025-10-10T00:00:00Z",
        "visaType": "Tourist",
        "destination": "USA",
        "issuanceDetails": "Processed by the US embassy in 7 days. Visa stamped in passport and delivered via courier.",
        "additionalInfo": "Visa approved and issued."
      },
      {
  "referenceNumber": "VISA-2025-100002",
  "status": "In Review",
  "applicationDate": "2025-05-01T12:00:00Z",
  "validityStart": null,
  "validityEnd": null,
  "visaType": "Student",
  "destination": "Canada",
  "issuanceDetails": null,
  "additionalInfo": "Documents verified. Awaiting consular review."
},
{
  "referenceNumber": "VISA-2025-100003",
  "status": "Rejected",
  "applicationDate": "2025-05-03T09:00:00Z",
  "validityStart": null,
  "validityEnd": null,
  "visaType": "Work",
  "destination": "UK",
  "issuanceDetails": null,
  "additionalInfo": "Application rejected due to incomplete documentation."
}
    ];

    // Add dummy applications to Firestore
    for (const app of dummyApplications) {
      await visaApplicationsRef.add(app);
    }

    return new Response(JSON.stringify({ message: `Successfully populated ${dummyApplications.length} dummy visa applications for user ${userId}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error populating dummy visa applications:', error);
    return new Response(JSON.stringify({ message: 'Error populating dummy visa applications', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}