class ParlayStreakAnalytics extends HTMLElement {
  connectedCallback() {
    // Load SimpleAnalytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://scripts.simpleanalyticscdn.com/latest.js';
    document.head.appendChild(script);

    // Add noscript fallback
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.src = 'https://queue.simpleanalyticscdn.com/noscript.gif';
    img.alt = '';
    img.referrerPolicy = 'no-referrer-when-downgrade';
    noscript.appendChild(img);
    this.appendChild(noscript);
  }
}

customElements.define('parlay-streak-analytics', ParlayStreakAnalytics);

