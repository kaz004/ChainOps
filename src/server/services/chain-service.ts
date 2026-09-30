import type { ChainProvider, ChainSnapshot } from "@/server/core/ports/chain-provider";
import { NotFoundError } from "@/server/core/errors";

export type ChainWithProviders = ChainSnapshot;

export class ChainService {
  constructor(private readonly provider: ChainProvider) {}

  list(): ChainWithProviders[] { return this.provider.list(); }

  get(idOrNetwork: string): ChainWithProviders {
    const found = this.provider.get(idOrNetwork);
    if (!found) throw new NotFoundError("Chain", idOrNetwork);
    return found;
  }
}
