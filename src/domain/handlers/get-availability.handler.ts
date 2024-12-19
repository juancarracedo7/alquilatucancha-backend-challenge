import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InMemoryCacheService } from '../../infrastructure/cache/in-memory-cache.service';
import { ClubIdToPlaceIdService } from '../../infrastructure/cache/club-id-to-place-id.service';
import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler implements IQueryHandler<GetAvailabilityQuery> {
  private readonly logger = new Logger(GetAvailabilityHandler.name);

  constructor(
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private alquilaTuCanchaClient: AlquilaTuCanchaClient,
    private cacheService: InMemoryCacheService,
    private clubIdToPlaceIdService: ClubIdToPlaceIdService, // Inyectamos el nuevo servicio
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<ClubWithAvailability[]> {
    const dateStr = query.date.toISOString().slice(0, 10);
    const cacheKey = `${query.placeId}-${dateStr}`;
    this.logger.debug(`Executing GetAvailabilityHandler with cacheKey: ${cacheKey}`);

    const cachedData = this.cacheService.get(cacheKey);
    if (cachedData) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return cachedData;
    }

    this.logger.debug(`Cache miss for key: ${cacheKey}, fetching from mock API...`);

    const clubs_with_availability: ClubWithAvailability[] = [];
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);

    // Guardar mapeo clubId → placeId
    for (const club of clubs) {
      this.clubIdToPlaceIdService.setMapping(club.id, query.placeId);
    }

    for (const club of clubs) {
      const courts = await this.alquilaTuCanchaClient.getCourts(club.id);
      const courts_with_availability: ClubWithAvailability['courts'] = [];
      for (const court of courts) {
        const slots = await this.alquilaTuCanchaClient.getAvailableSlots(
          club.id,
          court.id,
          query.date,
        );
        courts_with_availability.push({
          ...court,
          available: slots,
        });
      }
      clubs_with_availability.push({
        ...club,
        courts: courts_with_availability,
      });
    }

    this.cacheService.set(cacheKey, clubs_with_availability);
    this.logger.debug(`Data cached for key: ${cacheKey}`);

    return clubs_with_availability;
  }
}
