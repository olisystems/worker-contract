import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InputFacade } from './input/input.facade';
import { PinoLogger } from 'nestjs-pino';
import { MatchingFacade } from './matching/matching.facade';
import { BatteryService } from './matching/battery/battery.service';
import { BatteryManager } from './matching/battery/battery-manager';
import {ProportionalMatcher } from '@energyweb/algorithms';


@Injectable()
export class AppService implements OnApplicationBootstrap{

  //private logger = new PinoLogger({ renameContext: AppService.name });
  
  
  constructor(
        // private inpputFacade:InputFacade,
        //private matchingFacade:MatchingFacade,
      ) {
    }


  public onApplicationBootstrap() {
    this.startTasks();
    
  }
  public  startTasks() {
        
  }
}