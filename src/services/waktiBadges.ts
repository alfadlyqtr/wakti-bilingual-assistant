
class WaktiBadgeService {
  private badges: Map<string, { count: number; priority: 'low' | 'normal' | 'high' | 'urgent' }> = new Map();

  getBadgeCount(type: string): number {
    return this.badges.get(type)?.count || 0;
  }

  getAllBadges(): Map<string, { count: number; priority: 'low' | 'normal' | 'high' | 'urgent' }> {
    return new Map(this.badges);
  }

  updateBadge(type: string, count: number, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    this.badges.set(type, { count: Math.max(0, count), priority });
    this.triggerBadgeUpdate();
    console.log(`🏷️ Badge updated: ${type} = ${count} (${priority})`);
  }

  incrementBadge(type: string, increment: number = 1, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    const current = this.badges.get(type)?.count || 0;
    this.updateBadge(type, current + increment, priority);
  }

  decrementBadge(type: string, decrement: number = 1): void {
    const current = this.badges.get(type);
    if (current) {
      this.updateBadge(type, Math.max(0, current.count - decrement), current.priority);
    }
  }

  clearBadge(type: string): void {
    this.badges.delete(type);
    this.triggerBadgeUpdate();
    console.log(`🧹 Badge cleared: ${type}`);
  }

  clearAllBadges(): void {
    this.badges.clear();
    this.triggerBadgeUpdate();
    console.log('🧹 All badges cleared');
  }

  private triggerBadgeUpdate(): void {
    // Trigger a custom event that components can listen to
    window.dispatchEvent(new CustomEvent('badge-updated'));
  }

  // Get total badge count for overall app badge
  getTotalCount(): number {
    let total = 0;
    this.badges.forEach(badge => {
      total += badge.count;
    });
    return total;
  }

  // Get highest priority among all badges
  getHighestPriority(): 'low' | 'normal' | 'high' | 'urgent' | null {
    let highest: 'low' | 'normal' | 'high' | 'urgent' | null = null;
    const priorityOrder = { 'low': 1, 'normal': 2, 'high': 3, 'urgent': 4 };

    this.badges.forEach(badge => {
      if (badge.count > 0) {
        if (!highest || priorityOrder[badge.priority] > priorityOrder[highest]) {
          highest = badge.priority;
        }
      }
    });

    return highest;
  }
}

export const waktiBadges = new WaktiBadgeService();
