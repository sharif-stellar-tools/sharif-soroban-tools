import { CoreEngine } from '../core/engine';
import { StellarEnvelope } from '../core/transaction';

export interface ApiRequest {
  envelope: StellarEnvelope;
  baseFee?: number;
}

export interface ApiResponse {
  success: boolean;
  reason?: string;
}

const engine = new CoreEngine();

export const router = {
  handle: async (req: ApiRequest): Promise<ApiResponse> => {
    return engine.submitEnvelope(req.envelope, req.baseFee);
  },
};
