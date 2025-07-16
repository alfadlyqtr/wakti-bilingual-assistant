
export interface BadgeData {
  type: 'message' | 'task' | 'event' | 'contact' | 'admin' | 'shared_task';
  count: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lastUpdated: number;
}

export interface BadgeSettings {
  enabled: boolean;
  animationsEnabled: boolean;
  maxDisplayCount: number;
  colorTheme: 'default' | 'vibrant' | 'minimal';
}

class WaktiBadgeManager {
  private badges: Map<string, BadgeData> = new Map();
  private settings: BadgeSettings;
  private listeners: Set<(type: string, data: BadgeData) => void> = new Set();

  constructor() {
    this.settings = this.loadBadgeSettings();
    this.injectBadgeStyles();
  }

  private loadBadgeSettings(): BadgeSettings {
    const saved = localStorage.getItem('wakti-badge-settings');
    if (saved) {
      try {
        return { ...this.getDefaultBadgeSettings(), ...JSON.parse(saved) };
      } catch (e) {
        return this.getDefaultBadgeSettings();
      }
    }
    return this.getDefaultBadgeSettings();
  }

  private getDefaultBadgeSettings(): BadgeSettings {
    return {
      enabled: true,
      animationsEnabled: true,
      maxDisplayCount: 99,
      colorTheme: 'default'
    };
  }

  updateBadge(type: string, count: number, priority: BadgeData['priority'] = 'normal'): void {
    if (!this.settings.enabled) return;

    const previousData = this.badges.get(type);
    const badgeData: BadgeData = {
      type: type as BadgeData['type'],
      count: Math.max(0, count),
      priority,
      lastUpdated: Date.now()
    };

    this.badges.set(type, badgeData);

    if (!previousData || previousData.count !== count) {
      this.notifyListeners(type, badgeData);
    }
  }

  getBadge(type: string): BadgeData | null {
    return this.badges.get(type) || null;
  }

  getBadgeDisplay(type: string): { show: boolean; count: string; priority: string } {
    const badge = this.badges.get(type);
    
    if (!badge || !this.settings.enabled) {
      return { show: false, count: '0', priority: 'normal' };
    }

    const show = badge.count > 0;
    const count = badge.count > this.settings.maxDisplayCount 
      ? `${this.settings.maxDisplayCount}+` 
      : badge.count.toString();

    return { show, count, priority: badge.priority };
  }

  getBadgeClasses(type: string): string[] {
    const badge = this.badges.get(type);
    if (!badge) return [];

    const classes = ['wakti-badge'];
    classes.push(`wakti-badge-${badge.priority}`);
    classes.push(`wakti-badge-theme-${this.settings.colorTheme}`);
    
    if (this.settings.animationsEnabled) {
      classes.push('wakti-badge-animated');
      const now = Date.now();
      if (now - badge.lastUpdated < 1000) {
        classes.push('wakti-badge-bounce');
      }
    }

    return classes;
  }

  clearBadge(type: string): void {
    this.updateBadge(type, 0);
  }

  incrementBadge(type: string, amount: number = 1, priority: BadgeData['priority'] = 'normal'): void {
    const current = this.badges.get(type);
    const newCount = (current?.count || 0) + amount;
    this.updateBadge(type, newCount, priority);
  }

  updateSettings(newSettings: Partial<BadgeSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('wakti-badge-settings', JSON.stringify(this.settings));
    
    this.badges.forEach((data, type) => {
      this.notifyListeners(type, data);
    });
  }

  getSettings(): BadgeSettings {
    return { ...this.settings };
  }

  addListener(callback: (type: string, data: BadgeData) => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: (type: string, data: BadgeData) => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(type: string, data: BadgeData): void {
    this.listeners.forEach(callback => callback(type, data));
  }

  private injectBadgeStyles(): void {
    if (typeof document === 'undefined' || document.getElementById('wakti-badge-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'wakti-badge-styles';
    styles.textContent = `
      .wakti-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        color: white;
        padding: 0 6px;
        border: 2px solid hsl(var(--background));
        z-index: 10;
      }

      .wakti-badge-theme-default.wakti-badge-normal {
        background: hsl(var(--destructive));
      }

      .wakti-badge-theme-default.wakti-badge-high {
        background: hsl(var(--accent-orange));
      }

      .wakti-badge-theme-default.wakti-badge-urgent {
        background: hsl(var(--destructive));
        animation: wakti-badge-pulse 1s infinite;
      }

      .wakti-badge-theme-vibrant.wakti-badge-normal {
        background: linear-gradient(45deg, hsl(var(--accent-blue)), hsl(var(--accent-purple)));
      }

      .wakti-badge-theme-vibrant.wakti-badge-high {
        background: linear-gradient(45deg, hsl(var(--accent-orange)), hsl(var(--accent-amber)));
      }

      .wakti-badge-theme-vibrant.wakti-badge-urgent {
        background: linear-gradient(45deg, hsl(var(--destructive)), hsl(var(--accent-pink)));
        animation: wakti-badge-pulse 1s infinite;
      }

      .wakti-badge-theme-minimal {
        background: hsl(var(--muted-foreground));
        color: hsl(var(--background));
        border: none;
      }

      .wakti-badge-animated {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .wakti-badge-bounce {
        animation: wakti-badge-bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      @keyframes wakti-badge-bounce {
        0% { transform: scale(0.3); }
        50% { transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { transform: scale(1); }
      }

      @keyframes wakti-badge-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }

      @media (max-width: 640px) {
        .wakti-badge {
          min-width: 18px;
          height: 18px;
          font-size: 10px;
          top: -6px;
          right: -6px;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
}

export const waktiBadges = new WaktiBadgeManager();
