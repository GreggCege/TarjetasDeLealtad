// ===================================
// STAMP CARD APP - Multi-Client Architecture
// ===================================

const DEFAULT_TOTAL_STAMPS = 10;
let TOTAL_STAMPS = DEFAULT_TOTAL_STAMPS;

// Seller State
let sellerCards = [];
let selectedCardId = null;
let sellerCardsUnsubscribe = null;
let currentTotalStamps = DEFAULT_TOTAL_STAMPS;
let currentRewards = [{ stamps: DEFAULT_TOTAL_STAMPS, description: 'Premio especial' }];
let tempTotalStamps = DEFAULT_TOTAL_STAMPS;
let tempRewards = [];

// Client State
let clientCards = [];
let selectedClientCardId = null;
let clientCardsUnsubscribe = null;

// Card Customization State
let currentBusinessName = '';
let currentCardColor = '#ff6f4a';
let tempSelectedColor = '#ff6f4a';
let currentOverlayRewardId = null;

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

    // Apply CSS variables to root and cards
    document.documentElement.style.setProperty('--card-primary', palette.primary);
    document.documentElement.style.setProperty('--card-primary-dark', palette.darker);
    document.documentElement.style.setProperty('--card-primary-light', palette.lighter);
    document.documentElement.style.setProperty('--card-primary-gradient', palette.gradient);
    document.documentElement.style.setProperty('--card-primary-bg-light', palette.bgLight);
    document.documentElement.style.setProperty('--card-primary-bg-hover', palette.bgHover);
    document.documentElement.style.setProperty('--card-primary-border', palette.border);
    document.documentElement.style.setProperty('--card-primary-glow', palette.glow);
    document.documentElement.style.setProperty('--card-primary-glow-lg', palette.glowLg);

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

    // Load reward settings
    const rewardSettings = await loadRewardSettings();
    currentTotalStamps = rewardSettings.totalStamps || DEFAULT_TOTAL_STAMPS;
    TOTAL_STAMPS = currentTotalStamps;
    currentRewards = rewardSettings.rewards || [{ stamps: currentTotalStamps, description: 'Premio especial' }];
    updateRewardConfigPill();

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
        const rewardsPanel = document.getElementById('sellerRewardsPanel');

        if (sellerCards.length === 0) {
            selectedCardId = null;
            if (emptyEl) emptyEl.style.display = 'block';
            if (stampCardEl) stampCardEl.style.display = 'none';
            if (activeStrip) activeStrip.style.display = 'none';
            if (rewardsPanel) rewardsPanel.style.display = 'none';
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

// Returns the effective totalStamps for a given card (falls back to global setting)
function getCardTotalStamps(card) {
    return (card && card.totalStamps) ? card.totalStamps : TOTAL_STAMPS;
}

// Returns the effective rewards for a given card
function getCardRewards(card) {
    return (card && card.rewards && card.rewards.length > 0) ? card.rewards : currentRewards;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderSellerClientsDropdown(filterQuery = '') {
    const triggerLabel = document.getElementById('dropdownTriggerLabel');
    const listContainer = document.getElementById('clientDropdownList');
    if (!listContainer) return;

    const activeCard = getActiveSellerCard();
    if (triggerLabel) {
        if (activeCard) {
            const cardTotal = getCardTotalStamps(activeCard);
            const count = (activeCard.stamps || []).filter(Boolean).length;
            const name = escapeHtml(activeCard.clientName || 'Cliente');
            const email = escapeHtml(activeCard.clientEmail || '');
            triggerLabel.innerHTML = `
                <span class="trigger-name">${name}</span>
                <span class="trigger-badge ${count === cardTotal ? 'complete' : ''}">${count}/${cardTotal}</span>
                <span class="trigger-email">${email}</span>
            `;
        } else {
            triggerLabel.innerHTML = `<span class="trigger-placeholder">${sellerCards.length > 0 ? 'Selecciona un cliente...' : 'Sin clientes agregados'}</span>`;
        }
    }

    listContainer.innerHTML = '';

    const query = (filterQuery || '').toLowerCase().trim();
    const filteredCards = query
        ? sellerCards.filter(c => 
            (c.clientName && c.clientName.toLowerCase().includes(query)) ||
            (c.clientEmail && c.clientEmail.toLowerCase().includes(query))
          )
        : sellerCards;

    if (filteredCards.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'dropdown-empty-result';
        emptyMsg.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>${query ? `No se encontraron clientes para "<strong>${escapeHtml(filterQuery)}</strong>"` : 'No hay clientes registrados aún'}</span>
        `;
        listContainer.appendChild(emptyMsg);
        return;
    }

    filteredCards.forEach(card => {
        const item = document.createElement('div');
        const isSelected = card.id === selectedCardId;
        item.className = `client-dropdown-item ${isSelected ? 'selected' : ''}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

        const cardTotal = getCardTotalStamps(card);
        const count = (card.stamps || []).filter(Boolean).length;
        const initial = (card.clientName || card.clientEmail || 'C').charAt(0).toUpperCase();

        item.innerHTML = `
            <div class="item-avatar">${initial}</div>
            <div class="item-info">
                <span class="item-name">${escapeHtml(card.clientName || 'Cliente')}</span>
                <span class="item-email">${escapeHtml(card.clientEmail)}</span>
            </div>
            <span class="item-badge ${count === cardTotal ? 'complete' : ''}">${count}/${cardTotal}</span>
            <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectSellerClient(card.id);
        });

        listContainer.appendChild(item);
    });
}

function selectSellerClient(cardId) {
    if (!cardId) return;
    selectedCardId = cardId;
    renderActiveSellerCard();
    renderSellerClientsDropdown();
    closeClientDropdown();
}

function toggleClientDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('sellerSearchableDropdown');
    const triggerBtn = document.getElementById('dropdownTriggerBtn');
    const searchInput = document.getElementById('clientSearchInput');

    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('open');

    if (isOpen) {
        closeClientDropdown();
    } else {
        dropdown.classList.add('open');
        if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
        if (searchInput) {
            searchInput.value = '';
            const clearBtn = document.getElementById('searchClearBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            renderSellerClientsDropdown('');
            setTimeout(() => searchInput.focus(), 80);
        }
    }
}

function closeClientDropdown() {
    const dropdown = document.getElementById('sellerSearchableDropdown');
    const triggerBtn = document.getElementById('dropdownTriggerBtn');
    if (dropdown) dropdown.classList.remove('open');
    if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
}

function filterSellerClients(event) {
    const query = event.target.value;
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) {
        clearBtn.style.display = query.trim() ? 'block' : 'none';
    }
    renderSellerClientsDropdown(query);
}

function clearClientSearch(event) {
    if (event) event.stopPropagation();
    const searchInput = document.getElementById('clientSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    renderSellerClientsDropdown('');
}

function getActiveSellerCard() {
    return sellerCards.find(c => c.id === selectedCardId) || null;
}

function renderActiveSellerCard() {
    const card = getActiveSellerCard();
    if (!card) return;

    const cardTotal = getCardTotalStamps(card);
    const rewards = getCardRewards(card);

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
        pillEl.textContent = `${stampsCount} / ${cardTotal} sellos`;
        pillEl.classList.toggle('complete', stampsCount === cardTotal);
    }

    // Render stamps grid
    renderSellerGrid(card.stamps || new Array(cardTotal).fill(false), cardTotal, rewards);
    updateSellerProgress(stampsCount, cardTotal);

    // Render customer rewards panel for seller
    renderSellerClientRewards(card);

    // Check reward milestones
    const hitReward = rewards.find(r => r.stamps === stampsCount);
    if (hitReward) {
        const overlay = document.getElementById('rewardOverlay');
        if (overlay && !overlay.classList.contains('visible') && !overlay.dataset.dismissed) {
            const earned = getEffectiveEarnedRewards(card);
            const matchingReward = earned.find(e => e.stampMilestone === hitReward.stamps && e.status === 'pending');
            showRewardOverlay(displayName, hitReward.description, matchingReward ? matchingReward.id : null);
        }
    }
}

function renderSellerGrid(stampsArray, cardTotal, rewards) {
    const total = cardTotal || TOTAL_STAMPS;
    const rewardsList = rewards || currentRewards;
    const grid = document.getElementById('stampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < total; i++) {
        const isLast = i === total - 1;
        const isStamped = !!stampsArray[i];
        const stampNum = i + 1;
        const rewardAtThis = rewardsList.find(r => r.stamps === stampNum);
        const isRewardSlot = !!rewardAtThis || isLast;

        const slot = document.createElement('div');
        slot.className = `stamp-slot ${isStamped ? 'stamped' : ''} ${isRewardSlot ? 'reward-slot' : ''}`;
        slot.id = `seller-stamp-${stampNum}`;
        slot.title = isStamped
            ? `Sello ${stampNum} (marcado — clic para desmarcar)`
            : `Sello ${stampNum} (clic para marcar)${rewardAtThis ? ' 🎁 ' + rewardAtThis.description : ''}`;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'stamp-number';
        numberSpan.textContent = isRewardSlot ? '🎁' : stampNum;
        slot.appendChild(numberSpan);

        slot.addEventListener('click', () => toggleStamp(i));
        grid.appendChild(slot);
    }
}

async function toggleStamp(index) {
    const card = getActiveSellerCard();
    if (!card) return;

    const cardTotal = getCardTotalStamps(card);
    const rewards = getCardRewards(card);
    const currentStamps = [...(card.stamps || new Array(cardTotal).fill(false))];
    const willBeStamped = !currentStamps[index];
    currentStamps[index] = willBeStamped;

    const count = currentStamps.filter(Boolean).length;
    let earnedRewards = getEffectiveEarnedRewards(card);
    let newlyEarnedReward = null;

    // Check all rewards milestones reached
    rewards.forEach(r => {
        if (count >= r.stamps) {
            const alreadyExists = earnedRewards.some(er => er.stampMilestone === r.stamps);
            if (!alreadyExists) {
                const newEntry = {
                    id: 'rew_' + Date.now() + '_' + r.stamps + '_' + Math.random().toString(36).substr(2, 4),
                    stampMilestone: r.stamps,
                    description: r.description,
                    status: 'pending',
                    earnedAt: new Date().toISOString(),
                    claimedAt: null
                };
                earnedRewards.push(newEntry);
                if (count === r.stamps) {
                    newlyEarnedReward = newEntry;
                }
            }
        }
    });

    // If unchecking a stamp and count dropped below milestone,
    // remove pending reward for that milestone if not yet claimed
    if (!willBeStamped) {
        earnedRewards = earnedRewards.filter(er => {
            if (er.status === 'claimed') return true;
            return count >= er.stampMilestone;
        });
    }

    // Optimistic local update
    card.stamps = currentStamps;
    card.earnedRewards = earnedRewards;
    renderActiveSellerCard();

    if (newlyEarnedReward) {
        showRewardOverlay(card.clientName, newlyEarnedReward.description, newlyEarnedReward.id);
    }

    // Persist to Firestore
    try {
        await saveCardStamps(card.id, currentStamps, earnedRewards);
    } catch (err) {
        console.error('Error al guardar sello:', err);
    }
}

function updateSellerProgress(count, cardTotal) {
    const total = cardTotal || TOTAL_STAMPS;
    const percentage = Math.round((count / total) * 100);

    const countEl = document.getElementById('stampCount');
    const fillEl = document.getElementById('progressFill');
    const textEl = document.getElementById('progressText');
    const cardEl = document.getElementById('stampCard');

    if (countEl) {
        countEl.textContent = `${count} / ${total}`;
        countEl.classList.toggle('complete', count === total);
    }

    if (fillEl) {
        fillEl.style.width = `${percentage}%`;
    }

    if (textEl) {
        textEl.textContent = `${percentage}% completado`;
    }

    if (cardEl) {
        cardEl.classList.toggle('complete', count === total);
    }
}

function showRewardOverlay(clientName, rewardDescription, rewardId) {
    currentOverlayRewardId = rewardId || null;
    const overlay = document.getElementById('rewardOverlay');
    const subtitle = document.getElementById('rewardSubtitle');
    const rewardBadgeText = document.getElementById('rewardBadgeText');
    if (!overlay) return;

    if (subtitle && clientName) {
        subtitle.textContent = `${clientName} ha desbloqueado una recompensa`;
    }
    if (rewardBadgeText) {
        rewardBadgeText.textContent = rewardDescription || 'Premio especial';
    }

    delete overlay.dataset.dismissed;
    overlay.classList.add('visible');
    launchConfetti();
}

async function handleClaimFromModal() {
    const card = getActiveSellerCard();
    if (!card) return closeReward();

    if (currentOverlayRewardId) {
        await handleSellerMarkClaimed(currentOverlayRewardId);
    } else {
        const earned = getEffectiveEarnedRewards(card);
        const pending = earned.find(r => r.status === 'pending');
        if (pending) {
            await handleSellerMarkClaimed(pending.id);
        }
    }
    closeReward();
}

function claimReward() {
    return handleClaimFromModal();
}

function closeReward() {
    const overlay = document.getElementById('rewardOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.dataset.dismissed = 'true';
    }
}

function getEffectiveEarnedRewards(card) {
    if (!card) return [];
    let earned = Array.isArray(card.earnedRewards) ? [...card.earnedRewards] : [];
    const rewards = getCardRewards(card);
    const count = (card.stamps || []).filter(Boolean).length;

    // Backward compatibility for existing cards that reached milestones before this feature
    if (earned.length === 0 && count > 0) {
        rewards.forEach(r => {
            if (count >= r.stamps) {
                earned.push({
                    id: `rew_leg_${r.stamps}_${card.id ? card.id.substr(0, 6) : 'init'}`,
                    stampMilestone: r.stamps,
                    description: r.description,
                    status: 'pending',
                    earnedAt: new Date().toISOString(),
                    claimedAt: null
                });
            }
        });
    }
    return earned;
}

function renderSellerClientRewards(card) {
    const panel = document.getElementById('sellerRewardsPanel');
    const badge = document.getElementById('sellerRewardsCounterBadge');
    const alertBox = document.getElementById('sellerRewardsAlertBox');
    const list = document.getElementById('sellerRewardsList');
    const resetBtn = document.getElementById('resetClientCardBtn');
    const resetBtnLabel = document.getElementById('resetCardBtnLabel');
    if (!panel || !card) return;

    panel.style.display = 'flex';

    const earnedRewards = getEffectiveEarnedRewards(card);
    const pendingRewards = earnedRewards.filter(r => r.status === 'pending');
    const pendingCount = pendingRewards.length;

    if (badge) {
        badge.textContent = `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`;
        badge.classList.toggle('has-pending', pendingCount > 0);
    }

    if (alertBox) {
        alertBox.style.display = pendingCount > 0 ? 'flex' : 'none';
    }

    if (resetBtn) {
        if (pendingCount > 0) {
            resetBtn.classList.add('has-pending-rewards');
            resetBtn.title = `El cliente tiene ${pendingCount} recompensa(s) pendiente(s) por reclamar antes de poder iniciar una nueva tarjeta.`;
            if (resetBtnLabel) resetBtnLabel.textContent = `Nueva Tarjeta (${pendingCount} pend.)`;
        } else {
            resetBtn.classList.remove('has-pending-rewards');
            resetBtn.title = 'Iniciar nueva tarjeta de sellos para este cliente';
            if (resetBtnLabel) resetBtnLabel.textContent = 'Nueva Tarjeta';
        }
    }

    if (!list) return;
    list.innerHTML = '';

    if (earnedRewards.length === 0) {
        list.innerHTML = `
            <div class="seller-rewards-empty">
                <span>🎁 Este cliente aún no tiene recompensas acumuladas. Se desbloquearán al sumar sellos.</span>
            </div>
        `;
        return;
    }

    // Sort: pending first, then by milestone descending
    const sorted = [...earnedRewards].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.stampMilestone || 0) - (a.stampMilestone || 0);
    });

    sorted.forEach(r => {
        const isClaimed = r.status === 'claimed';
        const item = document.createElement('div');
        item.className = `seller-reward-item ${isClaimed ? 'claimed' : 'pending'}`;

        const dateStr = r.claimedAt 
            ? `Reclamada: ${new Date(r.claimedAt).toLocaleDateString()}`
            : (r.earnedAt ? `Desbloqueada: ${new Date(r.earnedAt).toLocaleDateString()}` : '');

        item.innerHTML = `
            <div class="seller-reward-item-left">
                <span class="seller-reward-icon">🎁</span>
                <div class="seller-reward-item-info">
                    <div class="seller-reward-title-row">
                        <span class="seller-reward-desc">${escapeHtml(r.description)}</span>
                        <span class="seller-reward-milestone">Sello ${r.stampMilestone}</span>
                    </div>
                    <div class="seller-reward-meta">
                        <span class="seller-reward-status-pill ${r.status}">
                            ${isClaimed ? '✓ Reclamada' : '⏳ Pendiente'}
                        </span>
                        ${dateStr ? `<span class="seller-reward-date">${dateStr}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="seller-reward-item-actions">
                ${!isClaimed ? `
                    <button class="seller-claim-btn" onclick="handleSellerMarkClaimed('${r.id}')" title="Marcar como entregada al cliente">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Marcar Reclamada</span>
                    </button>
                ` : `
                    <div class="seller-claimed-group">
                        <span class="seller-claimed-badge">
                            ✓ Entregada
                        </span>
                        <button class="seller-unclaim-btn" onclick="handleSellerUnmarkClaimed('${r.id}')" title="Anular entrega y volver a marcar como pendiente">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                <path d="M3 3v5h5"/>
                            </svg>
                            <span>Anular entrega</span>
                        </button>
                    </div>
                `}
            </div>
        `;
        list.appendChild(item);
    });
}

async function handleSellerMarkClaimed(rewardId) {
    const card = getActiveSellerCard();
    if (!card || !rewardId) return;

    let earned = getEffectiveEarnedRewards(card);
    const target = earned.find(r => r.id === rewardId);
    if (!target) return;

    target.status = 'claimed';
    target.claimedAt = new Date().toISOString();
    card.earnedRewards = earned;

    renderActiveSellerCard();

    try {
        await markCardRewardClaimed(card.id, rewardId);
    } catch (err) {
        console.error('Error al marcar recompensa:', err);
        alert('Hubo un error al actualizar la recompensa');
    }
}

async function handleSellerUnmarkClaimed(rewardId) {
    const card = getActiveSellerCard();
    if (!card || !rewardId) return;

    let earned = getEffectiveEarnedRewards(card);
    const target = earned.find(r => r.id === rewardId);
    if (!target) return;

    target.status = 'pending';
    target.claimedAt = null;
    card.earnedRewards = earned;

    renderActiveSellerCard();

    try {
        await unmarkCardRewardClaimed(card.id, rewardId);
    } catch (err) {
        console.error('Error al anular reclamo de recompensa:', err);
        alert('Hubo un error al anular la entrega');
    }
}

async function handleResetClientCard() {
    const card = getActiveSellerCard();
    if (!card) return;

    const earned = getEffectiveEarnedRewards(card);
    const pending = earned.filter(r => r.status === 'pending');

    // RULE: All rewards must be claimed before obtaining a new card!
    if (pending.length > 0) {
        alert(
            `⚠️ ATENCIÓN: El cliente tiene ${pending.length} recompensa(s) PENDIENTE(S) por reclamar:\n\n` +
            pending.map(p => `• ${p.description} (Sello ${p.stampMilestone})`).join('\n') +
            `\n\nDebes marcarlas como "Reclamadas" antes de poder entregarle o iniciar una nueva tarjeta.`
        );
        const panel = document.getElementById('sellerRewardsPanel');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
    }

    const clientName = card.clientName || card.clientEmail || 'el cliente';
    if (!confirm(`¿Deseas iniciar una nueva tarjeta de sellos para ${clientName}?\n\nTodas las recompensas de la tarjeta actual ya han sido reclamadas. Los sellos volverán a 0 para comenzar un nuevo ciclo.`)) {
        return;
    }

    const cardTotal = getCardTotalStamps(card);

    // Optimistic update
    const emptyStamps = new Array(cardTotal).fill(false);
    card.stamps = emptyStamps;
    card.earnedRewards = [];
    renderActiveSellerCard();

    try {
        const res = await startNewCardCycle(card.id, cardTotal);
        if (res && !res.success) {
            alert(res.message || 'No se pudo reiniciar la tarjeta');
        }
    } catch (err) {
        console.error('Error al reiniciar tarjeta:', err);
        alert('Error al iniciar nueva tarjeta');
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
            totalStamps: currentTotalStamps,
            rewards: currentRewards,
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
    const cardTotal = getCardTotalStamps(card);
    const rewards = getCardRewards(card);
    const stamps = card.stamps || new Array(cardTotal).fill(false);
    const count = stamps.filter(Boolean).length;
    const isComplete = count === cardTotal;

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
    if (titleEl) titleEl.textContent = businessName;
    if (subtitleEl) subtitleEl.textContent = `Tu progreso en ${businessName}`;

    if (countEl) {
        countEl.textContent = `${count} / ${cardTotal}`;
        countEl.classList.toggle('complete', isComplete);
    }

    const percentage = Math.round((count / cardTotal) * 100);
    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}% completado`;

    if (summaryCard) summaryCard.classList.toggle('complete', isComplete);
    if (summaryTitle) {
        if (isComplete) {
            summaryTitle.textContent = `¡Felicidades! Recompensa en ${businessName} desbloqueada 🎉`;
        } else if (count === 0) {
            summaryTitle.textContent = `¡Comienza a acumular sellos en ${businessName}!`;
        } else {
            summaryTitle.textContent = `¡Te faltan solo ${cardTotal - count} sellos en ${businessName}!`;
        }
    }

    // Render accumulated rewards banner
    const rewardBanner = document.getElementById('clientRewardBanner');
    const rewardsListEl = document.getElementById('clientRewardsAccumulatedList');
    const countBadge = document.getElementById('clientRewardCountBadge');
    const earnedRewards = getEffectiveEarnedRewards(card);
    const pendingCount = earnedRewards.filter(r => r.status === 'pending').length;

    if (rewardBanner) {
        const hasRewards = earnedRewards.length > 0;
        rewardBanner.classList.toggle('visible', hasRewards || isComplete);

        if (countBadge) {
            countBadge.textContent = `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`;
            countBadge.style.display = earnedRewards.length > 0 ? 'inline-block' : 'none';
        }

        if (rewardsListEl) {
            rewardsListEl.innerHTML = '';
            if (earnedRewards.length === 0) {
                rewardsListEl.innerHTML = `
                    <div class="client-reward-card pending">
                        <div class="client-reward-card-top-row">
                            <span class="client-reward-card-badge">RECOMPENSA FINAL</span>
                            <span class="client-reward-card-milestone">${cardTotal} sellos</span>
                        </div>
                        <div class="client-reward-card-body">
                            <div class="client-reward-card-icon">🎁</div>
                            <div class="client-reward-card-info">
                                <h4 class="client-reward-card-title">${escapeHtml(rewards[rewards.length - 1]?.description || 'Premio especial')}</h4>
                                <p class="client-reward-card-detail">¡Completa tu tarjeta para reclamar!</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                earnedRewards.forEach(r => {
                    const isClaimed = r.status === 'claimed';
                    const cardItem = document.createElement('div');
                    cardItem.className = `client-reward-card ${isClaimed ? 'claimed' : 'pending'}`;
                    cardItem.innerHTML = `
                        <div class="client-reward-card-top-row">
                            <span class="client-reward-card-badge">${isClaimed ? '✓ RECLAMADA' : 'DISPONIBLE PARA CANJE'}</span>
                            <span class="client-reward-card-milestone">Sello ${r.stampMilestone}</span>
                        </div>
                        <div class="client-reward-card-body">
                            <div class="client-reward-card-icon">🎁</div>
                            <div class="client-reward-card-info">
                                <h4 class="client-reward-card-title">${escapeHtml(r.description)}</h4>
                                <p class="client-reward-card-detail">Desbloqueado al alcanzar ${r.stampMilestone} sellos</p>
                            </div>
                        </div>
                        <div class="client-reward-card-status">
                            ${isClaimed ? `
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>Entregada por el encargado</span>
                            ` : `
                                <span class="pulse-dot"></span>
                                <span>Pendiente de entrega — ¡Pídelo al encargado!</span>
                            `}
                        </div>
                    `;
                    rewardsListEl.appendChild(cardItem);
                });
            }
        }
    }

    // Render read-only stamps grid
    const grid = document.getElementById('clientStampsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < cardTotal; i++) {
        const isLast = i === cardTotal - 1;
        const isStamped = !!stamps[i];
        const stampNum = i + 1;
        const rewardAtThis = rewards.find(r => r.stamps === stampNum);
        const isRewardSlot = !!rewardAtThis || isLast;

        const slot = document.createElement('div');
        slot.className = `stamp-slot client-stamp-slot ${isStamped ? 'stamped' : ''} ${isRewardSlot ? 'reward-slot' : ''}`;
        slot.id = `client-stamp-${stampNum}`;
        if (rewardAtThis) slot.title = rewardAtThis.description;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'stamp-number';
        numberSpan.textContent = isRewardSlot ? '🎁' : stampNum;
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

// Close modals & dropdowns on Escape or outside click
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCardSettingsModal();
        closeAddClientModal();
        closeRewardSettingsModal();
        closeClientDropdown();
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
    const rewardSettingsOverlay = document.getElementById('rewardSettingsOverlay');
    if (rewardSettingsOverlay && e.target === rewardSettingsOverlay) {
        closeRewardSettingsModal();
    }

    // Close client search dropdown if clicked outside
    const dropdown = document.getElementById('sellerSearchableDropdown');
    if (dropdown && dropdown.classList.contains('open')) {
        if (!dropdown.contains(e.target)) {
            closeClientDropdown();
        }
    }
});

// ===================================
// REWARD SETTINGS MODAL
// ===================================

const STAMP_COUNT_OPTIONS = [5, 6, 7, 8, 9, 10, 12, 15, 20];

function updateRewardConfigPill() {
    const pillLabel = document.getElementById('rewardConfigPillLabel');
    if (!pillLabel) return;
    const rewardCount = currentRewards.length;
    pillLabel.textContent = `${currentTotalStamps} sellos · ${rewardCount} ${rewardCount === 1 ? 'premio' : 'premios'}`;
}

function openRewardSettingsModal() {
    const overlay = document.getElementById('rewardSettingsOverlay');
    const feedback = document.getElementById('rewardSettingsFeedback');
    if (feedback) { feedback.textContent = ''; feedback.className = 'settings-feedback'; }

    tempTotalStamps = currentTotalStamps;
    tempRewards = currentRewards.map(r => ({ ...r }));

    renderStampCountSelector();
    renderRewardsList();

    if (overlay) {
        overlay.classList.add('visible');
    }
}

function closeRewardSettingsModal() {
    const overlay = document.getElementById('rewardSettingsOverlay');
    if (overlay) overlay.classList.remove('visible');
}

function renderStampCountSelector() {
    const container = document.getElementById('stampCountSelector');
    if (!container) return;
    container.innerHTML = '';

    STAMP_COUNT_OPTIONS.forEach(n => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `stamp-count-pill ${n === tempTotalStamps ? 'active' : ''}`;
        btn.textContent = n;
        btn.title = `${n} sellos`;
        btn.addEventListener('click', () => {
            tempTotalStamps = n;
            renderStampCountSelector();
            // Update hint
            const hint = document.getElementById('stampCountHint');
            if (hint) hint.textContent = `Los clientes necesitarán ${n} sellos para completar la tarjeta.`;
            // Clamp rewards that exceed the new total
            tempRewards = tempRewards.map(r => ({ ...r, stamps: Math.min(r.stamps, n) }));
            renderRewardsList();
        });
        container.appendChild(btn);
    });
}

function renderRewardsList() {
    const list = document.getElementById('rewardsList');
    if (!list) return;
    list.innerHTML = '';

    if (tempRewards.length === 0) {
        list.innerHTML = `<p class="rewards-list-empty">No hay premios configurados. Agrega al menos uno.</p>`;
        return;
    }

    tempRewards.forEach((reward, idx) => {
        const row = document.createElement('div');
        row.className = 'reward-row';

        const stampOptions = Array.from({ length: tempTotalStamps }, (_, i) => i + 1)
            .map(n => `<option value="${n}" ${n === reward.stamps ? 'selected' : ''}>${n} ${n === 1 ? 'sello' : 'sellos'}</option>`)
            .join('');

        row.innerHTML = `
            <div class="reward-row-stamp-select">
                <label class="reward-row-label">Al sello #</label>
                <select class="reward-stamp-select" data-idx="${idx}">
                    ${stampOptions}
                </select>
            </div>
            <input type="text" class="reward-desc-input form-input" data-idx="${idx}" placeholder="Descripción del premio..." value="${escapeHtml(reward.description)}" maxlength="80">
            <button type="button" class="reward-row-delete-btn" data-idx="${idx}" title="Eliminar premio">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        // Events
        row.querySelector('.reward-stamp-select').addEventListener('change', (e) => {
            tempRewards[idx].stamps = parseInt(e.target.value);
        });
        row.querySelector('.reward-desc-input').addEventListener('input', (e) => {
            tempRewards[idx].description = e.target.value;
        });
        row.querySelector('.reward-row-delete-btn').addEventListener('click', () => {
            tempRewards.splice(idx, 1);
            renderRewardsList();
        });

        list.appendChild(row);
    });
}

function addRewardRow() {
    const defaultStamp = Math.min(tempTotalStamps, tempRewards.length > 0
        ? Math.max(...tempRewards.map(r => r.stamps)) + 1
        : Math.ceil(tempTotalStamps / 2));
    const clampedStamp = Math.min(defaultStamp, tempTotalStamps);
    tempRewards.push({ stamps: clampedStamp, description: '' });
    renderRewardsList();
}

async function handleSaveRewardSettings(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('saveRewardSettingsBtn');
    const feedback = document.getElementById('rewardSettingsFeedback');

    // Validate rewards
    for (const r of tempRewards) {
        if (!r.description.trim()) {
            if (feedback) {
                feedback.textContent = 'Todos los premios deben tener una descripción.';
                feedback.className = 'settings-feedback error';
            }
            return;
        }
        if (r.stamps < 1 || r.stamps > tempTotalStamps) {
            if (feedback) {
                feedback.textContent = `El sello de cada premio debe ser entre 1 y ${tempTotalStamps}.`;
                feedback.className = 'settings-feedback error';
            }
            return;
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Guardando...';
    }

    try {
        await saveRewardSettings({
            totalStamps: tempTotalStamps,
            rewards: tempRewards
        });

        currentTotalStamps = tempTotalStamps;
        TOTAL_STAMPS = currentTotalStamps;
        currentRewards = tempRewards.map(r => ({ ...r }));

        updateRewardConfigPill();

        if (feedback) {
            feedback.textContent = '✓ ¡Premios guardados exitosamente!';
            feedback.className = 'settings-feedback success';
        }

        // Re-render the active card with the new config
        if (selectedCardId) renderActiveSellerCard();

        setTimeout(() => closeRewardSettingsModal(), 650);

    } catch (err) {
        console.error('Error guardando premios:', err);
        if (feedback) {
            feedback.textContent = 'Error al guardar. Revisa la conexión.';
            feedback.className = 'settings-feedback error';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Guardar Premios';
        }
    }
}
