class ParlayStreakHeader extends HTMLElement {
  connectedCallback() {
    const isHomePage = this.getAttribute('home') === 'true';
    
    this.innerHTML = `
      <header class="fixed top-0 w-full bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center">
              <a href="/" class="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent">
                Parlay Streak
              </a>
            </div>
            ${isHomePage ? `
              <div class="hidden md:flex space-x-8">
                <a href="#how-it-works" class="text-gray-300 hover:text-orange-600 transition">How It Works</a>
                <a href="#mechanics" class="text-gray-300 hover:text-orange-600 transition">Game Mechanics</a>
                <a href="#leaderboards" class="text-gray-300 hover:text-orange-600 transition">Leaderboards</a>
                <a href="#examples" class="text-gray-300 hover:text-orange-600 transition">Examples</a>
                <a href="#todays-bets" class="text-gray-300 hover:text-orange-600 transition">Today's Bets</a>
              </div>
              <div>
                <a href="#waitlist" class="bg-gradient-to-r from-orange-600 to-red-700 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
                  Get Notified
                </a>
              </div>
            ` : `
              <div>
                <a href="/" class="text-gray-300 hover:text-orange-600 transition">Back to Home</a>
              </div>
            `}
          </div>
        </nav>
      </header>
    `;
  }
}

customElements.define('parlay-streak-header', ParlayStreakHeader);

