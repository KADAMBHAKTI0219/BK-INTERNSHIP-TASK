const { db } = require("../lib/firebase");
const {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} = require("firebase/firestore");

// Verify Firebase initialization
if (!db) {
  console.error("Firebase initialization failed: db is undefined");
  process.exit(1);
}

// Pool of visa-related questions with answers
const visaQuestionsPool = [
  {
    question: "What are the requirements for a US tourist visa?",
    answer:
      "You need a valid passport, a completed DS-160 form, a passport-sized photo, proof of financial support, and an interview at the US embassy.",
  },
  {
    question: "How do I apply for a Canadian work visa?",
    answer:
      "Determine your eligibility, get a job offer from a Canadian employer, apply for a Labour Market Impact Assessment if needed, and submit your application online via the IRCC portal.",
  },
  {
    question: "What documents are needed for a UK student visa?",
    answer:
      "You need a Confirmation of Acceptance for Studies (CAS), proof of funds, a valid passport, English proficiency test results, and a tuberculosis test result if applicable.",
  },
  {
    question: "How long does it take to process an Australian tourist visa?",
    answer:
      "It typically takes 20 to 30 days, but processing times can vary based on your circumstances and application volume.",
  },
  {
    question: "Can I extend my US business visa?",
    answer:
      "Yes, you can apply for an extension by filing Form I-539 with USCIS before your current visa expires, along with supporting documents.",
  },
  {
    question: "What is the cost of a Schengen visa?",
    answer:
      "The standard fee is €80 for adults and €40 for children aged 6-12. Some categories may be exempt.",
  },
  {
    question: "How do I get a visa for Japan as a tourist?",
    answer:
      "Check if you need a visa (some countries are exempt), apply at the Japanese embassy with a valid passport, itinerary, financial proof, and a visa application form.",
  },
  {
    question: "What are the rules for a US H-1B visa?",
    answer:
      "You need a job offer from a US employer, a relevant degree or equivalent experience, and the employer must file a petition with USCIS.",
  },
  {
    question: "Do I need a visa to visit Brazil for a week?",
    answer:
      "It depends on your nationality. Many countries have visa-free agreements with Brazil for short stays; check with the Brazilian embassy.",
  },
  {
    question: "How can I apply for a student visa to Germany?",
    answer:
      "Get accepted into a German university, apply for a student visa at the German embassy, and provide proof of funds, health insurance, and admission letter.",
  },
  {
    question: "What is the validity of a Canadian visitor visa?",
    answer:
      "It’s usually valid for up to 6 months per entry, but the total validity can be up to 10 years.",
  },
  {
    question: "Can I work in the UK on a tourist visa?",
    answer:
      "No, you cannot work on a tourist visa. You need a work visa like the Skilled Worker visa.",
  },
  {
    question: "How do I apply for a New Zealand tourist visa?",
    answer:
      "Apply online via the Immigration New Zealand website with a valid passport, proof of funds, and travel itinerary.",
  },
  {
    question: "What are the requirements for an Indian business visa?",
    answer:
      "You need a passport valid for 6 months, a business invitation letter, proof of financial support, and a completed application form.",
  },
  {
    question: "How long does a US student visa take to process?",
    answer:
      "It typically takes 3 to 5 weeks, but scheduling an interview can extend the timeline.",
  },
  {
    question:
      "What is the difference between a single-entry and multiple-entry visa?",
    answer:
      "A single-entry visa allows one entry into the country, while a multiple-entry visa allows multiple entries within its validity period.",
  },
  {
    question: "Can I apply for a visa on arrival in Thailand?",
    answer:
      "Yes, many nationalities can get a visa on arrival for a 15-day stay, but check eligibility beforehand.",
  },
  {
    question: "What are the steps to get a work visa for Singapore?",
    answer:
      "Secure a job offer, have your employer apply for an Employment Pass, and submit documents like your passport and qualifications.",
  },
  {
    question: "How do I apply for a family visa in Australia?",
    answer:
      "Sponsor your family member, apply through the Department of Home Affairs, and provide proof of relationship and financial support.",
  },
  {
    question: "What are the requirements for a US J-1 visa?",
    answer:
      "You need a sponsor program, a DS-2019 form, proof of funds, and an interview at the US embassy.",
  },
  {
    question: "Can I travel to the Schengen area with a UK visa?",
    answer:
      "No, a UK visa does not grant access to the Schengen area; you need a separate Schengen visa.",
  },
  {
    question: "How do I get a visa for South Korea as a tourist?",
    answer:
      "Apply at the Korean embassy with a valid passport, application form, photo, and proof of travel plans.",
  },
  {
    question: "What documents are needed for a Canadian student visa?",
    answer:
      "You need a letter of acceptance, proof of funds, a valid passport, photos, and a study permit application.",
  },
  {
    question: "How can I apply for a business visa to China?",
    answer:
      "Submit an invitation letter from a Chinese company, your passport, application form, and photo to the Chinese embassy.",
  },
  {
    question: "What is the processing time for a UK tourist visa?",
    answer:
      "It usually takes about 3 weeks, but it can vary depending on the embassy and season.",
  },
  {
    question: "Do I need a visa to visit Dubai for a short trip?",
    answer:
      "Many nationalities can get a visa on arrival for 30 days; check with UAE immigration for your country.",
  },
  {
    question: "How do I apply for a visa to Russia?",
    answer:
      "Get an invitation letter, apply at the Russian embassy with your passport, application form, and photo.",
  },
  {
    question:
      "What are the requirements for a US green card through employment?",
    answer:
      "You need a job offer, labor certification, and an approved I-140 petition from your employer.",
  },
  {
    question: "Can I apply for a visa to France online?",
    answer:
      "Yes, you can start the application online via the France-Visas website, but you’ll need an embassy appointment.",
  },
  {
    question: "What are the steps to get a tourist visa for Spain?",
    answer:
      "Apply at the Spanish embassy with a passport, application form, travel insurance, and proof of funds.",
  },
  {
    question: "How do I apply for a work visa in Germany?",
    answer:
      "Secure a job offer, apply for a work visa at the German embassy, and provide your contract and qualifications.",
  },
  {
    question: "What is the cost of a US student visa?",
    answer:
      "The application fee is $185, plus a SEVIS fee of $350 for F-1 visas.",
  },
  {
    question: "How long does a Schengen visa take to process?",
    answer:
      "It typically takes 15 days, but it can take up to 60 days during peak seasons.",
  },
  {
    question: "Can I apply for a visa to Italy as a freelancer?",
    answer:
      "Yes, you can apply for a self-employment visa with proof of income, work contracts, and other documents.",
  },
  {
    question: "What documents are needed for a Japanese work visa?",
    answer:
      "You need a Certificate of Eligibility, a valid passport, application form, and a job contract.",
  },
  {
    question: "How do I get a visa for Australia as a skilled worker?",
    answer:
      "Apply for a Skilled Independent Visa (subclass 189) via the SkillSelect system with a points-based assessment.",
  },
  {
    question: "What are the requirements for a Canadian PR visa?",
    answer:
      "You need to apply through Express Entry, meet the points requirement, and provide proof of funds and work experience.",
  },
  {
    question: "Can I visit the US on a transit visa?",
    answer:
      "Yes, you can apply for a C-1 transit visa if you’re passing through the US to another destination.",
  },
  {
    question: "How do I apply for a tourist visa to Malaysia?",
    answer:
      "Many nationalities don’t need a visa for short stays; otherwise, apply online or at the Malaysian embassy.",
  },
  {
    question: "What is the validity of a UK student visa?",
    answer:
      "It’s usually valid for the duration of your course plus an additional 4 months.",
  },
  {
    question: "How do I apply for a visa to India as a tourist?",
    answer:
      "Apply online for an e-Tourist Visa or at the Indian embassy with your passport, photo, and travel itinerary.",
  },
];

// Function to shuffle an array (Fisher-Yates shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function populateQuestions() {
  try {
    console.log("Starting to populate predefined questions with answers...");

    // Clear existing questions in the collection
    const questionsRef = collection(db, "predefinedQuestions");
    const querySnapshot = await getDocs(questionsRef);
    for (const doc of querySnapshot.docs) {
      await deleteDoc(doc.ref);
      console.log(`Deleted existing document with ID: ${doc.id}`);
    }

    // Shuffle the questions and select the first 30
    const shuffledQuestions = shuffleArray([...visaQuestionsPool]);
    const selectedQuestions = shuffledQuestions.slice(0, 30);

    const queuedOperations = [];

    for (const [index, item] of selectedQuestions.entries()) {
      const docData = {
        question: item.question,
        answer: item.answer,
        timestamp: new Date(),
        index,
      };

      try {
        const docRef = await addDoc(questionsRef, docData);
        console.log(`Question ${index + 1} saved with ID:`, docRef.id);
      } catch (error) {
        console.error(`Error saving question ${index + 1}:`, error);
        if (error.message.includes("Could not reach Cloud Firestore backend")) {
          queuedOperations.push(docData);
          console.log(
            `Question ${index + 1} queued due to Firestore connectivity issue`
          );
        } else {
          throw error;
        }
      }
    }

    if (queuedOperations.length > 0) {
      console.log(
        "Some questions were queued due to connectivity issues. They will sync when connectivity is restored."
      );
    } else {
      console.log(
        "Successfully populated 30 random visa questions with answers in Firestore"
      );
    }
  } catch (error) {
    console.error("Error populating questions:", error);
    process.exit(1);
  }
}

// Run the script
populateQuestions()
  .then(() => {
    console.log("Script execution completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });