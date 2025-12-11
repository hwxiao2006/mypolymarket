const API_BASE = 'https://data-api.polymarket.com';
let currentOffset = 0;
let currentAddress = '';
const LIMIT = 20;
let activeTab = 'positions'; // Default tab

async function handleSearch() {
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
    hideError();
    showLoading(true);

    try {
        if (activeTab === 'positions') {
            await fetchPositions(address);
        } else if (activeTab === 'history') {
            currentOffset = 0;
            await fetchTrades(address);
        } else {
            // Open orders
            showLoading(false);
        }
    } catch (error) {
        showError('Failed to fetch data: ' + error.message);
        showLoading(false);
    }
}

async function fetchPositions(address) {
    // Note: Endpoint might be different, trying common pattern
    const url = `${API_BASE}/positions?user=${address}`; 
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }
    
    const positions = await response.json();
    
    // 打印详细的数据结构信息用于调试
    console.log("Full positions data:", positions);
    
    // 过滤未关闭的持仓
    // 根据API文档和常见逻辑判断持仓是否关闭
    const openPositions = positions.filter(position => {
        // 判断条件：
        // 1. 持仓数量大于0
        // 2. 当前价值大于0（可选）
        // 3. 如果有endDate字段，且未过期
        const now = new Date();
        const endDate = position.endDate ? new Date(position.endDate) : null;
        const isExpired = endDate && endDate < now;
        
        return position.size > 0 && !isExpired;
    });
    
    console.log("Open positions:", openPositions);
    renderPositions(openPositions);
    showLoading(false);
}

function renderPositions(positions) {
    const container = document.getElementById('positionsContainer');
    container.innerHTML = '';
    
    if (!positions || positions.length === 0) {
        container.innerHTML = '<div class="empty-state">No open positions found</div>';
        return;
    }
    
    // Calculate totals
    let totalBet = 0;
    let totalToWin = 0;
    let totalValue = 0;
    
    positions.forEach(pos => {
        const size = parseFloat(pos.size || 0);
        const avgPrice = parseFloat(pos.avgPrice || pos.buyPrice || 0);
        const currentPrice = parseFloat(pos.curPrice || pos.currentPrice || pos.price || avgPrice);
        
        totalBet += size * avgPrice;
        totalToWin += size;
        totalValue += size * currentPrice;
        
        const el = createPositionElement(pos);
        container.appendChild(el);
    });
    
    // Add totals row
    const totalPnl = totalValue - totalBet;
    const totalPnlPercent = totalBet > 0 ? (totalPnl / totalBet) * 100 : 0;
    const pnlClass = totalPnl >= 0 ? 'pnl-pos' : 'pnl-neg';
    const pnlSign = totalPnl >= 0 ? '+' : '-';
    
    const totalsRow = document.createElement('div');
    totalsRow.className = 'position-row totals-row';
    totalsRow.innerHTML = `
        <div class="cell-market">
            <div class="market-content">
                <span class="totals-label">Total</span>
            </div>
        </div>
        <div class="price-change-cell"></div>
        <div class="money-cell totals-value cell-total-bet">$${totalBet.toFixed(2)}</div>
        <div class="money-cell totals-value cell-total-towin">$${totalToWin.toFixed(2)}</div>
        <div class="value-cell-group">
            <div class="money-cell totals-value">$${totalValue.toFixed(2)}</div>
            <div class="pnl-text ${pnlClass}">${pnlSign}$${Math.abs(totalPnl).toFixed(2)} (${Math.abs(totalPnlPercent).toFixed(2)}%)</div>
        </div>
        <div class="pos-actions"></div>
    `;
    container.appendChild(totalsRow);
}

function createPositionElement(pos) {
    const div = document.createElement('div');
    div.className = 'position-row';
    
    // Data extraction (guessing fields based on typical API)
    // Adjust fields if API response differs
    const title = pos.title || pos.market?.question || 'Unknown Market';
    const outcome = pos.outcome || 'Yes'; // or 'No'
    const outcomeClass = outcome.toLowerCase() === 'yes' ? 'badge-yes' : 'badge-no';
    const size = parseFloat(pos.size || 0);
    const avgPrice = parseFloat(pos.avgPrice || pos.buyPrice || 0); // Avg entry
    const currentPrice = parseFloat(pos.curPrice || pos.currentPrice || pos.price || avgPrice); // Current market price
    
    const bet = size * avgPrice;
    const value = size * currentPrice;
    const toWin = size; // If price goes to $1, value is size * $1 = size
    
    const pnl = value - bet;
    const pnlPercent = bet > 0 ? (pnl / bet) * 100 : 0;
    const pnlClass = pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
    const pnlSign = pnl >= 0 ? '+' : '-';
    
    const iconSrc = pos.icon || pos.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f3f4f6" width="40" height="40"/></svg>';
    const marketUrl = pos.slug ? `https://polymarket.com/event/${pos.slug}` : '#';

    div.innerHTML = `
        <div class="cell-market">
            <img class="market-icon" src="${escapeHtml(iconSrc)}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23f3f4f6%22 width=%2240%22 height=%2240%22/></svg>'">
            <div class="market-content">
                <a href="${escapeHtml(marketUrl)}" class="market-title" target="_blank">${escapeHtml(title)}</a>
                <div class="market-sub">
                    <span class="outcome-badge ${outcomeClass}">${escapeHtml(outcome)} ${Math.round(currentPrice * 100)}¢</span>
                    <span>${size.toFixed(1)} shares</span>
                </div>
            </div>
        </div>
        
        <div class="price-change-cell">
            <span>${Math.round(avgPrice * 100)}¢</span>
            <span class="price-arrow">→</span>
            <span>${Math.round(currentPrice * 100)}¢</span>
        </div>
        
        <div class="money-cell">$${bet.toFixed(2)}</div>
        
        <div class="money-cell">$${toWin.toFixed(2)}</div>
        
        <div class="value-cell-group">
            <div class="money-cell">$${value.toFixed(2)}</div>
            <div class="pnl-text ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)} (${Math.abs(pnlPercent).toFixed(2)}%)</div>
        </div>
        
        <div class="pos-actions">
            <button class="btn-sell">Sell</button>
            <button class="btn-share">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
        </div>
    `;
    return div;
}

// Renamed from fetchTrades to be specific, but keeping old function for History tab
async function fetchTrades(address) {
    currentOffset = 0;
    showLoading(true);
    try {
        let trades = await getTrades(address, 0);
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
        let trades = await getTrades(currentAddress, currentOffset);
        
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
    const params = new URLSearchParams();
    params.append('user', address);
    params.append('limit', LIMIT);
    params.append('offset', offset);
    
    if (dpState.startDate && dpState.endDate) {
        const startTime = Math.floor(dpState.startDate.getTime() / 1000);
        const endTime = Math.floor(dpState.endDate.getTime() / 1000) + 86399;
        params.append('start', startTime);
        params.append('end', endTime);
    }
    
    const url = `${API_BASE}/activity?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }
    
    let activities = await response.json();
    
    // 首次加载时补充REDEEM的outcome信息和获取LOST记录
    if (offset === 0) {
        // 先从activity数据本身创建conditionId到outcome的映射（从TRADE记录）
        const tradeOutcomeMap = {};
        activities.forEach(a => {
            if (a.type === 'TRADE' && a.outcome && a.conditionId) {
                tradeOutcomeMap[a.conditionId] = {
                    outcome: a.outcome,
                    price: a.price
                };
            }
        });
        
        // 找出需要补充outcome的REDEEM记录的conditionId
        const missingOutcomeIds = activities
            .filter(a => (a.type === 'REDEEM' || a.type === 'CLAIM') && !a.outcome && a.conditionId)
            .filter(a => !tradeOutcomeMap[a.conditionId])
            .map(a => a.conditionId);
        
        // 如果有缺失的outcome，获取更多历史activity来查找
        if (missingOutcomeIds.length > 0) {
            try {
                const historyUrl = `${API_BASE}/activity?user=${address}&limit=200`;
                const historyResp = await fetch(historyUrl);
                if (historyResp.ok) {
                    const historyData = await historyResp.json();
                    historyData.forEach(a => {
                        if (a.type === 'TRADE' && a.outcome && a.conditionId && missingOutcomeIds.includes(a.conditionId)) {
                            tradeOutcomeMap[a.conditionId] = {
                                outcome: a.outcome,
                                price: a.price
                            };
                        }
                    });
                }
            } catch (e) {}
        }
        
        // 补充REDEEM记录的outcome信息
        activities.forEach(a => {
            if ((a.type === 'REDEEM' || a.type === 'CLAIM') && !a.outcome && a.conditionId) {
                const trade = tradeOutcomeMap[a.conditionId];
                if (trade) {
                    a.outcome = trade.outcome;
                    a.price = trade.price || a.price;
                }
            }
        });
        
        try {
            let closedUrl = `${API_BASE}/closed-positions?user=${address}&limit=100&sortBy=REALIZEDPNL&sortDirection=ASC`;
            const closedResp = await fetch(closedUrl);
            if (closedResp.ok) {
                const closedPositions = await closedResp.json();
                
                // 对于还没有outcome的REDEEM，尝试从closed-positions获取
                const positionMap = {};
                closedPositions.forEach(p => {
                    positionMap[p.conditionId] = {
                        outcome: p.outcome,
                        avgPrice: p.avgPrice
                    };
                });
                
                activities.forEach(a => {
                    if ((a.type === 'REDEEM' || a.type === 'CLAIM') && !a.outcome && a.conditionId) {
                        const pos = positionMap[a.conditionId];
                        if (pos) {
                            a.outcome = pos.outcome;
                            a.price = pos.avgPrice || a.price;
                        }
                    }
                });
                
                // realizedPnl为负数表示输了，添加LOST记录
                const lostOrders = closedPositions.filter(p => {
                    const pnl = parseFloat(p.realizedPnl || 0);
                    return pnl < 0;
                }).map(p => {
                    let ts = Math.floor(Date.now() / 1000);
                    if (p.endDate) {
                        const d = new Date(p.endDate);
                        ts = Math.floor(d.getTime() / 1000);
                    }
                    
                    return {
                        type: 'LOST',
                        title: p.title || 'Unknown Market',
                        icon: p.icon,
                        eventSlug: p.eventSlug || p.slug,
                        outcome: p.outcome,
                        size: p.totalBought || 0,
                        usdcSize: Math.abs(p.realizedPnl || 0),
                        price: p.avgPrice || 0,
                        timestamp: ts,
                        conditionId: p.conditionId
                    };
                });
                
                // 去重：如果activities里已经有相同conditionId且类型为REDEEM/CLAIM/LOST的记录，则不添加
                // 另外，lostOrders本身也可能包含重复的conditionId（如果API返回了重复数据），虽然不太可能，但最好也处理一下
                const existingConditionIds = new Set(
                    activities
                        .filter(a => a.conditionId && (a.type === 'REDEEM' || a.type === 'CLAIM' || a.type === 'LOST'))
                        .map(a => a.conditionId)
                );
                
                // 过滤掉已经存在的记录
                const uniqueLostOrders = lostOrders.filter(o => !existingConditionIds.has(o.conditionId));
                
                // 日期过滤（如果设置了）
                if (dpState.startDate && dpState.endDate) {
                    const startTime = Math.floor(dpState.startDate.getTime() / 1000);
                    const endTime = Math.floor(dpState.endDate.getTime() / 1000) + 86399;
                    const filteredLost = uniqueLostOrders.filter(o => o.timestamp >= startTime && o.timestamp <= endTime);
                    activities = [...activities, ...filteredLost];
                } else {
                    activities = [...activities, ...uniqueLostOrders];
                }
                
                // 按时间排序（最新的在前）
                activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
        } catch (e) {
            // 静默处理错误
        }
    }
    
    return activities;
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
    // 支持多种活动类型: TRADE, REDEEM, CLAIM, MERGE, SPLIT, REWARD, CONVERSION
    const activityType = trade.type || 'TRADE';
    let activityLabel = '';
    let activityIconSvg = '';
    let activityIconClass = '';
    let isPositiveValue = false; // 是否为正向现金流
    
    switch(activityType) {
        case 'TRADE':
            const isBuy = trade.side === 'BUY';
            const tradePrice = parseFloat(trade.price || 0);
            // 如果是SELL且价格接近0（<0.05），视为"输"了（止损卖出）
            const isLostSell = !isBuy && tradePrice < 0.05;
            
            if (isLostSell) {
                activityLabel = 'Lost';
                isPositiveValue = false;
                activityIconClass = 'icon-lost';
                activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            } else if (isBuy) {
                activityLabel = 'Bought';
                isPositiveValue = false;
                activityIconClass = 'icon-bought';
                activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            } else {
                activityLabel = 'Sold';
                isPositiveValue = true;
                activityIconClass = 'icon-sold';
                activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            }
            break;
        case 'REDEEM':
        case 'CLAIM':
            // 根据usdcSize判断是赢了(Claimed)还是输了(Lost)
            // usdcSize > 0 表示赢了（拿回了钱），= 0 表示输了
            const redeemAmount = parseFloat(trade.usdcSize || 0);
            if (redeemAmount > 0) {
                activityLabel = 'Claimed';
                isPositiveValue = true;
                activityIconClass = 'icon-claimed';
                activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            } else {
                activityLabel = 'Lost';
                isPositiveValue = false;
                activityIconClass = 'icon-lost';
                activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            }
            break;
        case 'MERGE':
            activityLabel = 'Merged';
            isPositiveValue = true;
            activityIconClass = 'icon-merge';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v12M16 6v12M8 12h8"></path></svg>`;
            break;
        case 'SPLIT':
            activityLabel = 'Split';
            isPositiveValue = false;
            activityIconClass = 'icon-split';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v18M8 3v18M8 12h8"></path></svg>`;
            break;
        case 'REWARD':
            activityLabel = 'Reward';
            isPositiveValue = true;
            activityIconClass = 'icon-reward';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            break;
        case 'CONVERSION':
            activityLabel = 'Converted';
            isPositiveValue = true;
            activityIconClass = 'icon-conversion';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
            break;
        case 'LOST':
        case 'LOSS':
        case 'EXPIRE':
        case 'EXPIRED':
            activityLabel = 'Lost';
            isPositiveValue = false;
            activityIconClass = 'icon-lost';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            break;
        default:
            activityLabel = activityType;
            activityIconClass = 'icon-default';
            activityIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`;
    }

    // --- Market Logic ---
    const marketTitle = trade.title || 'Unknown Market';
    const marketUrl = trade.eventSlug 
        ? `https://polymarket.com/event/${trade.eventSlug}` 
        : (trade.slug ? `https://polymarket.com/event/${trade.slug}` : '#');
    
    const iconSrc = trade.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f3f4f6" width="40" height="40"/></svg>';

    // Outcome Badge
    const outcomeText = trade.outcome || '';
    const outcomeClass = outcomeText.toLowerCase() === 'yes' ? 'badge-yes' : 'badge-no';
    
    // Shares & Price
    const shares = (trade.size || trade.usdcSize || 0).toFixed(1);
    const price = trade.price || 0;
    const priceCents = (price * 100).toFixed(0);
    
    // 只有当有outcome时才显示badge
    const showOutcomeBadge = !!outcomeText;

    // --- Value Logic ---
    let rawValue;
    if (activityType === 'REDEEM' || activityType === 'CLAIM') {
        // REDEEM类型直接使用usdcSize
        rawValue = parseFloat(trade.usdcSize || 0);
    } else {
        rawValue = (trade.size || trade.usdcSize || trade.value || 0) * (price || 1);
    }
    const valueSign = isPositiveValue ? '+' : '-';
    const valueClass = isPositiveValue ? 'val-pos' : 'val-neg';
    const formattedValue = rawValue > 0 ? `${valueSign}$${rawValue.toFixed(2)}` : '-';

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
                    ${showOutcomeBadge ? `<span class="outcome-badge ${outcomeClass}">${escapeHtml(outcomeText)} ${priceCents}¢</span>` : ''}
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
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.disabled = show;
    const walletInput = document.getElementById('walletAddress');
    if (walletInput) walletInput.disabled = show;
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
            handleSearch();
        }
    });
    
    // Tab Switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            
            // UI Switching
            if (activeTab === 'positions') {
                document.getElementById('positionsView').style.display = 'block';
                document.getElementById('historyView').style.display = 'none';
                document.getElementById('positionsFilters').style.display = 'flex';
                document.getElementById('historyFilters').style.display = 'none';
                if(currentAddress) handleSearch();
            } else if (activeTab === 'history') {
                document.getElementById('positionsView').style.display = 'none';
                document.getElementById('historyView').style.display = 'block';
                document.getElementById('positionsFilters').style.display = 'none';
                document.getElementById('historyFilters').style.display = 'flex';
                if(currentAddress) handleSearch();
            } else {
                // Open Orders
                document.getElementById('positionsView').style.display = 'none';
                document.getElementById('historyView').style.display = 'none';
                // Implement Open Orders view if needed
            }
        });
    });
    
    initDatePicker();
});

// --- Date Picker Logic ---
let dpState = {
    isOpen: false,
    viewDate: new Date(),
    startDate: null, // Selected and applied
    endDate: null,   // Selected and applied
    tempStartDate: null, // Currently selecting in modal
    tempEndDate: null    // Currently selecting in modal
};

function initDatePicker() {
    const btn = document.querySelector('.btn-filter.date-range');
    const modal = document.getElementById('datePickerModal');
    const cancelBtn = document.getElementById('cancelDatePicker');
    const setBtn = document.getElementById('setDates');
    const clearBtn = document.getElementById('clearDateRange');
    
    // Toggle Modal
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDatePicker();
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (dpState.isOpen && !modal.contains(e.target) && !btn.contains(e.target)) {
            closeDatePicker();
        }
    });
    
    // Footer Buttons
    cancelBtn.addEventListener('click', closeDatePicker);
    
    setBtn.addEventListener('click', () => {
        dpState.startDate = dpState.tempStartDate;
        dpState.endDate = dpState.tempEndDate;
        updateDateButtonLabel();
        closeDatePicker();
        // Trigger data refresh if needed
        if (currentAddress) fetchTrades(currentAddress); 
    });
    
    clearBtn.addEventListener('click', () => {
        dpState.tempStartDate = null;
        dpState.tempEndDate = null;
        renderCalendar();
    });

    // Navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('prevYear').addEventListener('click', () => changeYear(-1));
    document.getElementById('nextYear').addEventListener('click', () => changeYear(1));

    // Sidebar Items
    document.querySelectorAll('.dp-sidebar-item').forEach(item => {
        item.addEventListener('click', () => setQuickRange(item.dataset.range));
    });
}

function toggleDatePicker() {
    const modal = document.getElementById('datePickerModal');
    if (dpState.isOpen) {
        closeDatePicker();
    } else {
        dpState.isOpen = true;
        modal.style.display = 'block';
        
        // Init temp state from actual state
        dpState.tempStartDate = dpState.startDate;
        dpState.tempEndDate = dpState.endDate;
        dpState.viewDate = dpState.endDate || new Date();
        
        renderCalendar();
    }
}

function closeDatePicker() {
    dpState.isOpen = false;
    document.getElementById('datePickerModal').style.display = 'none';
}

function changeMonth(delta) {
    dpState.viewDate.setMonth(dpState.viewDate.getMonth() + delta);
    renderCalendar();
}

function changeYear(delta) {
    dpState.viewDate.setFullYear(dpState.viewDate.getFullYear() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = dpState.viewDate.getFullYear();
    const month = dpState.viewDate.getMonth();
    
    // Update Header
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    document.getElementById('currentMonthLabel').textContent = `${monthNames[month]} ${year}`;
    
    const daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';
    
    // Logic for days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    
    // Empty slots for start
    for (let i = 0; i < startDayOfWeek; i++) {
        const div = document.createElement('div');
        div.className = 'dp-day empty';
        daysContainer.appendChild(div);
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const div = document.createElement('div');
        div.className = 'dp-day';
        div.textContent = d;
        
        // Styles
        if (date.getTime() === today.getTime()) {
            div.classList.add('today');
        }
        
        // Range Styles
        const s = dpState.tempStartDate ? dpState.tempStartDate.getTime() : null;
        const e = dpState.tempEndDate ? dpState.tempEndDate.getTime() : null;
        const c = date.getTime();
        
        if (s && e) {
            if (c >= Math.min(s, e) && c <= Math.max(s, e)) {
                div.classList.add('in-range');
            }
            if (c === s) div.classList.add('range-start'); // visual start
            if (c === e) div.classList.add('range-end');   // visual end
            // Swap if start > end for visuals? Usually we normalize on set, but visually:
            if (s > e && c === s) div.classList.replace('range-start', 'range-end');
            if (s > e && c === e) div.classList.replace('range-end', 'range-start');
        } else if (s && c === s) {
            div.classList.add('selected');
        }
        
        div.addEventListener('click', () => selectDate(date));
        daysContainer.appendChild(div);
    }
}

function selectDate(date) {
    if (!dpState.tempStartDate || (dpState.tempStartDate && dpState.tempEndDate)) {
        // Start new range
        dpState.tempStartDate = date;
        dpState.tempEndDate = null;
    } else {
        // Complete range
        if (date < dpState.tempStartDate) {
            dpState.tempEndDate = dpState.tempStartDate;
            dpState.tempStartDate = date;
        } else {
            dpState.tempEndDate = date;
        }
    }
    renderCalendar();
}

function setQuickRange(rangeType) {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let start, end;
    
    switch(rangeType) {
        case 'today':
            start = new Date(today);
            end = new Date(today);
            break;
        case 'yesterday':
            start = new Date(today);
            start.setDate(today.getDate() - 1);
            end = new Date(start);
            break;
        case 'lastWeek':
            end = new Date(today);
            start = new Date(today);
            start.setDate(today.getDate() - 7);
            break;
        case 'lastMonth':
            end = new Date(today);
            start = new Date(today);
            start.setMonth(today.getMonth() - 1);
            break;
        case 'last3Months':
            end = new Date(today);
            start = new Date(today);
            start.setMonth(today.getMonth() - 3);
            break;
        case 'ytd':
            end = new Date(today);
            start = new Date(today.getFullYear(), 0, 1);
            break;
        case 'lastYear':
            start = new Date(today.getFullYear() - 1, 0, 1);
            end = new Date(today.getFullYear() - 1, 11, 31);
            break;
        case 'all':
            start = null;
            end = null;
            break;
    }
    
    dpState.tempStartDate = start;
    dpState.tempEndDate = end;
    if (end) dpState.viewDate = new Date(end);
    renderCalendar();
    
    // Highlight sidebar
    document.querySelectorAll('.dp-sidebar-item').forEach(el => {
        el.classList.toggle('active', el.dataset.range === rangeType);
    });
}

function updateDateButtonLabel() {
    const btn = document.querySelector('.btn-filter.date-range');
    if (!dpState.startDate || !dpState.endDate) {
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Date Range
        `;
        return;
    }
    
    const fmt = d => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        ${fmt(dpState.startDate)} - ${fmt(dpState.endDate)}
    `;
}

// Modify getTrades to accept date range (client-side filtering for now)
// We'll wrap the fetch logic. Since API filtering isn't verified, we'll filter the RESULT
// But since we use pagination, this is tricky. We'll just filter what we get.
// Ideally we'd pass ?start_date=... to API.
