import { Body, Controller, Post } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { UseZodGuard } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';
import { ClubUpdatedEvent } from '../../domain/events/club-updated.event';
import { CourtUpdatedEvent } from '../../domain/events/court-updated.event';
import { SlotBookedEvent } from '../../domain/events/slot-booked.event';
import { SlotAvailableEvent } from '../../domain/events/slot-cancelled.event';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';
import { ClubIdToPlaceIdService } from '../cache/club-id-to-place-id.service';
import * as moment from 'moment';

const SlotSchema = z.object({
  price: z.number(),
  duration: z.number(),
  datetime: z.string(),
  start: z.string(),
  end: z.string(),
  _priority: z.number(),
});

export const ExternalEventSchema = z.union([
  z.object({
    type: z.enum(['booking_cancelled', 'booking_created']),
    clubId: z.number().int(),
    courtId: z.number().int(),
    slot: SlotSchema,
  }),
  z.object({
    type: z.literal('club_updated'),
    clubId: z.number().int(),
    fields: z.array(
      z.enum(['attributes', 'openhours', 'logo_url', 'background_url']),
    ),
  }),
  z.object({
    type: z.literal('court_updated'),
    clubId: z.number().int(),
    courtId: z.number().int(),
    fields: z.array(z.enum(['attributes', 'name'])),
  }),
]);

export type ExternalEventDTO = z.infer<typeof ExternalEventSchema>;

@Controller('events')
export class EventsController {
  constructor(
    private eventBus: EventBus,
    private cacheService: InMemoryCacheService,
    private clubIdToPlaceIdService: ClubIdToPlaceIdService,
  ) {}

  @Post()
  @UseZodGuard('body', ExternalEventSchema)
  async receiveEvent(@Body() externalEvent: ExternalEventDTO) {
    // Antes invalidabas todo. Ahora serás más específico.
    // Para booking_created o cancelled:
    if (externalEvent.type === 'booking_created' || externalEvent.type === 'booking_cancelled') {
      const placeId = this.clubIdToPlaceIdService.getPlaceId(externalEvent.clubId);
      if (placeId) {
        // Extraer la fecha del slot
        const eventDate = moment(externalEvent.slot.datetime).format('YYYY-MM-DD');
        const cacheKey = `${placeId}-${eventDate}`;
        this.cacheService.delete(cacheKey);
      }
    } else if (externalEvent.type === 'club_updated' || externalEvent.type === 'court_updated') {
      const placeId = this.clubIdToPlaceIdService.getPlaceId(externalEvent.clubId);
      if (placeId) {
        // Si afecta openhours (disponibilidad), invalida las entradas de esa semana.
        // Como asunción: solo invalidamos 7 días (según el enunciado se consultan 7 días próximos)
        // Esto es un ejemplo, puedes adaptarlo.
        for (let i = 0; i < 7; i++) {
          const dateStr = moment().add(i, 'days').format('YYYY-MM-DD');
          const cacheKey = `${placeId}-${dateStr}`;
          this.cacheService.delete(cacheKey);
        }
      }
    }

    switch (externalEvent.type) {
      case 'booking_created':
        this.eventBus.publish(
          new SlotBookedEvent(
            externalEvent.clubId,
            externalEvent.courtId,
            externalEvent.slot,
          ),
        );
        break;
      case 'booking_cancelled':
        this.eventBus.publish(
          new SlotAvailableEvent(
            externalEvent.clubId,
            externalEvent.courtId,
            externalEvent.slot,
          ),
        );
        break;
      case 'club_updated':
        this.eventBus.publish(
          new ClubUpdatedEvent(externalEvent.clubId, externalEvent.fields),
        );
        break;
      case 'court_updated':
        this.eventBus.publish(
          new CourtUpdatedEvent(
            externalEvent.clubId,
            externalEvent.courtId,
            externalEvent.fields,
          ),
        );
        break;
    }
  }
}
