// Google Meet API integration for HOA scheduling
// Creates actual Google Meet meetings via Google Calendar API using GCS credentials

export interface GoogleMeetEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  conferenceData: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
  attendees?: Array<{
    email: string;
  }>;
  hangoutLink?: string;
}

export interface GoogleMeetResponse {
  id: string;
  summary: string;
  hangoutLink: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

export interface GCSCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GoogleMeetAPI {
  private credentials: GCSCredentials;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  private getCalendarId(): string {
    return process.env.GOOGLE_CALENDAR_ID || 'primary';
  }

  constructor(credentialsJson: string) {
    try {
      this.credentials = typeof credentialsJson === 'string' 
        ? JSON.parse(credentialsJson) 
        : credentialsJson;
    } catch (error) {
      throw new Error('Invalid GCS credentials JSON format');
    }
  }

  /**
   * Get OAuth2 access token using GCS credentials
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Create JWT for OAuth2
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: this.credentials.client_email,
        scope: 'https://www.googleapis.com/auth/calendar',
        aud: this.credentials.token_uri,
        exp: now + 3600, // 1 hour expiry
        iat: now
      };

      // Import crypto for JWT signing (Node.js environment)
      const crypto = await import('crypto');
      
      // Base64url encode without padding
      const base64UrlEncode = (str: string) => {
        return Buffer.from(str)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      
      // Sign the JWT
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const signatureBuffer = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), this.credentials.private_key);
      const encodedSignature = base64UrlEncode(signatureBuffer.toString('base64'));

      const jwt = `${signatureInput}.${encodedSignature}`;

      // Exchange JWT for access token
      const tokenResponse = await fetch(this.credentials.token_uri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get access token: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 min early

      return this.accessToken;

    } catch (error) {
      console.error('[Google Meet API] Token generation error:', error);
      throw new Error(`Failed to authenticate with Google: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a Google Meet event via Google Calendar API
   */
  async createMeetEvent(
    title: string,
    description: string,
    startTime: string,
    endTime: string,
    attendeeEmails: string[] = [],
    timeZone: string = 'UTC'
  ): Promise<GoogleMeetResponse> {
    const requestId = `hoa-meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const event: GoogleMeetEvent = {
      summary: title,
      description: description,
      start: {
        dateTime: startTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endTime,
        timeZone: timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: requestId,
          conferenceSolutionKey: {
            type: 'hangoutsMeet', // Google Meet
          },
        },
      },
    };

    // Add attendees if provided
    if (attendeeEmails.length > 0) {
      event.attendees = attendeeEmails.map(email => ({
        email: email,
      }));
    }

    try {
      const accessToken = await this.getAccessToken();

      const calendarId = encodeURIComponent(this.getCalendarId());
      
      // Create the event with conference data
      const eventResponse = await fetch(`${this.baseUrl}/calendars/${calendarId}/events?conferenceDataVersion=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(event),
      });

      if (!eventResponse.ok) {
        const errorData = await eventResponse.text();
        throw new Error(`Failed to create meeting: ${eventResponse.statusText} - ${errorData}`);
      }

      const eventData = await eventResponse.json();

      return {
        id: eventData.id,
        summary: eventData.summary,
        hangoutLink: eventData.hangoutLink,
        start: eventData.start,
        end: eventData.end,
      };

    } catch (error) {
      console.error('[Google Meet API] Error:', error);
      throw new Error(`Failed to create Google Meet event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get an existing event by ID
   */
  async getEvent(eventId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const calendarId = encodeURIComponent(this.getCalendarId());
      
      const response = await fetch(`${this.baseUrl}/calendars/${calendarId}/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get event: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Google Meet API] Get event error:', error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const calendarId = encodeURIComponent(this.getCalendarId());
      
      const response = await fetch(`${this.baseUrl}/calendars/${calendarId}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete event: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[Google Meet API] Delete event error:', error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async updateEvent(eventId: string, updates: Partial<GoogleMeetEvent>): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Google Meet API] Update event error:', error);
      throw error;
    }
  }
}

// Singleton instance
let googleMeetAPI: GoogleMeetAPI | null = null;

export function getGoogleMeetAPI(): GoogleMeetAPI {
  if (!googleMeetAPI) {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error('GCS_CREDENTIALS_JSON environment variable is not set');
    }
    googleMeetAPI = new GoogleMeetAPI(credentialsJson);
  }
  return googleMeetAPI;
}

// Helper function to check if Google Meet API is configured
export function isGoogleMeetConfigured(): boolean {
  return !!process.env.GCS_CREDENTIALS_JSON;
}

// Helper function to create meeting with default settings
export async function createHOAMeeting(
  patientName: string,
  providerName: string,
  startTime: Date,
  durationMinutes: number = 30,
  patientEmail?: string,
  providerEmail?: string,
  reason?: string
): Promise<GoogleMeetResponse> {
  const api = getGoogleMeetAPI();
  
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const title = `HOA Consultation: ${providerName} & ${patientName}`;
  const description = reason 
    ? `HOA Wellness Hub consultation\nReason: ${reason}\n\nProvider: ${providerName}\nPatient: ${patientName}`
    : `HOA Wellness Hub consultation\n\nProvider: ${providerName}\nPatient: ${patientName}`;

  const attendees: string[] = [];
  if (patientEmail) attendees.push(patientEmail);
  if (providerEmail) attendees.push(providerEmail);

  return await api.createMeetEvent(
    title,
    description,
    startTime.toISOString(),
    endTime.toISOString(),
    attendees,
    'UTC' // You might want to use provider's timezone
  );
}
