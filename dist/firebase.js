"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import the functions you need from the SDKs you need
const app_1 = require("firebase/app");
const analytics_1 = require("firebase/analytics");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAh979-5hdlqGb0PIcj7yNL_1C2aTZku6U",
    authDomain: "database-936c1.firebaseapp.com",
    projectId: "database-936c1",
    storageBucket: "database-936c1.firebasestorage.app",
    messagingSenderId: "530847976011",
    appId: "1:530847976011:web:52065ab5a1d46aec311bce",
    measurementId: "G-MV366TJX1P"
};
// Initialize Firebase
const app = (0, app_1.initializeApp)(firebaseConfig);
const analytics = (0, analytics_1.getAnalytics)(app);
