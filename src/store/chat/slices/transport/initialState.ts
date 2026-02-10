export interface TransportState {
  input: string;
  wsConnected: boolean;
}

export const initialTransportState: TransportState = {
  input: "",
  wsConnected: false,
};
