import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyBMMY-wjTyBNLmyO2_4WCuO9W2kQAwqJgY",
  authDomain: "co-bingo-game.firebaseapp.com",
  databaseURL: "https://co-bingo-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "co-bingo-game",
  messagingSenderId: "124442295475",
  appId: "1:124442295475:web:851e2fce5f7d782b3604c6"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
