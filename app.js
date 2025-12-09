const API_BASE = 'https://data-api.polymarket.com';
let currentOffset = 0;
let currentAddress = '';
const LIMIT = 20;

async function fetchTrades() {
    const addressInput = document.getElementById('walletAddress');
    const address = addressInput.value.trim();
    
    if (!address) {
        showError('Please enter a wallet address');
        return;
    }
    
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        showError('Invalid wallet address format');
        return;
    }
    
    currentAddress = address;
    currentOffset = 0;
    
    showLoading(true);
    hideError();
    
    try {
        const trades = await getTrades(address, 0);
        renderTrades(trades, false);
        document.getElementById('loadMore').style.display = trades.length >= LIMIT ? 'block' : 'none';
    } catch (error) {
        showError('Failed to fetch trades: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function loadMoreTrades() {
    currentOffset += LIMIT;
    showLoading(true);
    
    try {
        const trades = await getTrades(currentAddress, currentOffset);
        renderTrades(trades, true);
        document.getElementById('loadMore').style.display = trades.length >= LIMIT ? 'block' : 'none';
    } catch (error) {
        showError('Failed to load more trades: ' + error.message);
        currentOffset -= LIMIT;
    } finally {
        showLoading(false);
    }
}

async function getTrades(address, offset) {
    const url = `${API_BASE}/trades?user=${address}&limit=${LIMIT}&offset=${offset}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }
    
    return await response.json();
}

function renderTrades(trades, append) {
    const container = document.getElementById('tradesContainer');
    
    if (!append) {
        container.innerHTML = '';
    }
    
    if (trades.length === 0 && !append) {
        container.innerHTML = '<div class="empty-state">No trades found for this address</div>';
        return;
    }
    
    trades.forEach(trade => {
        const tradeEl = createTradeElement(trade);
        container.appendChild(tradeEl);
    });
}

function createTradeElement(trade) {
    const div = document.createElement('div');
    div.className = 'trade-row';
    
    // --- Activity Logic ---
    // The API returns 'side' as BUY or SELL. 
    // We map this to 'Bought' / 'Sold'.
    // Note: 'Claimed' is not in standard trades endpoint usually, but we'll stick to what we have.
    const isBuy = trade.side === 'BUY';
    const activityLabel = isBuy ? 'Bought' : 'Sold';
    
    // Icons
    let activityIconSvg = '';
    let activityIconClass = '';
    
    if (activityLabel === 'Claimed') {
        // Placeholder for future logic if we can detect claims
        activityIconClass = 'icon-claimed';
        activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (activityLabel === 'Bought') {
        activityIconClass = 'icon-bought';
        activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    } else { // Sold
        activityIconClass = 'icon-sold';
        activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }

    // --- Market Logic ---
    const marketTitle = trade.title || 'Unknown Market';
    const marketUrl = trade.eventSlug 
        ? `https://polymarket.com/event/${trade.eventSlug}` 
        : (trade.slug ? `https://polymarket.com/event/${trade.slug}` : '#');
    
    const iconSrc = trade.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f3f4f6" width="40" height="40"/></svg>';

    // Outcome Badge
    const outcomeText = trade.outcome || 'N/A';
    const outcomeClass = outcomeText.toLowerCase() === 'yes' ? 'badge-yes' : 'badge-no';
    
    // Shares & Price
    const shares = trade.size?.toFixed(1) || '0.0';
    const priceCents = (trade.price * 100).toFixed(0);

    // --- Value Logic ---
    // Value = Price * Size. 
    // If Bought, usually negative cash flow in activity view? 
    // Checking screenshot: "Bought ... -$1.14". "Claimed ... +$10.00".
    // So Bought is negative, Sold is positive.
    const rawValue = trade.size * trade.price;
    const valueSign = isBuy ? '-' : '+';
    const valueClass = isBuy ? 'val-neg' : 'val-pos'; // Bought is cost (black/red), Sold is income (green)
    const formattedValue = `${valueSign}$${rawValue.toFixed(2)}`;

    // Time
    const timestamp = formatTime(trade.timestamp);

    div.innerHTML = `
        <div class="cell-activity">
            <div class="activity-icon-wrapper ${activityIconClass}">
                ${activityIconSvg}
            </div>
            <span class="activity-label">${activityLabel}</span>
        </div>
        
        <div class="cell-market">
            <img class="market-icon" src="${escapeHtml(iconSrc)}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23f3f4f6%22 width=%2240%22 height=%2240%22/></svg>'">
            <div class="market-content">
                <a href="${escapeHtml(marketUrl)}" class="market-title" target="_blank">${escapeHtml(marketTitle)}</a>
                <div class="market-sub">
                    <span class="outcome-badge ${outcomeClass}">${escapeHtml(outcomeText)} ${priceCents}¢</span>
                    <span>${shares} shares</span>
                </div>
            </div>
        </div>
        
        <div class="cell-value">
            <span class="value-amount ${valueClass}">${formattedValue}</span>
            <span class="time-ago">${timestamp}</span>
        </div>
    `;
    
    return div;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    const searchBtn = document.getElementById('searchBtn'); // Search is now implicit via enter, but input exists
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

// Allow pressing Enter to search
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('walletAddress').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchTrades();
        }
    });
});
