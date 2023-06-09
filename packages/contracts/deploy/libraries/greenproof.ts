import { BaseContract, ethers } from "ethers";

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

export type FacetCut = {
  target: string;
  action: typeof FacetCutAction[keyof typeof FacetCutAction];
  selectors: any;
};

export function getSelectors(facet: BaseContract) {
  const signatures = Object.keys(facet.interface.functions);
  const functionHashes = signatures.reduce((hashes, fn) => {
    if (
      ![
        "init(bytes)",
        "supportsInterface(bytes4)", // defined in SolidState facet https://github.com/solidstate-network/solidstate-solidity/blob/e9f741cb1476a066ce92d39600a82dc1c9e06b7d/contracts/proxy/diamond/SolidStateDiamond.sol#L50
      ].includes(fn)
    ) {
      hashes.push(facet.interface.getSighash(fn));
    }
    return hashes;
  }, [] as string[]);

  return createSelectors(functionHashes, facet);
}

export function remove(functionsToRemove: string[]) {
  const functionHashesToRemove = functionsToRemove.map((fn) =>
    getFunctionSighash(this.contract, fn)
  );

  const selectors = this.filter(
    (functionHash: string) => !functionHashesToRemove.includes(functionHash)
  );

  return createSelectors(selectors, this.contract);
}

const createSelectors = (selectors: string[], contract: BaseContract) => {
  const anySelectors = selectors as any;
  anySelectors.remove = remove;
  anySelectors.get = get;
  anySelectors.contract = contract;
  return anySelectors;
};

export function get(functionsToResolve: string[]) {
  const functionsHashesToResolve = functionsToResolve.map((fn) =>
    getFunctionSighash(this.contract, fn)
  );

  const selectors = this.filter((functionHash: string) =>
    functionsHashesToResolve.includes(functionHash)
  );

  return createSelectors(selectors, this.contract);
}

const getFunctionSighash = (contract: BaseContract, fn: string) =>
  contract.interface.getSighash(fn);

// remove selectors using an array of signatures
export const removeSelectors = (selectors: string[], signatures: string[]) => {
  const iface = new ethers.utils.Interface(
    signatures.map((v) => "function " + v)
  );
  const hashesToRemove = signatures.map((v) => iface.getSighash(v));

  return selectors.filter((selector) => !hashesToRemove.includes(selector));
};

// find a particular address position in the return value of diamondLoupeFacet.facets()
export const findIndexOfAddressInFacets = (
  facetAddress: string,
  facets: FacetCut[]
) => facets.findIndex((cut) => cut.target === facetAddress);
