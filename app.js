// ===================================
// STAMP CARD APP - Seller & Client Logic
// ===================================

const TOTAL_STAMPS = 10;
let currentStamps = new Array(TOTAL_STAMPS).fill(false);
let stampsUnsubscribe = null;

// ===================================
// SELLER PANEL LOGIC
// ===================================

async function initSeller() {
    // Unsubscribe any previous listener
    if (stampsUnsubscribe) {
        stampsUnsubscribe();
        stampsUnsubscribe = null;
    }

    // Initial load from Firestore
    currentStamps = await loadStampsFromFirestore(TOTAL_STAMPS);
    renderSellerGrid();
    updateSellerProgress();
    checkSellerReward();

    // Listen for real-time changes
    stampsUnsubscribe = onStampsChange(TOTAL_STAMPS, (newStamps) => {
        currentStamps = [...newStamps];
        renderSellerGrid();
        updateSellerProgress();
        checkSellerReward();
    });
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

function initClient() {
    // Unsubscribe any previous listener
    if (stampsUnsubscribe) {
        stampsUnsubscribe();
        stampsUnsubscribe = null;
    }

    // Render read-only grid and subscribe
    stampsUnsubscribe = onStampsChange(TOTAL_STAMPS, (newStamps) => {
        currentStamps = [...newStamps];
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
        if (isComplete) {
            summaryTitle.textContent = '¡Felicidades! Recompensa desbloqueada 🎉';
        } else if (count === 0) {
            summaryTitle.textContent = '¡Comienza a acumular sellos!';
        } else {
            summaryTitle.textContent = `¡Te faltan solo ${TOTAL_STAMPS - count} sellos!`;
        }
    }

    if (rewardBanner) {
        rewardBanner.classList.toggle('visible', isComplete);
    }
}

// ===================================
// CONFETTI EFFECT
// ===================================

function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    container.innerHTML = '';

    const colors = ['#ff6f4a', '#ffa68e', '#f05a35', '#ffd166', '#06d6a0', '#118ab2'];
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
