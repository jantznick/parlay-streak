import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4">Parlay Streak</h3>
            <p className="text-sm text-slate-400 mb-4">
              Build your streak with strategic parlay betting. Compete with friends and climb the leaderboards.
            </p>
            <p className="text-xs text-slate-500">
              © {currentYear} Parlay Streak. All rights reserved.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://parlaystreak.com/legal/terms" className="text-sm text-slate-400 hover:text-white transition">
                  Terms of Use
                </a>
              </li>
              <li>
                <a href="https://parlaystreak.com/legal/privacy" className="text-sm text-slate-400 hover:text-white transition">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://parlaystreak.com/legal/responsible-gaming" className="text-sm text-slate-400 hover:text-white transition">
                  Responsible Gaming
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://parlaystreak.com/company/about" className="text-sm text-slate-400 hover:text-white transition">
                  About Us
                </a>
              </li>
              <li>
                <a href="https://parlaystreak.com/company/careers" className="text-sm text-slate-400 hover:text-white transition">
                  Careers
                </a>
              </li>
              <li>
                <a href="https://parlaystreak.com/company/contact" className="text-sm text-slate-400 hover:text-white transition">
                  Contact
                </a>
              </li>
              <li>
                <a href="https://parlaystreak.com/company/help" className="text-sm text-slate-400 hover:text-white transition">
                  Help Center
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

