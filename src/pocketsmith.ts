import axios, { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import parseLinkHeader from 'parse-link-header';
import { Event, ListEventsParams } from './types';

dotenv.config();

interface PaginatedResponse<T> {
  data: T[];
  links: ReturnType<typeof parseLinkHeader>;
}

export class PocketsmithClient {
  private readonly api: AxiosInstance;
  private readonly scenarioId: string;

  constructor(apiKey: string, scenarioId: string) {
    if (!apiKey || !scenarioId) {
      throw new Error('API key and Scenario ID are required');
    }

    this.scenarioId = scenarioId;
    this.api = axios.create({
      baseURL: 'https://api.pocketsmith.com/v2',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      }
    });
  }

  private parseResponse<T>(response: AxiosResponse<T[]>): { data: T[]; links: NonNullable<ReturnType<typeof parseLinkHeader>> } {
    const linkHeader = response.headers.link as string | undefined;
    const links = parseLinkHeader(linkHeader || '') || {};
    
    return {
      data: response.data,
      links: links as NonNullable<ReturnType<typeof parseLinkHeader>>
    };
  }

  async getEventsPage(params: Omit<ListEventsParams, 'page' | 'per_page'> & { page?: number } = {}): Promise<{ events: Event[]; nextPage: number | null }> {
    const response = await this.api.get<Event[]>(
      `/scenarios/${this.scenarioId}/events`,
      { 
        params: {
          per_page: 100, // Max per page
          ...params
        } 
      }
    );

    const { links } = this.parseResponse(response);
    const nextPage = links.next?.page ? parseInt(links.next.page, 10) : null;
    
    return {
      events: response.data,
      nextPage
    };
  }

  async getAllEvents(params: Omit<ListEventsParams, 'page' | 'per_page'> = {}): Promise<Event[]> {
    let allEvents: Event[] = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const { events, nextPage } = await this.getEventsPage({
          ...params,
          page: currentPage
        });
        
        allEvents = [...allEvents, ...events];
        
        if (nextPage && nextPage > currentPage) {
          currentPage = nextPage;
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching page ${currentPage} of events:`, error);
        throw error;
      }
    }
    
    return allEvents;
  }
}

export function createPocketsmithClient(): PocketsmithClient {
  const apiKey = process.env.PS_API_KEY;
  const scenarioId = process.env.PS_SCENARIO_ID;
  
  if (!apiKey || !scenarioId) {
    throw new Error('PS_API_KEY and PS_SCENARIO_ID must be set in .env');
  }
  
  return new PocketsmithClient(apiKey, scenarioId);
}
