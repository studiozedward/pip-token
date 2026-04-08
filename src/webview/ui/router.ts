import { renderLiveSession } from './pages/liveSession';
import { renderLiveContext } from './pages/liveContext';
import { renderLiveCache } from './pages/liveCache';
import { renderStatsTokens } from './pages/statsTokens';
import { renderStatsCost } from './pages/statsCost';
import { renderHistoryWeek } from './pages/historyWeek';
import { renderHistoryMonth } from './pages/historyMonth';
import { renderHistoryQuarter } from './pages/historyQuarter';
import { renderHistoryYear } from './pages/historyYear';
import { renderTips } from './pages/tips';
import { renderAboutInfo } from './pages/aboutInfo';
import { renderAboutGlossary } from './pages/aboutGlossary';
import { renderOnboarding } from './pages/onboarding';
import { renderStatusBar } from './components/statusBar';
import { playBlip } from './components/blipSound';

interface NavConfig {
  sections: {
    id: string;
    label: string;
    subPages: { id: string; label: string }[];
  }[];
}

const NAV_CONFIG: NavConfig = {
  sections: [
    {
      id: 'live',
      label: 'LIVE',
      subPages: [
        { id: 'session', label: 'SESSION' },
        { id: 'context', label: 'CONTEXT' },
        { id: 'cache', label: 'CACHE' },
      ],
    },
    {
      id: 'stats',
      label: 'STATS',
      subPages: [
        { id: 'tokens', label: 'TOKENS' },
        { id: 'cost', label: 'COST' },
      ],
    },
    {
      id: 'history',
      label: 'HISTORY',
      subPages: [
        { id: 'week', label: 'WEEK' },
        { id: 'month', label: 'MONTH' },
        { id: 'quarter', label: 'QUARTER' },
        { id: 'year', label: 'YEAR' },
      ],
    },
    {
      id: 'tips',
      label: 'TIPS',
      subPages: [],
    },
    {
      id: 'about',
      label: 'ABOUT',
      subPages: [
        { id: 'info', label: 'INFO' },
        { id: 'glossary', label: 'GLOSSARY' },
      ],
    },
  ],
};

type PageRenderer = (container: HTMLElement) => void;

const PAGE_RENDERERS: Record<string, PageRenderer> = {
  'live.session': renderLiveSession,
  'live.context': renderLiveContext,
  'live.cache': renderLiveCache,
  'stats.tokens': renderStatsTokens,
  'stats.cost': renderStatsCost,
  'history.week': renderHistoryWeek,
  'history.month': renderHistoryMonth,
  'history.quarter': renderHistoryQuarter,
  'history.year': renderHistoryYear,
  'tips': renderTips,
  'about.info': renderAboutInfo,
  'about.glossary': renderAboutGlossary,
};

class Router {
  private app: HTMLElement | null = null;
  private currentSection = '';
  private currentSubPage = '';

  get currentPageKey(): string {
    if (!this.currentSection) return '';
    return this.currentSubPage
      ? `${this.currentSection}.${this.currentSubPage}`
      : this.currentSection;
  }

  init(app: HTMLElement) {
    this.app = app;
  }

  showOnboarding() {
    if (!this.app) return;
    this.app.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'page-content';
    renderOnboarding(content);
    this.app.appendChild(content);
  }

  navigate(section: string, subPage?: string) {
    if (!this.app) return;

    const sectionConfig = NAV_CONFIG.sections.find(s => s.id === section);
    if (!sectionConfig) return;

    // Default to first sub-page if none specified
    const resolvedSubPage = subPage || (sectionConfig.subPages[0]?.id ?? '');

    // Don't re-render if already on this page
    if (this.currentSection === section && this.currentSubPage === resolvedSubPage) return;

    this.currentSection = section;
    this.currentSubPage = resolvedSubPage;

    // CRT flicker effect
    this.app.classList.add('crt-flicker');
    playBlip();
    setTimeout(() => {
      this.app?.classList.remove('crt-flicker');
    }, 80);

    this.render();
  }

  private render() {
    if (!this.app) return;

    const pageKey = this.currentSubPage
      ? `${this.currentSection}.${this.currentSubPage}`
      : this.currentSection;

    // Build full HTML
    this.app.innerHTML = '';

    // Title bar
    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    titlebar.innerHTML = `<span>\u2699 PIP-TOKEN v0.1</span><span>[${this.currentSection.toUpperCase()}]</span>`;
    this.app.appendChild(titlebar);

    // Top nav
    const topnav = document.createElement('div');
    topnav.className = 'topnav';
    for (const section of NAV_CONFIG.sections) {
      const item = document.createElement('span');
      item.className = `topnav-item${section.id === this.currentSection ? ' active' : ''}`;
      item.textContent = section.label;
      item.addEventListener('click', () => this.navigate(section.id));
      topnav.appendChild(item);
    }
    this.app.appendChild(topnav);

    // Sub nav (if section has sub-pages)
    const sectionConfig = NAV_CONFIG.sections.find(s => s.id === this.currentSection);
    if (sectionConfig && sectionConfig.subPages.length > 0) {
      const subnav = document.createElement('div');
      subnav.className = 'subnav';
      for (const sub of sectionConfig.subPages) {
        const item = document.createElement('span');
        item.className = `subnav-item${sub.id === this.currentSubPage ? ' active' : ''}`;
        item.textContent = sub.label;
        item.addEventListener('click', () => this.navigate(this.currentSection, sub.id));
        subnav.appendChild(item);
      }
      this.app.appendChild(subnav);
    }

    // Page content
    const content = document.createElement('div');
    content.className = 'page-content';
    const renderer = PAGE_RENDERERS[pageKey];
    if (renderer) {
      renderer(content);
    } else {
      content.innerHTML = `<div class="learning-state">Page not found: ${pageKey}</div>`;
    }
    this.app.appendChild(content);

    // Status bar
    const statusbar = document.createElement('div');
    renderStatusBar(statusbar);
    this.app.appendChild(statusbar);
  }
}

export const router = new Router();
