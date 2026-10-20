// ===================================
// AUTH — Register, Login, Logout
// ===================================

let currentUserProfile = null;
let isRegistering = false;

// ===================================
// AUTH STATE OBSERVER
// ===================================

auth.onAuthStateChanged(async (user) => {
    hideAuthError();

    if (user) {
        // If registration is currently in progress, let handleRegister complete the process
        if (isRegistering) {
            return;
        }

        // Load profile from Firestore
        let profile = await getUserProfile(user.uid);

        // If not found immediately, wait 500ms and retry once (network latency)
        if (!profile) {
            await new Promise(resolve => setTimeout(resolve, 500));
            profile = await getUserProfile(user.uid);
        }

        if (profile) {
            currentUserProfile = profile;
            showPanelForRole(profile.role, profile.name);
        } else {
            // Profile missing in Firestore (created before or race condition):
            // Gracefully auto-create profile rather than trapping the user with instant sign-out
            console.warn('Perfil no encontrado en Firestore, auto-generando para:', user.uid);
            
            const savedRole = localStorage.getItem(`user_role_${user.uid}`) || 'client';
            const profileName = user.displayName || user.email.split('@')[0];

            const fallbackProfile = {
                name: profileName,
                email: user.email,
                role: savedRole
            };

            try {
                await saveUserProfile(user.uid, fallbackProfile);
                currentUserProfile = fallbackProfile;
                showPanelForRole(fallbackProfile.role, fallbackProfile.name);
            } catch (err) {
                console.error('Error al generar perfil de respaldo:', err);
                showAuthError('No se pudo cargar el perfil de usuario. Revisa las reglas de Firestore.');
                await auth.signOut();
            }
        }
    } else {
        // User is signed out — show auth screen
        currentUserProfile = null;
        showAuthScreen();
    }
});

// ===================================
// SHOW / HIDE SCREENS
// ===================================

function showAuthScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('active');

    // Reset forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    hideAuthError();
    showAuthTab('login');
}

function showPanelForRole(role, userName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Get initial letter for avatar
    const initial = userName ? userName.charAt(0).toUpperCase() : '?';

    if (role === 'seller') {
        const avatar = document.getElementById('sellerAvatar');
        const nameEl = document.getElementById('sellerName');
        const screen = document.getElementById('sellerScreen');

        if (avatar) avatar.textContent = initial;
        if (nameEl) nameEl.textContent = userName;
        if (screen) screen.classList.add('active');

        if (typeof initSeller === 'function') {
            initSeller();
        }
    } else {
        const avatar = document.getElementById('clientAvatar');
        const nameEl = document.getElementById('clientName');
        const screen = document.getElementById('clientScreen');

        if (avatar) avatar.textContent = initial;
        if (nameEl) nameEl.textContent = userName;
        if (screen) screen.classList.add('active');

        if (typeof initClient === 'function') {
            initClient();
        }
    }
}

// ===================================
// AUTH TAB SWITCHING
// ===================================

function showAuthTab(tab) {
    const loginTab = document.getElementById('tabLogin');
    const registerTab = document.getElementById('tabRegister');
    const loginForm = document.getElementById('loginFormContainer');
    const registerForm = document.getElementById('registerFormContainer');

    if (tab === 'login') {
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
        if (registerForm) registerForm.classList.remove('active');
    } else {
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.add('active');
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.add('active');
    }

    hideAuthError();
}

// ===================================
// REGISTER
// ===================================

async function handleRegister(e) {
    e.preventDefault();
    hideAuthError();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const role = document.querySelector('input[name="registerRole"]:checked')?.value;

    // Validation
    if (!name) return showAuthError('Ingresa tu nombre');
    if (!email) return showAuthError('Ingresa tu correo');
    if (password.length < 6) return showAuthError('La contraseña debe tener al menos 6 caracteres');
    if (!role) return showAuthError('Selecciona si eres Vendedor o Cliente');

    const submitBtn = document.getElementById('registerSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Creando cuenta...';
    }

    try {
        isRegistering = true;

        // 1. Create auth user in Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Cache role locally in case of any hiccups
        localStorage.setItem(`user_role_${uid}`, role);

        // 2. Update display name in Firebase Auth
        try {
            await userCredential.user.updateProfile({ displayName: name });
        } catch (profileErr) {
            console.warn('No se pudo actualizar displayName:', profileErr);
        }

        // 3. Save profile to Firestore
        const profileData = {
            name: name,
            email: email,
            role: role
        };
        await saveUserProfile(uid, profileData);

        // 4. Update state and navigate to appropriate panel
        currentUserProfile = profileData;
        showPanelForRole(role, name);

    } catch (error) {
        console.error('Error al registrar cuenta:', error);
        let message = 'Error al crear la cuenta';
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Este correo ya está registrado. Inicia sesión en la pestaña de Login.';
                break;
            case 'auth/invalid-email':
                message = 'El formato del correo no es válido';
                break;
            case 'auth/weak-password':
                message = 'La contraseña es muy débil (usa al menos 6 caracteres)';
                break;
            case 'auth/operation-not-allowed':
                message = 'Autenticación desactivada: Debes habilitar "Correo electrónico/contraseña" en Firebase Console';
                break;
            case 'permission-denied':
                message = 'Permiso denegado en Firestore: Revisa las reglas de seguridad en Firebase Console';
                break;
            case 'auth/network-request-failed':
                message = 'Error de conexión: No se pudo conectar a Firebase';
                break;
            default:
                message = error.message ? `Error: ${error.message}` : 'Error al crear la cuenta';
                break;
        }
        showAuthError(message);
    } finally {
        isRegistering = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Crear Cuenta';
        }
    }
}

// ===================================
// LOGIN
// ===================================

async function handleLogin(e) {
    e.preventDefault();
    hideAuthError();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email) return showAuthError('Ingresa tu correo');
    if (!password) return showAuthError('Ingresa tu contraseña');

    const submitBtn = document.getElementById('loginSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Ingresando...';
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Auth state observer will handle navigation

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        let message = 'Error al iniciar sesión';
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No existe una cuenta con este correo';
                break;
            case 'auth/wrong-password':
                message = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                message = 'El correo no es válido';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos. Intenta más tarde';
                break;
            case 'auth/invalid-credential':
                message = 'Correo o contraseña incorrectos';
                break;
            default:
                message = error.message ? `Error: ${error.message}` : 'Error al iniciar sesión';
                break;
        }
        showAuthError(message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Iniciar Sesión';
        }
    }
}

// ===================================
// LOGOUT
// ===================================

async function handleLogout() {
    // Clean up any Firestore listeners
    if (typeof stampsUnsubscribe === 'function') {
        stampsUnsubscribe();
        stampsUnsubscribe = null;
    }

    try {
        await auth.signOut();
        // Auth state observer will show auth screen
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// ===================================
// ERROR DISPLAY
// ===================================

function showAuthError(message) {
    const errorEl = document.getElementById('authError');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('visible');
}

function hideAuthError() {
    const errorEl = document.getElementById('authError');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
}
