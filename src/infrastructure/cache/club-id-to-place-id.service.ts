import { Injectable } from '@nestjs/common';

@Injectable()
export class ClubIdToPlaceIdService {
  private clubToPlaceMap = new Map<number, string>();

  setMapping(clubId: number, placeId: string) {
    this.clubToPlaceMap.set(clubId, placeId);
  }

  getPlaceId(clubId: number): string | undefined {
    return this.clubToPlaceMap.get(clubId);
  }
}
