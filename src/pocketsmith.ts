import axios, { AxiosInstance } from 'axios';
import { DateTime } from 'luxon';
import { PocketSmithEvent, Config } from './types';
import { formatDateForAPI } from './utils/dateUtils';

export class PocketSmithClient {
  private client: AxiosInstance;
  private scenarioId: string;

  constructor(config: Config) {
    this.scenarioId = config.scenarioId;
    
    this.client = axios.create({
      baseURL: 'https://api.pocketsmith.com/v2',
      headers: {
        'X-Developer-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch events for a specific date range
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of events
   */
  async fetchEvents(startDate: DateTime, endDate: DateTime): Promise<PocketSmithEvent[]> {
    try {
      const url = `/scenarios/${this.scenarioId}/events`;
      const params = {
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        per_page: 500
      };

      console.log(`Fetching events from ${params.start_date} to ${params.end_date}...`);

      const response = await this.client.get(url, { params });
      
      if (response.status !== 200) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      const events = response.data as PocketSmithEvent[];
      console.log(`Fetched ${events.length} events from API`);
      
      return events;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`API Error ${error.response.status}:`, error.response.data);
          throw new Error(`PocketSmith API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          console.error('No response received from API:', error.request);
          throw new Error('No response received from PocketSmith API');
        }
      }
      
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  /**
   * Fetch events for a specific month
   * @param year Year
   * @param month Month (1-12)
   * @returns Array of events for the month
   */
  async fetchMonthlyEvents(year: number, month: number): Promise<PocketSmithEvent[]> {
    const startDate = DateTime.fromObject(
      { year, month, day: 1 },
      { zone: 'Pacific/Auckland' }
    ).startOf('day');
    
    const endDate = startDate.endOf('month');
    
    return this.fetchEvents(startDate, endDate);
  }

  /**
   * Update an event with new data
   * @param eventId The event ID to update
   * @param updateData Partial event data to update
   * @returns Updated event
   */
  async updateEvent(eventId: string, updateData: Partial<PocketSmithEvent>): Promise<PocketSmithEvent> {
    try {
      const url = `/events/${eventId}`;
      
      console.log(`Updating event ${eventId}...`);
      
      const response = await this.client.put(url, updateData);
      
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      const updatedEvent = response.data as PocketSmithEvent;
      console.log(`✅ Successfully updated event ${eventId}`);
      
      return updatedEvent;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`API Error ${error.response.status}:`, error.response.data);
          throw new Error(`PocketSmith API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          console.error('No response received from API:', error.request);
          throw new Error('No response received from PocketSmith API');
        }
      }
      
      console.error('Error updating event:', error);
      throw error;
    }
  }
}
