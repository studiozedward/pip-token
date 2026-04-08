import { renderMascot } from '../components/mascotPanel';
import { sendToExtension } from '../../messageBus';
import { updateStatusBarData } from '../components/statusBar';

interface Tip {
  num: string;
  body: string;
}

interface StatusBarData {
  isPeak: boolean;
  contextUsed: number;
  contextMax: number;
  burnRate: number | null;
  weeklyTokens: number;
  weeklyCostMinor: number;
  currency: string;
}

interface TipsPayload {
  pageId: string;
  statusBar?: StatusBarData;
}

type Category = 'CACHE' | 'PEAK HOURS' | 'CONTEXT' | 'OTHER';

const TIPS: Record<Category, Tip[]> = {
  'CACHE': [
    { num: 'TIP 01', body: "Don't take 5+ minute breaks during a session \u2014 the prompt cache expires and your next message re-reads everything at full cost." },
    { num: 'TIP 02', body: 'Group small questions together rather than asking them across separate sessions.' },
    { num: 'TIP 03', body: "Use .clignore to exclude large directories (node_modules, build outputs) from Claude Code's file reads." },
    { num: 'TIP 04', body: 'If you need to step away, send a quick "hold on" message before 5 minutes to keep the cache alive.' },
    { num: 'TIP 05', body: 'Starting a new session rebuilds the full cache. Prefer continuing an existing session when possible.' },
  ],
  'PEAK HOURS': [
    { num: 'TIP 06', body: "Anthropic's peak hours are weekdays 5\u201311 AM Pacific / 1\u20137 PM GMT. Schedule heavy refactors outside this window." },
    { num: 'TIP 07', body: "If you're in the UK, save big tasks for after 7 PM GMT \u2014 your tokens go further off-peak." },
    { num: 'TIP 08', body: 'Weekend work is always off-peak. Good time for large codebase refactors.' },
    { num: 'TIP 09', body: 'Check the status bar \u2014 it shows PEAK or OFF-PEAK so you always know where you stand.' },
    { num: 'TIP 10', body: 'If you hit a limit during peak, switch to a different task and come back after 11 AM Pacific.' },
  ],
  'CONTEXT': [
    { num: 'TIP 11', body: "Use /clear between unrelated tasks to reset Claude Code's context window." },
    { num: 'TIP 12', body: 'Add specific files with @ rather than letting Claude Code scan the whole project.' },
    { num: 'TIP 13', body: 'Keep CLAUDE.md files tight \u2014 they get loaded every session and eat into your context.' },
    { num: 'TIP 14', body: 'If context utilisation is above 80%, consider starting a fresh conversation for new tasks.' },
    { num: 'TIP 15', body: 'Break large tasks into smaller, focused conversations rather than one marathon session.' },
  ],
  'OTHER': [
    { num: 'TIP 16', body: 'Use Sonnet for routine work and only switch to Opus for genuinely hard problems. The cost difference is 5x.' },
    { num: 'TIP 17', body: 'Write clear, specific prompts. Vague requests lead to longer responses with more output tokens.' },
    { num: 'TIP 18', body: 'If you use Claude.ai alongside Claude Code, sync your dashboard regularly for accurate projections.' },
    { num: 'TIP 19', body: 'Review your HISTORY page weekly \u2014 patterns reveal optimization opportunities.' },
    { num: 'TIP 20', body: 'Batch related questions into single turns instead of rapid-fire individual prompts.' },
  ],
};

function renderTipsForCategory(container: HTMLElement, category: Category, pageId: string): void {
  const tips = TIPS[category];

  container.innerHTML = `
    <div class="page-body">
      <div class="statlist">
        <div id="tips-list"></div>
        <div class="page-footer">Have a tip? @StudioZedward on X</div>
      </div>
      <div class="mascot" id="mascot-tips"></div>
    </div>
  `;

  const listEl = container.querySelector('#tips-list') as HTMLElement;
  if (listEl) {
    for (const tip of tips) {
      const card = document.createElement('div');
      card.className = 'tipcard';
      card.innerHTML = `
        <div class="tipcard-num">${tip.num}</div>
        <div class="tipcard-body">${tip.body}</div>
      `;
      listEl.appendChild(card);
    }
  }

  const mascotEl = container.querySelector('#mascot-tips') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'tips', 'Hand-picked tips to help you get more out of your token budget.');
  }

  sendToExtension({ type: 'requestPageData', payload: { pageId } });
}

export function renderTipsCache(container: HTMLElement): void {
  renderTipsForCategory(container, 'CACHE', 'tips.cache');
}

export function renderTipsPeakHours(container: HTMLElement): void {
  renderTipsForCategory(container, 'PEAK HOURS', 'tips.peak-hours');
}

export function renderTipsContext(container: HTMLElement): void {
  renderTipsForCategory(container, 'CONTEXT', 'tips.context');
}

export function renderTipsOther(container: HTMLElement): void {
  renderTipsForCategory(container, 'OTHER', 'tips.other');
}

export function updateTips(payload: TipsPayload): void {
  if (payload.statusBar) {
    updateStatusBarData(payload.statusBar);
  }
}
