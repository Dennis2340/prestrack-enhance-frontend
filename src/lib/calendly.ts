// Calendly API v2 integration for HOA meeting scheduling

export type CalendlyEvent = {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  location?: {
    type: string;
    location?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit?: number;
  };
  event_memberships?: Array<{
    user: string;
    user_email: string;
    user_name: string;
  }>;
};

export type CalendlyUser = {
  uri: string;
  name: string;
  email: string;
  avatar_url: string;
  scheduling_url: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  current_organization?: string;
};

export type CalendlySchedulingLink = {
  uri: string;
  owner: string;
  owner_type: 'users' | 'teams';
  name: string;
  slug: string;
  url: string;
  max_event_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateSchedulingLinkOptions = {
  max_event_count: number;
  owner: string; // User URI
  owner_type: 'users';
};

class CalendlyClient {
  private apiKey: string;
  private baseUrl = 'https://api.calendly.com'; // API v2 endpoint

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`, // Bearer token authentication
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendly API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get current user info
  async getCurrentUser(): Promise<CalendlyUser> {
    const response = await this.makeRequest<{ resource: CalendlyUser }>('/users/me');
    return response.resource;
  }

  // Get user's scheduling links
  async getSchedulingLinks(userUri?: string): Promise<CalendlySchedulingLink[]> {
    const params = userUri ? `?owner=${userUri}` : '';
    const response = await this.makeRequest<{ collection: CalendlySchedulingLink[] }>(
      `/scheduling_links${params}`
    );
    return response.collection;
  }

  // Create a single-use scheduling link
  async createSchedulingLink(
    options: CreateSchedulingLinkOptions
  ): Promise<CalendlySchedulingLink> {
    const response = await this.makeRequest<{ resource: CalendlySchedulingLink }>(
      '/scheduling_links',
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
    return response.resource;
  }

  // Get user's events
  async getEvents(
    userUri?: string,
    startTime?: string,
    endTime?: string,
    status: 'active' | 'canceled' = 'active'
  ): Promise<CalendlyEvent[]> {
    const params = new URLSearchParams();
    if (userUri) params.append('user', userUri);
    if (startTime) params.append('start_time', startTime);
    if (endTime) params.append('end_time', endTime);
    params.append('status', status);
    params.append('count', '50'); // Limit to 50 events

    const response = await this.makeRequest<{ collection: CalendlyEvent[] }>(
      `/scheduled_events?${params.toString()}`
    );
    return response.collection;
  }

  // Cancel an event
  async cancelEvent(eventUri: string, reason?: string): Promise<void> {
    await this.makeRequest(`/scheduled_events/${eventUri}/cancellation`, {
      method: 'POST',
      body: JSON.stringify({
        reason: reason || 'Canceled via HOA platform',
      }),
    });
  }

  // Get available time slots for a user
  async getAvailableTimeSlots(
    userUri: string,
    startTime: string,
    endTime: string
  ): Promise<any[]> {
    const params = new URLSearchParams({
      user: userUri,
      start_time: startTime,
      end_time: endTime,
    });

    const response = await this.makeRequest<{ collection: any[] }>(
      `/schedules/available_times?${params.toString()}`
    );
    return response.collection;
  }

  // Get user by email to find their URI
  async getUserByEmail(email: string): Promise<CalendlyUser | null> {
    try {
      const params = new URLSearchParams({ email });
      const response = await this.makeRequest<{ collection: CalendlyUser[] }>(
        `/users?${params.toString()}`
      );
      return response.collection.length > 0 ? response.collection[0] : null;
    } catch (error) {
      console.error('[Calendly] getUserByEmail error:', error);
      return null;
    }
  }
}

// Singleton instance
let calendlyClient: CalendlyClient | null = null;

export function getCalendlyClient(): CalendlyClient {
  if (!calendlyClient) {
    const apiKey = process.env.CALENDLY_API_KEY;
    if (!apiKey) {
      throw new Error('CALENDLY_API_KEY environment variable is not set');
    }
    calendlyClient = new CalendlyClient(apiKey);
  }
  return calendlyClient;
}

// Helper function to check if Calendly is configured
export function isCalendlyConfigured(): boolean {
  return !!process.env.CALENDLY_API_KEY;
}

// Format date for Calendly API (ISO 8601)
export function formatCalendlyDate(date: Date): string {
  return date.toISOString();
}

// Parse Calendly date to local time
export function parseCalendlyDate(dateString: string): Date {
  return new Date(dateString);
}
