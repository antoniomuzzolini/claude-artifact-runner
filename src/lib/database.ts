import { AppData } from '../types/foosball';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? '' // Vercel automatically handles this in production
  : 'http://localhost:3000'; // For local development

// API utility functions
export const dbAPI = {
  // Sync all data to cloud database
  async syncData(data: AppData): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Data synced to cloud:', result.message);
      return true;
    } catch (error) {
      console.warn('⚠️ Cloud sync failed, staying offline:', error);
      return false;
    }
  },

  // Load all data from cloud database
  async loadData(): Promise<AppData | null> {
    try {
      const response = await fetch(`${API_BASE}/api/sync`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Data loaded from cloud');
      return data;
    } catch (error) {
      console.warn('⚠️ Cloud load failed, using local data:', error);
      return null;
    }
  },

  // Clear all data from cloud database
  async clearData(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/sync`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Cloud data cleared:', result.message);
      return true;
    } catch (error) {
      console.error('❌ Failed to clear cloud data:', error);
      return false;
    }
  },

  // Check if we can connect to the cloud database
  async isOnline(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${API_BASE}/api/sync`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};

// Note: mergeData function removed since we're using cloud-only storage 