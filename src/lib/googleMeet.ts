// Google Meet link generator for HOA scheduling
// Creates instant Google Meet links without requiring OAuth

export interface GoogleMeetLink {
  url: string;
  meetingId: string;
  createdAt: Date;
}

export class GoogleMeetGenerator {
  // Generate Google Meet link using the direct URL format
  static generateMeetLink(): GoogleMeetLink {
    const meetingId = this.generateMeetingId();
    const url = `https://meet.google.com/${meetingId}`;
    
    return {
      url,
      meetingId,
      createdAt: new Date()
    };
  }

  // Generate random meeting ID (3 groups of 3 letters/digits)
  private static generateMeetingId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const groups = [];
    
    for (let i = 0; i < 3; i++) {
      let group = '';
      for (let j = 0; j < 3; j++) {
        group += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      groups.push(group);
    }
    
    return groups.join('-');
  }

  // Generate multiple links for different appointment types
  static generateMultipleLinks(count: number): GoogleMeetLink[] {
    const links: GoogleMeetLink[] = [];
    
    for (let i = 0; i < count; i++) {
      links.push(this.generateMeetLink());
    }
    
    return links;
  }

  // Validate Google Meet link format
  static isValidMeetLink(url: string): boolean {
    const meetPattern = /^https:\/\/meet\.google\.com\/[a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3}$/;
    return meetPattern.test(url);
  }

  // Extract meeting ID from Google Meet URL
  static extractMeetingId(url: string): string | null {
    const match = url.match(/https:\/\/meet\.google\.com\/([a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3})/);
    return match ? match[1] : null;
  }
}

// Default export for easy usage
export default GoogleMeetGenerator;
