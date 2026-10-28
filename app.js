// ===================================
// STAMP CARD APP - Seller & Client Logic
// ===================================

const TOTAL_STAMPS = 10;
let currentStamps = new Array(TOTAL_STAMPS).fill(false);
let stampsUnsubscribe = null;

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

    // Apply CSS variables to all stamp cards
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
    if (sellerCardTitle) {
        sellerCardTitle.textContent = currentBusinessName || 'Tarjeta de Sellos';
    }
    if (sellerCardSubtitle) {
        sellerCardSubtitle.textContent = currentBusinessName
            ? `Tarjeta de Fidelidad • ${currentBusinessName}`
            : 'Toca una casilla para marcar o desmarcar un sello';
    }

    // Update Client Card Header
    const clientCardTitle = document.getElementById('clientCardTitle');
    const clientCardSubtitle = document.getElementById('clientCardSubtitle');
    if (clientCardTitle) {
        clientCardTitle.textContent = currentBusinessName || 'Tu Tarjeta';
    }
    if (clientCardSubtitle) {
        clientCardSubtitle.textContent = currentBusinessName
            ? `Tarjeta de Lealtad en ${currentBusinessName}`
            : 'Tu progreso hacia la recompensa';
    }

    // Refresh client progress text to include business name if set
    updateClientProgress();
}

// ===================================
// SELLER PANEL LOGIC
// ===================================

async function initSeller(profile) {
    // Unsubscribe any previous listener
    if (stampsUnsubscribe) {
        stampsUnsubscribe();
        stampsUnsubscribe = null;
    }

    // Initial load of card settings
    const cardSettings = await loadCardSettings();
    currentBusinessName = cardSettings.businessName || profile?.businessName || '';
    currentCardColor = cardSettings.cardColor || profile?.cardColor || '#ff6f4a';

    applyCardTheme(currentCardColor, currentBusinessName);

    // Show onboarding banner if seller has not named their business yet
    const banner = document.getElementById('sellerOnboardingBanner');
    if (banner) {
        if (!currentBusinessName) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    // Initial load stamps from Firestore
    currentStamps = await loadStampsFromFirestore(TOTAL_STAMPS);
    renderSellerGrid();
    updateSellerProgress();
    checkSellerReward();

    // Listen for real-time changes
    stampsUnsubscribe = onStampsChange(TOTAL_STAMPS, (newStamps, cardData) => {
        currentStamps = [...newStamps];

        if (cardData) {
            let updatedTheme = false;
            if (cardData.businessName !== undefined && cardData.businessName !== currentBusinessName) {
                currentBusinessName = cardData.businessName;
                updatedTheme = true;
            }
            if (cardData.cardColor && cardData.cardColor !== currentCardColor) {
                currentCardColor = cardData.cardColor;
                updatedTheme = true;
            }
            if (updatedTheme) {
                applyCardTheme(currentCardColor, currentBusinessName);
            }
            if (currentBusinessName && banner) {
                banner.style.display = 'none';
            }
        }

        renderSellerGrid();
        updateSellerProgress();
        checkSellerReward();
    });

    renderColorPresets();
}

function renderSellerGrid() {
    const grid = document.getElementById('stampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < TOTAL_STAMPS; i++) {
        const isLast = i === TOTAL_STAMPS - 1;
        const isStamped = !!currentStamps[i];

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
    // Toggle state
    currentStamps[index] = !currentStamps[index];

    // Optimistic UI update
    renderSellerGrid();
    updateSellerProgress();

    // Check if user just reached full card
    const count = currentStamps.filter(Boolean).length;
    if (count === TOTAL_STAMPS) {
        showRewardOverlay();
    }

    // Persist to Firestore
    await saveStampsToFirestore(currentStamps);
}

function updateSellerProgress() {
    const count = currentStamps.filter(Boolean).length;
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

function checkSellerReward() {
    const count = currentStamps.filter(Boolean).length;
    if (count === TOTAL_STAMPS) {
        const overlay = document.getElementById('rewardOverlay');
        if (overlay && !overlay.classList.contains('visible') && !overlay.dataset.dismissed) {
            showRewardOverlay();
        }
    }
}

function showRewardOverlay() {
    const overlay = document.getElementById('rewardOverlay');
    if (!overlay) return;
    delete overlay.dataset.dismissed;
    overlay.classList.add('visible');
    launchConfetti();
}

async function claimReward() {
    // Reset stamps array
    currentStamps = new Array(TOTAL_STAMPS).fill(false);
    await saveStampsToFirestore(currentStamps);

    closeReward();
    renderSellerGrid();
    updateSellerProgress();
}

function closeReward() {
    const overlay = document.getElementById('rewardOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.dataset.dismissed = 'true';
    }
}

// ===================================
// CLIENT PANEL LOGIC
// ===================================

function initClient(profile) {
    // Unsubscribe any previous listener
    if (stampsUnsubscribe) {
        stampsUnsubscribe();
        stampsUnsubscribe = null;
    }

    // Render read-only grid and subscribe
    stampsUnsubscribe = onStampsChange(TOTAL_STAMPS, (newStamps, cardData) => {
        currentStamps = [...newStamps];

        if (cardData) {
            if (cardData.businessName !== undefined) currentBusinessName = cardData.businessName;
            if (cardData.cardColor) currentCardColor = cardData.cardColor;
            applyCardTheme(currentCardColor, currentBusinessName);
        }

        renderClientGrid();
        updateClientProgress();
    });
}

function renderClientGrid() {
    const grid = document.getElementById('clientStampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < TOTAL_STAMPS; i++) {
        const isLast = i === TOTAL_STAMPS - 1;
        const isStamped = !!currentStamps[i];

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

function updateClientProgress() {
    const count = currentStamps.filter(Boolean).length;
    const percentage = Math.round((count / TOTAL_STAMPS) * 100);
    const isComplete = count === TOTAL_STAMPS;

    const countEl = document.getElementById('clientStampCount');
    const fillEl = document.getElementById('clientProgressFill');
    const textEl = document.getElementById('clientProgressText');
    const summaryCard = document.getElementById('clientSummary');
    const summaryTitle = document.getElementById('clientSummaryTitle');
    const rewardBanner = document.getElementById('clientRewardBanner');

    if (countEl) {
        countEl.textContent = `${count} / ${TOTAL_STAMPS}`;
        countEl.classList.toggle('complete', isComplete);
    }

    if (fillEl) {
        fillEl.style.width = `${percentage}%`;
    }

    if (textEl) {
        textEl.textContent = `${percentage}% completado`;
    }

    if (summaryCard) {
        summaryCard.classList.toggle('complete', isComplete);
    }

    if (summaryTitle) {
        const businessSuffix = currentBusinessName ? ` en ${currentBusinessName}` : '';
        if (isComplete) {
            summaryTitle.textContent = `¡Felicidades! Recompensa desbloqueada${businessSuffix} 🎉`;
        } else if (count === 0) {
            summaryTitle.textContent = `¡Comienza a acumular sellos${businessSuffix}!`;
        } else {
            summaryTitle.textContent = `¡Te faltan solo ${TOTAL_STAMPS - count} sellos${businessSuffix}!`;
        }
    }

    if (rewardBanner) {
        rewardBanner.classList.toggle('visible', isComplete);
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

    // Update active swatch buttons
    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.hex.toLowerCase() === hex.toLowerCase());
    });

    // Sync custom color input & label
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

    // Check if it matches any preset
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

        // Hide onboarding banner if visible
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

// Close modal on Escape or outside click
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCardSettingsModal();
    }
});

document.addEventListener('click', (e) => {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay && e.target === overlay) {
        closeCardSettingsModal();
    }
});
