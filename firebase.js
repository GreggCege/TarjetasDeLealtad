// ===================================
// FIREBASE CONFIGURATION & FIRESTORE
// ===================================

const firebaseConfig = {
    apiKey: "AIzaSyAhBG9EBb42gdq_-cldxWSxyi-5V6Msn0Q",
    authDomain: "tarjetas-de-lealtad-b4f87.firebaseapp.com",
    projectId: "tarjetas-de-lealtad-b4f87",
    storageBucket: "tarjetas-de-lealtad-b4f87.firebasestorage.app",
    messagingSenderId: "902131698303",
    appId: "1:902131698303:web:39af11a2fee8d4cb570d4a",
    measurementId: "G-G734X9VPN9"
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const db = firebase.firestore();
const auth = firebase.auth();

// ===================================
// FIRESTORE — STAMP CARD HELPERS
// ===================================

const CARD_DOC_REF = db.collection('cards').doc('default');

/**
 * Save stamps array to Firestore
 */
async function saveStampsToFirestore(stampsArray) {
    try {
        await CARD_DOC_REF.set({
            stamps: stampsArray,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error guardando sellos en Firestore:', error);
    }
}

/**
 * Load stamps from Firestore (one-time read)
 */
async function loadStampsFromFirestore(totalStamps) {
    try {
        const doc = await CARD_DOC_REF.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.stamps && Array.isArray(data.stamps) && data.stamps.length === totalStamps) {
                return data.stamps;
            }
        }
    } catch (error) {
        console.error('Error cargando sellos de Firestore:', error);
    }
    return new Array(totalStamps).fill(false);
}

/**
 * Listen for real-time changes on the stamp card.
 * Returns an unsubscribe function.
 */
function onStampsChange(totalStamps, callback) {
    return CARD_DOC_REF.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const stamps = (data.stamps && Array.isArray(data.stamps) && data.stamps.length === totalStamps)
                ? data.stamps
                : new Array(totalStamps).fill(false);
            callback(stamps, data);
        } else {
            callback(new Array(totalStamps).fill(false), {});
        }
    }, (error) => {
        console.error('Error escuchando cambios en Firestore:', error);
    });
}

/**
 * Save business name and card color settings to Firestore
 */
async function saveCardSettings(settings) {
    try {
        const updateData = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (settings.businessName !== undefined) updateData.businessName = settings.businessName;
        if (settings.cardColor !== undefined) updateData.cardColor = settings.cardColor;

        await CARD_DOC_REF.set(updateData, { merge: true });

        const currentUser = auth.currentUser;
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).set(updateData, { merge: true });
        }
    } catch (error) {
        console.error('Error guardando configuración de tarjeta en Firestore:', error);
        throw error;
    }
}

/**
 * Load card settings (businessName, cardColor)
 */
async function loadCardSettings() {
    try {
        const doc = await CARD_DOC_REF.get();
        if (doc.exists) {
            const data = doc.data();
            return {
                businessName: data.businessName || '',
                cardColor: data.cardColor || '#ff6f4a'
            };
        }
    } catch (error) {
        console.error('Error cargando ajustes de tarjeta:', error);
    }
    return {
        businessName: '',
        cardColor: '#ff6f4a'
    };
}

// ===================================
// FIRESTORE — USER PROFILE HELPERS
// ===================================

/**
 * Save user profile to Firestore
 */
async function saveUserProfile(uid, profileData) {
    try {
        await db.collection('users').doc(uid).set({
            ...profileData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error guardando perfil:', error);
        throw error;
    }
}

/**
 * Get user profile from Firestore
 */
async function getUserProfile(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
    return null;
}
