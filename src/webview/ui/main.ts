import { router } from './router';
import { onExtensionMessage } from '../messageBus';
import { updateLiveSession } from './pages/liveSession';
import { updateLiveContext } from './pages/liveContext';
import { updateLiveCache } from './pages/liveCache';
import { updateStatsTokens } from './pages/statsTokens';
import { updateStatsCost } from './pages/statsCost';
import { updateHistoryWeek } from './pages/historyWeek';
import { updateHistoryMonth } from './pages/historyMonth';
import { updateHistoryQuarter } from './pages/historyQuarter';
import { updateHistoryYear } from './pages/historyYear';
import { updateTips } from './pages/tips';
import { updateAboutInfo } from './pages/aboutInfo';
import { updateStatusBarData } from './components/statusBar';
import { setSoundEnabled } from './components/blipSound';

// Local interface to narrow the payload without using `any`
interface StatusBarData {
  isPeak: boolean;
  contextUsed: number;
  contextMax: number;
  burnRate: number | null;
  weeklyTokens: number;
  weeklyCostMinor: number;
  currency: string;
}

interface PageDataPayload {
  pageId: string;
  statusBar?: StatusBarData;
  settings?: Record<string, string>;
  info?: unknown;
}

interface SettingsChangedPayload {
  settings: Record<string, string>;
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;

  router.init(app);
  router.navigate('live', 'session');

  // Listen for messages from the extension
  onExtensionMessage((message) => {
    // Handle firstRunDetected — show onboarding
    if (message.type === 'firstRunDetected') {
      router.showOnboarding();
      return;
    }

    // Handle settingsChanged — update aboutInfo if active, and sound toggle
    if (message.type === 'settingsChanged') {
      const payload = message.payload as SettingsChangedPayload;
      if (payload.settings.sound_enabled !== undefined) {
        setSoundEnabled(payload.settings.sound_enabled !== 'false');
      }
      // If onboarding just completed, navigate to LIVE
      if (payload.settings.onboarding_completed_at && !router.currentPageKey) {
        router.navigate('live', 'session');
        return;
      }
      if (router.currentPageKey === 'about.info') {
        updateAboutInfo({ pageId: 'about.info', settings: payload.settings });
      }
      return;
    }

    if (message.type === 'pageData' || message.type === 'liveUpdate') {
      const payload = message.payload as PageDataPayload;

      // Update status bar with every message
      if (payload.statusBar) {
        updateStatusBarData(payload.statusBar);
      }

      // Route to the right page updater
      switch (payload.pageId) {
        case 'live.session': updateLiveSession(payload); break;
        case 'live.context': updateLiveContext(payload); break;
        case 'live.cache': updateLiveCache(payload); break;
        case 'stats.tokens': updateStatsTokens(payload); break;
        case 'stats.cost': updateStatsCost(payload); break;
        case 'history.week': updateHistoryWeek(payload); break;
        case 'history.month': updateHistoryMonth(payload); break;
        case 'history.quarter': updateHistoryQuarter(payload); break;
        case 'history.year': updateHistoryYear(payload); break;
        case 'tips': updateTips(payload); break;
        case 'about.info': updateAboutInfo(payload as unknown as Parameters<typeof updateAboutInfo>[0]); break;
        // about.glossary is static — no update function needed
      }
    }
  });
});
