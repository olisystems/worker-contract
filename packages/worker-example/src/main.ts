import 'reflect-metadata'
import { appConfig } from './config/app-config'
import { NestFactory } from '@nestjs/core'
import { Worker } from '@energyweb/worker'
import { AppModule } from './app.module'

const { workerBlockchainAddress, ...workerConfig } = appConfig.workerConfig
const worker = new Worker(workerConfig)

worker.start(async ({ merkleTree, getVotingContract }) => {
  const workerAddress = appConfig.workerConfig.workerBlockchainAddress
  const votingContract = getVotingContract()

  console.log(`Worker: ${workerAddress} not registered. Registering...`)
  const tx = await votingContract.addWorker(workerAddress, {
    gasLimit: 1000000,
  })
  await tx.wait()
  console.log(`Worker: ${workerAddress} registered`)


  const tree= merkleTree.createMerkleTree(["leaves", "nodes", "las"]);

  const rootHash = tree.getHexRoot();
  

  console.log("wokers output for verification result:", tree.verify(tree.getProof(tree.getLeaf(2)) ,tree.getLeaf(2), tree.getRoot()))
  //verify(proof: any[], targetNode: Buffer | string, root: Buffer | string): boolean;
  console.log("leaves", tree.getLeaf(2));
  console.log('root hash: ' + rootHash);
  // const app = await NestFactory.createApplicationContext(
  //   AppModule.register({
  //     merkleTree,
  //     votingContract,
  //   })
  // )

  // app.enableShutdownHooks()

  console.log(
    `${workerAddress} started on port ${appConfig.workerConfig.port}, connected to voting contract on ${appConfig.workerConfig.diamondContractAddress}`
  )
  // await app.init()
})

process.on('SIGINT', () => {
  process.exit()
})
