// ===================================
// STAMP CARD APP - Multi-Client Architecture
// ===================================

const TOTAL_STAMPS = 10;

// Seller State
let sellerCards = [];
let selectedCardId = null;
let sellerCardsUnsubscribe = null;

// Client State
let clientCards = [];
let selectedClientCardId = null;
let clientCardsUnsubscribe = null;

// Card Customization State
let currentBusinessName = '';
let currentCardColor = '#ff6f4a';
let tempSelectedColor = '#ff6f4a';

const COLOR_PRESETS = [
    { name: 'Coral Clásico', hex: '#ff6f4a' },
    { name: 'Azul Océano', hex: '#2563eb' },
    { name: 'Verde Esmeralda', hex: '#059669' },
    { name: 'Púrpura Real', hex: '#7c3aed' },
    { name: 'Rosa Neón', hex: '#db2777' },
    { name: 'Ámbar Cálido', hex: '#d97706' },
    { name: 'Turquesa Caribe', hex: '#0891b2' },
    { name: 'Negro Ébano', hex: '#1f2937' }
];

// ===================================
// COLOR & PALETTE UTILITIES
// ===================================

function hexToRgb(hex) {
    if (!hex) return { r: 255, g: 111, b: 74 };
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return { r: 255, g: 111, b: 74 };
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function adjustBrightness(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const adjust = (c) => Math.min(255, Math.max(0, Math.round(c + (c * percent / 100))));
    const toHex = (c) => adjust(c).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generatePalette(primaryHex) {
    const rgb = hexToRgb(primaryHex);
    const lighter = adjustBrightness(primaryHex, 20);
    const darker = adjustBrightness(primaryHex, -22);
    return {
        primary: primaryHex,
        lighter: lighter,
        darker: darker,
        gradient: `linear-gradient(135deg, ${primaryHex}, ${lighter})`,
        gradientDark: `linear-gradient(135deg, ${darker}, ${primaryHex})`,
        bgLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
        bgHover: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
        glow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
        glowLg: `0 8px 30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`
    };
}

function applyCardTheme(colorHex, businessName) {
    if (colorHex) currentCardColor = colorHex;
    if (businessName !== undefined) currentBusinessName = businessName;

    const palette = generatePalette(currentCardColor);

    // Apply CSS variables to cards
    const cards = document.querySelectorAll('.stamp-card');
    cards.forEach(card => {
        card.style.setProperty('--card-primary', palette.primary);
        card.style.setProperty('--card-primary-dark', palette.darker);
        card.style.setProperty('--card-primary-light', palette.lighter);
        card.style.setProperty('--card-primary-gradient', palette.gradient);
        card.style.setProperty('--card-primary-bg-light', palette.bgLight);
        card.style.setProperty('--card-primary-bg-hover', palette.bgHover);
        card.style.setProperty('--card-primary-border', palette.border);
        card.style.setProperty('--card-primary-glow', palette.glow);
        card.style.setProperty('--card-primary-glow-lg', palette.glowLg);
    });

    // Update Seller Card Header
    const sellerCardTitle = document.getElementById('sellerCardTitle');
    const sellerCardSubtitle = document.getElementById('sellerCardSubtitle');
    const sellerHeaderTitle = document.getElementById('sellerHeaderTitle');

    if (sellerHeaderTitle) {
        sellerHeaderTitle.textContent = currentBusinessName || 'Tarjeta de Sellos';
    }
    if (sellerCardTitle) {
        sellerCardTitle.textContent = currentBusinessName || 'Tarjeta de Sellos';
    }
    if (sellerCardSubtitle) {
        sellerCardSubtitle.textContent = currentBusinessName
            ? `Tarjeta de Lealtad en ${currentBusinessName} • Toca para marcar`
            : 'Toca una casilla para marcar o desmarcar un sello';
    }
}

// ===================================
// SELLER PANEL LOGIC
// ===================================

async function initSeller(profile) {
    if (sellerCardsUnsubscribe) {
        sellerCardsUnsubscribe();
        sellerCardsUnsubscribe = null;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Load seller settings
    const cardSettings = await loadCardSettings();
    currentBusinessName = cardSettings.businessName || profile?.businessName || '';
    currentCardColor = cardSettings.cardColor || profile?.cardColor || '#ff6f4a';

    applyCardTheme(currentCardColor, currentBusinessName);

    // Check onboarding banner
    const banner = document.getElementById('sellerOnboardingBanner');
    if (banner) {
        banner.style.display = currentBusinessName ? 'none' : 'flex';
    }

    // Subscribe to seller's cards in real time
    sellerCardsUnsubscribe = subscribeToSellerCards(currentUser.uid, (cards) => {
        sellerCards = cards || [];
        renderSellerClientsDropdown();

        const emptyEl = document.getElementById('sellerEmptyClients');
        const stampCardEl = document.getElementById('stampCard');
        const activeStrip = document.getElementById('activeClientStrip');

        if (sellerCards.length === 0) {
            selectedCardId = null;
            if (emptyEl) emptyEl.style.display = 'block';
            if (stampCardEl) stampCardEl.style.display = 'none';
            if (activeStrip) activeStrip.style.display = 'none';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            if (stampCardEl) stampCardEl.style.display = 'block';
            if (activeStrip) activeStrip.style.display = 'flex';

            // If selected card doesn't exist anymore, pick the first one
            if (!selectedCardId || !sellerCards.some(c => c.id === selectedCardId)) {
                selectedCardId = sellerCards[0].id;
            }

            renderActiveSellerCard();
        }
    });

    renderColorPresets();
}

function renderSellerClientsDropdown() {
    const select = document.getElementById('sellerClientSelect');
    if (!select) return;

    select.innerHTML = '';

    if (sellerCards.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Sin clientes agregados';
        select.appendChild(opt);
        return;
    }

    sellerCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.id;
        const count = (card.stamps || []).filter(Boolean).length;
        opt.textContent = `${card.clientName || 'Cliente'} (${count}/10) — ${card.clientEmail}`;
        if (card.id === selectedCardId) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

function onSellerClientSelectChange(e) {
    const newCardId = e.target.value;
    if (newCardId) {
        selectedCardId = newCardId;
        renderActiveSellerCard();
    }
}

function getActiveSellerCard() {
    return sellerCards.find(c => c.id === selectedCardId) || null;
}

function renderActiveSellerCard() {
    const card = getActiveSellerCard();
    if (!card) return;

    // Update active client strip
    const avatarEl = document.getElementById('activeClientAvatar');
    const nameEl = document.getElementById('activeClientName');
    const emailEl = document.getElementById('activeClientEmail');
    const pillEl = document.getElementById('activeClientStampsPill');

    const displayName = card.clientName || 'Cliente';
    const initial = displayName.charAt(0).toUpperCase();
    const stampsCount = (card.stamps || []).filter(Boolean).length;

    if (avatarEl) avatarEl.textContent = initial;
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = card.clientEmail;
    if (pillEl) {
        pillEl.textContent = `${stampsCount} / ${TOTAL_STAMPS} sellos`;
        pillEl.classList.toggle('complete', stampsCount === TOTAL_STAMPS);
    }

    // Render stamps grid
    renderSellerGrid(card.stamps || new Array(TOTAL_STAMPS).fill(false));
    updateSellerProgress(stampsCount);

    // Check reward
    if (stampsCount === TOTAL_STAMPS) {
        const overlay = document.getElementById('rewardOverlay');
        if (overlay && !overlay.classList.contains('visible') && !overlay.dataset.dismissed) {
            showRewardOverlay(displayName);
        }
    }
}

function renderSellerGrid(stampsArray) {
    const grid = document.getElementById('stampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < TOTAL_STAMPS; i++) {
        const isLast = i === TOTAL_STAMPS - 1;
        const isStamped = !!stampsArray[i];

        const slot = document.createElement('div');
        slot.className = `stamp-slot ${isStamped ? 'stamped' : ''} ${isLast ? 'reward-slot' : ''}`;
        slot.id = `seller-stamp-${i + 1}`;
        slot.title = isStamped ? `Sello ${i + 1} (marcado - clic para desmarcar)` : `Sello ${i + 1} (clic para marcar)`;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'stamp-number';
        numberSpan.textContent = isLast ? '🎁' : (i + 1);
        slot.appendChild(numberSpan);

        slot.addEventListener('click', () => toggleStamp(i));
        grid.appendChild(slot);
    }
}

async function toggleStamp(index) {
    const card = getActiveSellerCard();
    if (!card) return;

    const currentStamps = [...(card.stamps || new Array(TOTAL_STAMPS).fill(false))];
    currentStamps[index] = !currentStamps[index];

    // Optimistic local update
    card.stamps = currentStamps;
    renderActiveSellerCard();

    const count = currentStamps.filter(Boolean).length;
    if (count === TOTAL_STAMPS) {
        showRewardOverlay(card.clientName);
    }

    // Persist to Firestore
    try {
        await saveCardStamps(card.id, currentStamps);
    } catch (err) {
        console.error('Error al guardar sello:', err);
    }
}

function updateSellerProgress(count) {
    const percentage = Math.round((count / TOTAL_STAMPS) * 100);

    const countEl = document.getElementById('stampCount');
    const fillEl = document.getElementById('progressFill');
    const textEl = document.getElementById('progressText');
    const cardEl = document.getElementById('stampCard');

    if (countEl) {
        countEl.textContent = `${count} / ${TOTAL_STAMPS}`;
        countEl.classList.toggle('complete', count === TOTAL_STAMPS);
    }

    if (fillEl) {
        fillEl.style.width = `${percentage}%`;
    }

    if (textEl) {
        textEl.textContent = `${percentage}% completado`;
    }

    if (cardEl) {
        cardEl.classList.toggle('complete', count === TOTAL_STAMPS);
    }
}

function showRewardOverlay(clientName) {
    const overlay = document.getElementById('rewardOverlay');
    const subtitle = document.getElementById('rewardSubtitle');
    if (!overlay) return;

    if (subtitle && clientName) {
        subtitle.textContent = `${clientName} ha completado sus 10 sellos`;
    }

    delete overlay.dataset.dismissed;
    overlay.classList.add('visible');
    launchConfetti();
}

async function claimReward() {
    const card = getActiveSellerCard();
    if (!card) return closeReward();

    const emptyStamps = new Array(TOTAL_STAMPS).fill(false);
    card.stamps = emptyStamps;
    await saveCardStamps(card.id, emptyStamps);

    closeReward();
    renderActiveSellerCard();
}

function closeReward() {
    const overlay = document.getElementById('rewardOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.dataset.dismissed = 'true';
    }
}

async function handleResetClientCard() {
    const card = getActiveSellerCard();
    if (!card) return;

    if (!confirm(`¿Deseas reiniciar los sellos de ${card.clientName || card.clientEmail} a 0?`)) {
        return;
    }

    try {
        await resetClientCard(card.id);
        card.stamps = new Array(TOTAL_STAMPS).fill(false);
        renderActiveSellerCard();
    } catch (err) {
        alert('Error al reiniciar sellos');
    }
}

async function handleDeleteClientCard() {
    const card = getActiveSellerCard();
    if (!card) return;

    if (!confirm(`¿Eliminar la tarjeta de ${card.clientName || card.clientEmail}? El cliente ya no la verá en su cuenta.`)) {
        return;
    }

    try {
        await deleteClientCard(card.id);
        sellerCards = sellerCards.filter(c => c.id !== card.id);
        selectedCardId = sellerCards.length > 0 ? sellerCards[0].id : null;
        renderSellerClientsDropdown();

        if (sellerCards.length === 0) {
            document.getElementById('sellerEmptyClients').style.display = 'block';
            document.getElementById('stampCard').style.display = 'none';
            document.getElementById('activeClientStrip').style.display = 'none';
        } else {
            renderActiveSellerCard();
        }
    } catch (err) {
        alert('Error al eliminar cliente');
    }
}

// ===================================
// ADD CLIENT MODAL
// ===================================

function openAddClientModal() {
    const overlay = document.getElementById('addClientOverlay');
    const emailInput = document.getElementById('addClientEmail');
    const nameInput = document.getElementById('addClientName');
    const feedback = document.getElementById('addClientFeedback');

    if (emailInput) emailInput.value = '';
    if (nameInput) nameInput.value = '';
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'settings-feedback';
    }

    if (overlay) {
        overlay.classList.add('visible');
        if (emailInput) {
            setTimeout(() => emailInput.focus(), 150);
        }
    }
}

function closeAddClientModal() {
    const overlay = document.getElementById('addClientOverlay');
    if (overlay) overlay.classList.remove('visible');
}

async function handleAddClientSubmit(e) {
    e.preventDefault();

    const emailInput = document.getElementById('addClientEmail');
    const nameInput = document.getElementById('addClientName');
    const submitBtn = document.getElementById('addClientSubmitBtn');
    const feedback = document.getElementById('addClientFeedback');

    const email = emailInput ? emailInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';

    if (!email) {
        if (feedback) {
            feedback.textContent = 'Ingresa el correo electrónico del cliente';
            feedback.className = 'settings-feedback error';
        }
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Creando tarjeta...';
    }

    try {
        const result = await addClientCard({
            sellerId: currentUser.uid,
            sellerName: currentUser.displayName || 'Vendedor',
            businessName: currentBusinessName || 'Mi Negocio',
            cardColor: currentCardColor || '#ff6f4a',
            clientEmail: email,
            clientName: name
        });

        if (!result.success && result.code === 'ALREADY_EXISTS') {
            if (feedback) {
                feedback.textContent = result.message;
                feedback.className = 'settings-feedback error';
            }
            selectedCardId = result.card.id;
            renderSellerClientsDropdown();
            renderActiveSellerCard();
            return;
        }

        selectedCardId = result.card.id;

        if (feedback) {
            feedback.textContent = '✓ ¡Cliente y tarjeta agregados con éxito!';
            feedback.className = 'settings-feedback success';
        }

        setTimeout(() => {
            closeAddClientModal();
        }, 600);

    } catch (err) {
        console.error('Error al agregar cliente:', err);
        if (feedback) {
            feedback.textContent = 'Error al agregar cliente. Revisa las reglas de Firestore o la conexión.';
            feedback.className = 'settings-feedback error';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Crear Tarjeta';
        }
    }
}

// ===================================
// CLIENT PANEL LOGIC
// ===================================

function initClient(profile) {
    if (clientCardsUnsubscribe) {
        clientCardsUnsubscribe();
        clientCardsUnsubscribe = null;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) return;

    const email = currentUser.email;

    clientCardsUnsubscribe = subscribeToClientCards(email, (cards) => {
        clientCards = cards || [];

        const emptyEl = document.getElementById('clientEmptyCards');
        const activeSection = document.getElementById('clientActiveCardSection');
        const selectorEl = document.getElementById('clientCardsSelector');
        const emptyEmailSpan = document.getElementById('clientEmptyEmail');

        if (emptyEmailSpan) emptyEmailSpan.textContent = email;

        if (clientCards.length === 0) {
            selectedClientCardId = null;
            if (emptyEl) emptyEl.style.display = 'block';
            if (activeSection) activeSection.style.display = 'none';
            if (selectorEl) selectorEl.style.display = 'none';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            if (activeSection) activeSection.style.display = 'block';

            // If selected doesn't exist, pick the first
            if (!selectedClientCardId || !clientCards.some(c => c.id === selectedClientCardId)) {
                selectedClientCardId = clientCards[0].id;
            }

            renderClientBusinessTabs();
            renderActiveClientCard();
        }
    });
}

function renderClientBusinessTabs() {
    const container = document.getElementById('clientCardsSelector');
    const tabs = document.getElementById('clientBusinessesTabs');
    if (!container || !tabs) return;

    if (clientCards.length <= 1) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    tabs.innerHTML = '';

    clientCards.forEach(card => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `client-biz-tab ${card.id === selectedClientCardId ? 'active' : ''}`;
        btn.textContent = card.businessName || 'Negocio';
        btn.addEventListener('click', () => {
            selectedClientCardId = card.id;
            renderClientBusinessTabs();
            renderActiveClientCard();
        });
        tabs.appendChild(btn);
    });
}

function getActiveClientCard() {
    return clientCards.find(c => c.id === selectedClientCardId) || null;
}

function renderActiveClientCard() {
    const card = getActiveClientCard();
    if (!card) return;

    // Apply this business's theme
    const cardColor = card.cardColor || '#ff6f4a';
    const businessName = card.businessName || 'Tarjeta de Sellos';
    const stamps = card.stamps || new Array(TOTAL_STAMPS).fill(false);
    const count = stamps.filter(Boolean).length;
    const isComplete = count === TOTAL_STAMPS;

    const palette = generatePalette(cardColor);
    const clientCardEl = document.getElementById('clientStampCard');
    if (clientCardEl) {
        clientCardEl.style.setProperty('--card-primary', palette.primary);
        clientCardEl.style.setProperty('--card-primary-dark', palette.darker);
        clientCardEl.style.setProperty('--card-primary-light', palette.lighter);
        clientCardEl.style.setProperty('--card-primary-gradient', palette.gradient);
        clientCardEl.style.setProperty('--card-primary-bg-light', palette.bgLight);
        clientCardEl.style.setProperty('--card-primary-bg-hover', palette.bgHover);
        clientCardEl.style.setProperty('--card-primary-border', palette.border);
        clientCardEl.style.setProperty('--card-primary-glow', palette.glow);
        clientCardEl.style.setProperty('--card-primary-glow-lg', palette.glowLg);
    }

    const titleEl = document.getElementById('clientCardTitle');
    const subtitleEl = document.getElementById('clientCardSubtitle');
    const countEl = document.getElementById('clientStampCount');
    const fillEl = document.getElementById('clientProgressFill');
    const textEl = document.getElementById('clientProgressText');
    const summaryCard = document.getElementById('clientSummary');
    const summaryTitle = document.getElementById('clientSummaryTitle');
    const rewardBanner = document.getElementById('clientRewardBanner');

    if (titleEl) titleEl.textContent = businessName;
    if (subtitleEl) subtitleEl.textContent = `Tu progreso en ${businessName}`;

    if (countEl) {
        countEl.textContent = `${count} / ${TOTAL_STAMPS}`;
        countEl.classList.toggle('complete', isComplete);
    }

    const percentage = Math.round((count / TOTAL_STAMPS) * 100);
    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}% completado`;

    if (summaryCard) summaryCard.classList.toggle('complete', isComplete);
    if (summaryTitle) {
        if (isComplete) {
            summaryTitle.textContent = `¡Felicidades! Recompensa en ${businessName} desbloqueada 🎉`;
        } else if (count === 0) {
            summaryTitle.textContent = `¡Comienza a acumular sellos en ${businessName}!`;
        } else {
            summaryTitle.textContent = `¡Te faltan solo ${TOTAL_STAMPS - count} sellos en ${businessName}!`;
        }
    }

    if (rewardBanner) {
        rewardBanner.classList.toggle('visible', isComplete);
    }

    // Render read-only stamps grid
    const grid = document.getElementById('clientStampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < TOTAL_STAMPS; i++) {
        const isLast = i === TOTAL_STAMPS - 1;
        const isStamped = !!stamps[i];

        const slot = document.createElement('div');
        slot.className = `stamp-slot client-stamp-slot ${isStamped ? 'stamped' : ''} ${isLast ? 'reward-slot' : ''}`;
        slot.id = `client-stamp-${i + 1}`;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'stamp-number';
        numberSpan.textContent = isLast ? '🎁' : (i + 1);
        slot.appendChild(numberSpan);

        grid.appendChild(slot);
    }
}

// ===================================
// CARD SETTINGS MODAL & CUSTOMIZATION
// ===================================

function renderColorPresets() {
    const grid = document.getElementById('colorPaletteGrid');
    if (!grid) return;
    grid.innerHTML = '';

    COLOR_PRESETS.forEach(preset => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-swatch-btn ${preset.hex.toLowerCase() === tempSelectedColor.toLowerCase() ? 'active' : ''}`;
        btn.style.backgroundColor = preset.hex;
        btn.title = preset.name;
        btn.dataset.hex = preset.hex;

        btn.innerHTML = `
            <svg class="swatch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 13l4 4L19 7"/>
            </svg>
        `;

        btn.addEventListener('click', () => selectColorPreset(preset.hex));
        grid.appendChild(btn);
    });
}

function selectColorPreset(hex) {
    tempSelectedColor = hex;

    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.hex.toLowerCase() === hex.toLowerCase());
    });

    const customInput = document.getElementById('settingsCustomColor');
    const hexText = document.getElementById('settingsColorHex');
    if (customInput) customInput.value = hex;
    if (hexText) hexText.textContent = hex.toUpperCase();

    updateLivePreview();
}

function onCustomColorChange(e) {
    const hex = e.target.value;
    tempSelectedColor = hex;

    const hexText = document.getElementById('settingsColorHex');
    if (hexText) hexText.textContent = hex.toUpperCase();

    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.hex.toLowerCase() === hex.toLowerCase());
    });

    updateLivePreview();
}

function updateLivePreview() {
    const nameInput = document.getElementById('settingsBusinessName');
    const previewName = document.getElementById('previewBusinessName');
    const miniCard = document.getElementById('miniCardPreview');

    const businessName = nameInput ? nameInput.value.trim() : '';
    if (previewName) {
        previewName.textContent = businessName || 'Nombre de tu Negocio';
    }

    if (miniCard) {
        const palette = generatePalette(tempSelectedColor);
        miniCard.style.setProperty('--preview-primary', palette.primary);
        miniCard.style.setProperty('--preview-gradient', palette.gradient);
        miniCard.style.setProperty('--preview-bg-light', palette.bgLight);
        miniCard.style.setProperty('--preview-border', palette.border);
        miniCard.style.setProperty('--preview-glow', palette.glow);
    }
}

function openCardSettingsModal() {
    const overlay = document.getElementById('settingsOverlay');
    const nameInput = document.getElementById('settingsBusinessName');
    const feedback = document.getElementById('settingsFeedback');

    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'settings-feedback';
    }

    tempSelectedColor = currentCardColor || '#ff6f4a';

    if (nameInput) {
        nameInput.value = currentBusinessName || '';
    }

    renderColorPresets();
    selectColorPreset(tempSelectedColor);
    updateLivePreview();

    if (overlay) {
        overlay.classList.add('visible');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 150);
        }
    }
}

function closeCardSettingsModal() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

async function handleSaveCardSettings(e) {
    e.preventDefault();

    const nameInput = document.getElementById('settingsBusinessName');
    const businessName = nameInput ? nameInput.value.trim() : '';
    const submitBtn = document.getElementById('saveCardSettingsBtn');
    const feedback = document.getElementById('settingsFeedback');

    if (!businessName) {
        if (feedback) {
            feedback.textContent = 'Por favor ingresa el nombre de tu negocio';
            feedback.className = 'settings-feedback error';
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Guardando...';
    }

    try {
        await saveCardSettings({
            businessName: businessName,
            cardColor: tempSelectedColor
        });

        currentBusinessName = businessName;
        currentCardColor = tempSelectedColor;
        applyCardTheme(currentCardColor, currentBusinessName);

        const banner = document.getElementById('sellerOnboardingBanner');
        if (banner) {
            banner.style.display = 'none';
        }

        if (feedback) {
            feedback.textContent = '✓ ¡Tarjeta guardada exitosamente!';
            feedback.className = 'settings-feedback success';
        }

        setTimeout(() => {
            closeCardSettingsModal();
        }, 650);

    } catch (err) {
        console.error('Error al guardar ajustes de la tarjeta:', err);
        if (feedback) {
            feedback.textContent = 'Error al guardar los ajustes. Revisa la conexión o reglas de Firestore.';
            feedback.className = 'settings-feedback error';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Guardar Cambios';
        }
    }
}

// ===================================
// CONFETTI EFFECT
// ===================================

function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    container.innerHTML = '';

    const palette = generatePalette(currentCardColor);
    const colors = [palette.primary, palette.lighter, '#ffd166', '#06d6a0', '#118ab2', '#ffffff'];
    const count = 40;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = `${Math.random() * 0.8}s`;
        piece.style.animationDuration = `${2 + Math.random() * 2}s`;
        piece.style.transform = `scale(${0.6 + Math.random() * 0.6})`;
        container.appendChild(piece);
    }

    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Close modals on Escape or outside click
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCardSettingsModal();
        closeAddClientModal();
    }
});

document.addEventListener('click', (e) => {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay && e.target === settingsOverlay) {
        closeCardSettingsModal();
    }
    const addClientOverlay = document.getElementById('addClientOverlay');
    if (addClientOverlay && e.target === addClientOverlay) {
        closeAddClientModal();
    }
});
