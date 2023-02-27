import 'reflect-metadata';
import { appConfig } from './config/app-config';
import { NestFactory } from '@nestjs/core';
import { GreenProofWorker } from '@energyweb/greenproof-worker';
import { AppModule } from './app.module';


const { workerBlockchainAddress, ...workerConfig } = appConfig.workerConfig;
const worker = new GreenProofWorker(workerConfig);

worker.start(async ({ merkleTree, getVotingContract }) => {
  const workerAddress = appConfig.workerConfig.workerBlockchainAddress;
  const votingContract = getVotingContract();

  const isWorker = await votingContract.isWorker(workerAddress, { gasLimit: 1000000 });
  if (!isWorker) {
    console.log(`Worker: ${workerAddress} not registered. Registering...`);
    const tx = await votingContract.addWorker(workerAddress, { gasLimit: 1000000 });
    await tx.wait();
    console.log(`Worker: ${workerAddress} registered`);
  }

  const app = await NestFactory.createApplicationContext(
    AppModule.register({
      merkleTree,
      votingContract,
    }),
  );

  app.enableShutdownHooks();

  console.log(`${workerAddress} started on port ${ appConfig.workerConfig.port }, connected to voting contract on ${ appConfig.workerConfig.diamondContractAddress }`);
  await app.init();
});

process.on('SIGINT', () => {
  process.exit();
});
