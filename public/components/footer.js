class ParlayStreakFooter extends HTMLElement {
  connectedCallback() {
    const currentYear = new Date().getFullYear();
    
    this.innerHTML = `
      <footer class="bg-slate-900 border-t border-slate-800 mt-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            <!-- Company Info -->
            <div class="col-span-1 md:col-span-2">
              <h3 class="text-lg font-bold text-white mb-4">Parlay Streak</h3>
              <p class="text-sm text-slate-400 mb-4">
                Build your streak with strategic parlay betting. Compete with friends and climb the leaderboards.
              </p>
              <p class="text-xs text-slate-500">
                © ${currentYear} Parlay Streak. All rights reserved.
              </p>
            </div>

            <!-- Legal -->
            <div>
              <h4 class="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul class="space-y-2">
                <li>
                  <a href="/legal/terms" class="text-sm text-slate-400 hover:text-white transition">Terms of Use</a>
                </li>
                <li>
                  <a href="/legal/privacy" class="text-sm text-slate-400 hover:text-white transition">Privacy Policy</a>
                </li>
                <li>
                  <a href="/legal/responsible-gaming" class="text-sm text-slate-400 hover:text-white transition">Responsible Gaming</a>
                </li>
              </ul>
            </div>

            <!-- Company -->
            <div>
              <h4 class="text-sm font-semibold text-white mb-4">Company</h4>
              <ul class="space-y-2">
                <li>
                  <a href="/company/about" class="text-sm text-slate-400 hover:text-white transition">About Us</a>
                </li>
                <li>
                  <a href="/company/careers" class="text-sm text-slate-400 hover:text-white transition">Careers</a>
                </li>
                <li>
                  <a href="/company/contact" class="text-sm text-slate-400 hover:text-white transition">Contact</a>
                </li>
                <li>
                  <a href="/company/help" class="text-sm text-slate-400 hover:text-white transition">Help Center</a>
                </li>
                <li>
                  <a href="/company/gameplay" class="text-sm text-slate-400 hover:text-white transition">Official Rules</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define('parlay-streak-footer', ParlayStreakFooter);

