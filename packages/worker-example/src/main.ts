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
import { PinoLogger } from 'nestjs-pino';
import { formatBytes32String } from 'ethers/lib/utils'
import { BytesLike } from "@ethersproject/bytes"; // Assuming you're using the ethers.js library


const { workerBlockchainAddress, ...workerConfig } = appConfig.workerConfig;
const worker = new Worker(workerConfig);
const logger = new PinoLogger({ renameContext: 'matchingResultVotingContractSender' });

async function stringToBytesLike(input: string): Promise<BytesLike> {
  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(input);
  const bytesLike: BytesLike = Uint8Array.from(encodedBytes);
  return bytesLike;
}

type PromiseOrValue<T> = T | Promise<T>;

function convertStringToPromiseOrValue(input: string, shouldReturnPromise: boolean): PromiseOrValue<string> {
  if (shouldReturnPromise) {
    return new Promise((resolve) => {
      resolve(input);
    });
  } else {
    return input;
  }
}


worker.start(async ({ merkleTree, getVotingContract }) => {
  
  const workerAddress = appConfig.workerConfig.workerBlockchainAddress
  const votingContract = getVotingContract()

  
  const consumers: EntityConsumption[] = [
    {
      energyPriorities: [
        { energyType: "electric", priority: 1 },
        { energyType: "EnergyType.Gas", priority: 2 }
      ],
      shouldMatchByRegion: false,
      shouldMatchByCountry: false,
      shouldMatchByOtherCountries: false,
      id: '2',
      volume: 10,
      siteId: '3',
      regionId: '1',
      countryId: '2'
    },
    {
      energyPriorities: [
        { energyType: "EnergyType.Water", priority: 1 },
        { energyType: "oil", priority: 2 }
      ],
      shouldMatchByRegion: false,
      shouldMatchByCountry: true,
      shouldMatchByOtherCountries: false,
      id: '1',
      volume: 20,
      siteId: '2',
      regionId: '1',
      countryId: '1'
    }
  ];
  console.log(consumers);

  const generations: EntityGeneration[] = 
  [
    {
      id: '3',
      volume: 60,
      siteId: 'site6',
      regionId: 'region6',
      energyType: 'electric',
      countryId: '2'
    },
    {
      id: '4',
      volume: 60,
      siteId: 'site5',
      regionId: 'region5',
      energyType: 'oil',
      countryId: '1'
    },
  ]
  console.log(generations);

  const input: ProportionalMatcher.Input = {
    consumptions: consumers,
    generations: generations
  };

  const match: ProportionalMatcher.Result = await ProportionalMatcher.match(input);

  console.log("match result", match);
  console.log(`Worker: ${workerAddress} not registered. Registering...`)
  const tx = await votingContract.addWorker(workerAddress, {
    gasLimit: 1000000,
  })
  await tx.wait()
  console.log(`Worker: ${workerAddress} registered`)


  console.log("matches1:  " + match.matches.length);

  const matchingTree = merkleTree.createMerkleTree([match + ""]);

  const matchingRootHash = matchingTree.getHexRoot();

  const inputHash = merkleTree.hash(matchingRootHash);

  

  const tree = merkleTree.createMerkleTree(["leaves", "nodes", "las"]);

  const shouldReturnPromise = true; // Set to true for a Promise, or false for a value

  const result = convertStringToPromiseOrValue(inputHash + "", shouldReturnPromise);

  

  //const data = formatBytes32String(inputHash.toString() +"");
  const votingId = stringToBytesLike("input");

  await votingContract.vote(votingId + "", result + "", { gasLimit: 1000000 });

  const rootHash = tree.getHexRoot();

  

  console.log("wokers output for verification result:", tree.verify(tree.getProof(tree.getLeaf(2)) , tree.getLeaf(2), tree.getRoot()))
  

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
