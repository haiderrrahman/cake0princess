const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cake-publisher-app.firebaseapp.com",
  projectId: "cake-publisher-app",
  storageBucket: "cake-publisher-app.firebasestorage.app",
  messagingSenderId: "112876760850",
  appId: "1:112876760850:web:d5144e5abf764372408dcb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const youtubeVideos = [
  { id: 'PFY5ui_Arac', title: 'أساسيات الكيك الإسفنجي', time: '12:45', free: true },
  { id: '7_Z6J_kB2P0', title: 'تغليف الكيك بالكريمة', time: '15:20', free: false },
  { id: 'zbqglqhae40', title: 'عمل الورود بالكريمة', time: '08:30', free: false },
  { id: 'ZEul9uwzKDs', title: 'حشوات الكيك المميزة', time: '11:15', free: false },
  { id: '7c7qxzcX0R0', title: 'تزيين كيك المناسبات', time: '18:50', free: false }
];

async function updateCourses() {
  const coursesSnapshot = await getDocs(collection(db, 'courses'));
  for (const document of coursesSnapshot.docs) {
    const course = document.data();
    
    const curriculum = youtubeVideos.map(v => ({
      title: v.title,
      time: v.time,
      type: 'video',
      free: v.free,
      videoId: v.id
    }));

    await updateDoc(doc(db, 'courses', document.id), {
      curriculum,
      youtubeLink: "https://www.youtube.com/@Cake.Princess"
    });
    console.log(`Updated course: ${document.id} - ${course.title}`);
  }
  console.log("All courses updated with YouTube videos.");
  process.exit(0);
}

updateCourses();
