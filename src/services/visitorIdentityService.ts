
// This file is now much simpler - we just store the name in localStorage
// No complex fingerprinting or database tracking needed

export class VisitorIdentityService {
  private static STORAGE_KEY = 'tr_visitor_name';

  static getStoredName(taskId: string): string | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${taskId}`);
      return stored;
    } catch (error) {
      console.error('Error getting stored name:', error);
      return null;
    }
  }

  static storeName(taskId: string, name: string): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${taskId}`, name);
    } catch (error) {
      console.error('Error storing name:', error);
    }
  }

  static clearName(taskId: string): void {
    try {
      localStorage.removeItem(`${this.STORAGE_KEY}_${taskId}`);
    } catch (error) {
      console.error('Error clearing name:', error);
    }
  }
}
