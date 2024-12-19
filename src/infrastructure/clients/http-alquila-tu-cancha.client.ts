import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';

import { Club } from '../../domain/model/club';
import { Court } from '../../domain/model/court';
import { Slot } from '../../domain/model/slot';
import { AlquilaTuCanchaClient } from '../../domain/ports/aquila-tu-cancha.client';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';

@Injectable()
export class HTTPAlquilaTuCanchaClient implements AlquilaTuCanchaClient {
  private base_url: string;
  constructor(
    private httpService: HttpService,
    config: ConfigService,
    private cacheService: InMemoryCacheService,
  ) {
    this.base_url = config.get<string>('ATC_BASE_URL', 'http://localhost:4000');
  }

  async getClubs(placeId: string): Promise<Club[]> {
    const cacheKey = `clubs-${placeId}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.httpService.axiosRef.get('clubs', {
      baseURL: this.base_url,
      params: { placeId },
    }).then((res) => res.data);

    this.cacheService.set(cacheKey, data);
    return data;
  }

  async getCourts(clubId: number): Promise<Court[]> {
    const cacheKey = `courts-${clubId}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.httpService.axiosRef.get(`/clubs/${clubId}/courts`, {
      baseURL: this.base_url,
    }).then((res) => res.data);

    this.cacheService.set(cacheKey, data);
    return data;
  }

  async getAvailableSlots(
    clubId: number,
    courtId: number,
    date: Date,
  ): Promise<Slot[]> {
    // Podríamos cachear slots también, pero dado que cambian a menudo (por eventos), es menos útil
    // a menos que implementes invalidaciones más precisas.
    const dateStr = moment(date).format('YYYY-MM-DD');
    const url = `/clubs/${clubId}/courts/${courtId}/slots`;
    return this.httpService.axiosRef.get(url, {
      baseURL: this.base_url,
      params: { date: dateStr },
    }).then((res) => res.data);
  }
}
