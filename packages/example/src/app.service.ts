import { Injectable } from '@nestjs/common';
import { MatchingFacade } from '@energyweb/greenproof-worker';

@Injectable()
export class AppService {
  constructor(
    private matchingFacade: MatchingFacade,
  ) {}

  public async match(timestamp: Date) {
    await this.matchingFacade.match(timestamp);
  }
}
