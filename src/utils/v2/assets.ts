// USDC addresses per chain — used as primary pricing reference
export const USDC_ADDRESS: Record<number, string> = {
  1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  137: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  42161: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
  100: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // WXDAI on Gnosis
  8453: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  10: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
  43114: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
};

// WETH/wrapped native addresses per chain
export const WETH_ADDRESS: Record<number, string> = {
  1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  137: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
  42161: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  100: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // WXDAI
  8453: "0x4200000000000000000000000000000000000006",
  10: "0x4200000000000000000000000000000000000006",
  43114: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
};
