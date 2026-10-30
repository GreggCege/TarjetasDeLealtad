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
// FIRESTORE — MULTI-CLIENT STAMP CARDS
// ===================================

/**
 * Save stamps array for a specific card document
 */
async function saveCardStamps(cardId, stampsArray) {
    if (!cardId) {
        console.error('saveCardStamps: Falta cardId');
        return;
    }
    try {
        await db.collection('cards').doc(cardId).set({
            stamps: stampsArray,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error guardando sellos de la tarjeta:', error);
        throw error;
    }
}

/**
 * Listen for all cards created by a specific seller
 */
function subscribeToSellerCards(sellerId, callback) {
    if (!sellerId) return () => {};
    return db.collection('cards')
        .where('sellerId', '==', sellerId)
        .onSnapshot((snapshot) => {
            const cards = [];
            snapshot.forEach(doc => {
                cards.push({ id: doc.id, ...doc.data() });
            });
            callback(cards);
        }, (error) => {
            console.error('Error escuchando tarjetas del vendedor:', error);
        });
}

/**
 * Listen for all cards belonging to a specific client email
 */
function subscribeToClientCards(clientEmail, callback) {
    if (!clientEmail) return () => {};
    const cleanEmail = clientEmail.toLowerCase().trim();
    return db.collection('cards')
        .where('clientEmail', '==', cleanEmail)
        .onSnapshot((snapshot) => {
            const cards = [];
            snapshot.forEach(doc => {
                cards.push({ id: doc.id, ...doc.data() });
            });
            callback(cards);
        }, (error) => {
            console.error('Error escuchando tarjetas del cliente:', error);
        });
}

/**
 * Add a client card for a seller
 */
async function addClientCard({ sellerId, sellerName, businessName, cardColor, totalStamps, rewards, clientEmail, clientName }) {
    if (!sellerId || !clientEmail) {
        throw new Error('sellerId y clientEmail son requeridos');
    }
    const cleanEmail = clientEmail.toLowerCase().trim();
    const cardTotalStamps = totalStamps || 10;
    const cardRewards = rewards || [{ stamps: cardTotalStamps, description: 'Premio especial' }];

    try {
        // 1. Check if this seller already created a card for this client email
        const existingSnap = await db.collection('cards')
            .where('sellerId', '==', sellerId)
            .where('clientEmail', '==', cleanEmail)
            .get();

        if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            return {
                success: false,
                code: 'ALREADY_EXISTS',
                message: 'Ya existe una tarjeta para este cliente en tu panel',
                card: { id: existingDoc.id, ...existingDoc.data() }
            };
        }

        // 2. Check if client has a registered user account
        let clientId = null;
        let finalClientName = clientName ? clientName.trim() : '';

        try {
            const userSnap = await db.collection('users')
                .where('email', '==', cleanEmail)
                .get();

            if (!userSnap.empty) {
                const clientUserData = userSnap.docs[0].data();
                clientId = userSnap.docs[0].id;
                if (!finalClientName && clientUserData.name) {
                    finalClientName = clientUserData.name;
                }
            }
        } catch (searchErr) {
            console.warn('Búsqueda de usuario por correo no disponible:', searchErr);
        }

        if (!finalClientName) {
            finalClientName = cleanEmail.split('@')[0];
        }

        // 3. Create card document
        const newCardRef = db.collection('cards').doc();
        const cardData = {
            sellerId: sellerId,
            sellerName: sellerName || 'Vendedor',
            businessName: businessName || 'Mi Negocio',
            cardColor: cardColor || '#ff6f4a',
            totalStamps: cardTotalStamps,
            rewards: cardRewards,
            clientId: clientId,
            clientEmail: cleanEmail,
            clientName: finalClientName,
            stamps: new Array(cardTotalStamps).fill(false),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await newCardRef.set(cardData);

        return {
            success: true,
            card: { id: newCardRef.id, ...cardData }
        };

    } catch (error) {
        console.error('Error agregando cliente al panel:', error);
        throw error;
    }
}

/**
 * Delete a client card
 */
async function deleteClientCard(cardId) {
    if (!cardId) return;
    try {
        await db.collection('cards').doc(cardId).delete();
    } catch (error) {
        console.error('Error eliminando tarjeta de cliente:', error);
        throw error;
    }
}

/**
 * Reset client stamps
 */
async function resetClientCard(cardId) {
    if (!cardId) return;
    try {
        await db.collection('cards').doc(cardId).set({
            stamps: new Array(10).fill(false),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error reiniciando sellos:', error);
        throw error;
    }
}

/**
 * Save business name and card color settings to Firestore
 * Updates seller profile and all active client cards for this seller
 */
async function saveCardSettings(settings) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const updateData = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (settings.businessName !== undefined) updateData.businessName = settings.businessName;
        if (settings.cardColor !== undefined) updateData.cardColor = settings.cardColor;

        // Update seller profile
        await db.collection('users').doc(currentUser.uid).set(updateData, { merge: true });

        // Update all cards belonging to this seller
        const cardsSnap = await db.collection('cards')
            .where('sellerId', '==', currentUser.uid)
            .get();

        if (!cardsSnap.empty) {
            const batch = db.batch();
            cardsSnap.forEach(doc => {
                batch.set(doc.ref, {
                    businessName: settings.businessName || '',
                    cardColor: settings.cardColor || '#ff6f4a',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error('Error guardando configuración de vendedor:', error);
        throw error;
    }
}

/**
 * Save reward settings (totalStamps + rewards list) to seller profile
 * and propagate totalStamps to all existing client cards
 */
async function saveRewardSettings(settings) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const { totalStamps, rewards } = settings;

        // Update seller profile
        await db.collection('users').doc(currentUser.uid).set({
            totalStamps: totalStamps,
            rewards: rewards,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Propagate to all client cards (resize stamps array if needed)
        const cardsSnap = await db.collection('cards')
            .where('sellerId', '==', currentUser.uid)
            .get();

        if (!cardsSnap.empty) {
            const batch = db.batch();
            cardsSnap.forEach(doc => {
                const cardData = doc.data();
                const oldStamps = cardData.stamps || [];
                // Resize stamps array preserving existing stamps
                const newStamps = Array.from({ length: totalStamps }, (_, i) => !!oldStamps[i]);
                batch.set(doc.ref, {
                    totalStamps: totalStamps,
                    rewards: rewards,
                    stamps: newStamps,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error('Error guardando configuración de premios:', error);
        throw error;
    }
}

/**
 * Load reward settings for the current seller
 */
async function loadRewardSettings() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                return {
                    totalStamps: data.totalStamps || 10,
                    rewards: data.rewards || [{ stamps: data.totalStamps || 10, description: 'Premio especial' }]
                };
            }
        }
    } catch (error) {
        console.error('Error cargando configuración de premios:', error);
    }
    return {
        totalStamps: 10,
        rewards: [{ stamps: 10, description: 'Premio especial' }]
    };
}

/**
 * Load card settings (businessName, cardColor) for current seller
 */
async function loadCardSettings() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                return {
                    businessName: data.businessName || '',
                    cardColor: data.cardColor || '#ff6f4a'
                };
            }
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
