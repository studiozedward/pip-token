type MascotSection = 'live' | 'stats' | 'history' | 'tips' | 'about';

const MASCOT_MAP: Record<MascotSection, string> = {
  live: 'owlLive',
  stats: 'owlStats',
  history: 'owlHistory',
  tips: 'owlTips',
  about: 'owlAbout',
};

export function renderMascot(container: HTMLElement, section: MascotSection, description: string): void {
  const assets = (window as any).pipTokenAssets as Record<string, string> | undefined;
  const assetKey = MASCOT_MAP[section];
  const src = assets?.[assetKey] ?? '';

  container.innerHTML = `
    <img src="${src}" alt="Pip-Token owl mascot">
    <div class="mascot-desc">${description}</div>
  `;
}
