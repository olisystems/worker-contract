import 'reflect-metadata'
import { appConfig } from './config/app-config'
import { NestFactory } from '@nestjs/core'
import { Worker } from '@energyweb/worker'
import { AppModule } from './app.module'
import { MatchingModule, MatchingInMemoryModule } from './matching/matching.module'
import { InputModule, InputInMemoryModule } from './input/input.module'
import { matchingResultBackendSender } from './matching/receivers/matching-result-backend.receiver'
import {ProportionalMatcher } from '@energyweb/algorithms'
import {Entity, EntityConsumption, EntityGeneration, MatchData, Match, MatchPath, MatchRoundInput, PathStrategy } from '@energyweb/algorithms/src/proportional-matcher/types'
import { EnergyType } from 'types'

const { workerBlockchainAddress, ...workerConfig } = appConfig.workerConfig
const worker = new Worker(workerConfig)
// class EntityImpl implements Entity {
//   constructor(public id: string, public volume: number, public siteId: string, public regionId: string) {
//     // Class constructor with property assignments
//   }
// }

// class EntityConsumptionImpl implements EntityConsumption {
//   constructor(
//     public id: string,
//     public volume: number,
//     public siteId: string,
//     public regionId: string,
//     public energyPriorities: { energyType: string, priority: number }[],
//     public shouldMatchByRegion: boolean
//   ) {
//     // Class constructor with property assignments
//   }
// }


worker.start(async ({ merkleTree, getVotingContract }) => {

  const workerAddress = appConfig.workerConfig.workerBlockchainAddress
  const votingContract = getVotingContract()
  // const entity: Entity = new EntityImpl('12345', 1000, '67890', 'abcd1234');
  
  // const entityConsumption: EntityConsumption = new EntityConsumptionImpl(
  //   '12345',             // id
  //   1000,                 // volume
  //   '67890',             // siteId
  //   'Bavaria',          // regionId
  //   [                    // energyPriorities
  //     { energyType: 'electricity', priority: 1 },
  //     { energyType: 'natural gas', priority: 2 }
  //   ],
  //   true                 // shouldMatchByRegion
  // );

  // console.log(entityConsumption);

  // const consumptions: EntityConsumption[] = [
  //   // Define EntityConsumption objects
  //   // ...
  // ];
  
  // const generations: EntityGeneration[] = [
  //   // Define EntityGeneration objects
  //   // ...
  // ];


  const consumers: EntityConsumption[] = [
    {
      energyPriorities: [
        { energyType: "EnergyType.Electricity", priority: 1 },
        { energyType: "EnergyType.Gas", priority: 2 }
      ],
      shouldMatchByRegion: true,
      shouldMatchByCountry: false,
      shouldMatchByOtherCountries: true,
      id: '',
      volume: 0,
      siteId: '',
      regionId: '',
      countryId: ''
    },
    {
      energyPriorities: [
        { energyType: "EnergyType.Water", priority: 1 },
        { energyType: "EnergyType.Oil", priority: 2 }
      ],
      shouldMatchByRegion: false,
      shouldMatchByCountry: true,
      shouldMatchByOtherCountries: false,
      id: '',
      volume: 0,
      siteId: '',
      regionId: '',
      countryId: ''
    }
  ];


  console.log(consumers);
  const generation: EntityGeneration = 
  {
    id: '3',
    volume: 60,
    siteId: 'site6',
    regionId: 'region6',
    energyType: '',
    countryId: ''
  }
  console.log(generation);
  // const generationArray: EntityGeneration[] = [
  //   {
  //     id: '1',
  //     volume: 100,
  //     siteId: 'site1',
  //     regionId: 'region1',
  //     energyType: EnergyType.Electricity
  //   },
  //   {
  //     id: '2',
  //     volume: 200,
  //     siteId: 'site2',
  //     regionId: 'region2',
  //     energyType: EnergyType.Gas
  //   },
  //   {
  //     id: '3',
  //     volume: 150,
  //     siteId: 'site3',
  //     regionId: 'region3',
  //     energyType: EnergyType.Water
  //   }
  // ];

  // ProportionalMatcher.Input.entityConsumption(entityConsumption

  console.log(`Worker: ${workerAddress} not registered. Registering...`)
  const tx = await votingContract.addWorker(workerAddress, {
    gasLimit: 1000000,
  })
  await tx.wait()
  console.log(`Worker: ${workerAddress} registered`)

  const tree= merkleTree.createMerkleTree(["leaves", "nodes", "las"]);

  const rootHash = tree.getHexRoot();

  

  console.log("wokers output for verification result:", tree.verify(tree.getProof(tree.getLeaf(2)) , tree.getLeaf(2), tree.getRoot()))
  //verify(proof: any[], targetNode: Buffer | string, root: Buffer | string): boolean;
  // console.log("leaves", tree.getLeaf(2));
  matchingResultBackendSender
  console.log('root hash: ' + rootHash);
  const app = await NestFactory.createApplicationContext(
    AppModule.register({
      merkleTree,
      votingContract,
    })
  )

  app.enableShutdownHooks()

  console.log(
    `${workerAddress} started on port ${appConfig.workerConfig.port}, connected to voting contract on ${appConfig.workerConfig.diamondContractAddress}`
  )
  await app.init()
})

process.on('SIGINT', () => {
  process.exit()
})
