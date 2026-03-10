// V2 Pool type classification based on factory address
// Maps factory addresses (lowercased) to pool type info

export interface V2PoolTypeInfo {
  poolType: string;
  poolTypeVersion: number;
}

// Factory address → pool type mapping (all addresses lowercased)
const FACTORY_MAP: Record<string, V2PoolTypeInfo> = {};

function addFactory(addresses: string[], poolType: string, poolTypeVersion: number) {
  for (const addr of addresses) {
    FACTORY_MAP[addr.toLowerCase()] = { poolType, poolTypeVersion };
  }
}

// Weighted pools
addFactory([
  "0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9", // mainnet WeightedPoolFactory
  "0x7dFdEF5f355096603419239CE743BfaF1120312B", // arbitrum
  "0xdAE7e32ADc5d490a43cCba1f0c736033F2b4eFca", // optimism
  "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0", // mainnet Weighted2Token
  "0xCF0a32Bbef8F064969F21f7e02328FB577382018", // arbitrum Weighted2Token
  "0x0F3e0c4218b7b0108a3643cFe9D3ec0d4F57c54e", // optimism Weighted2Token
], "Weighted", 1);

addFactory([
  "0xcC508a455F5b0073973107Db6a878DdBDab957bC", // mainnet
  "0x0e39C3D9b2ec765eFd9c5c70BB290B1fCD8536E3", // polygon
  "0x8df6EfEc5547e31B0eb7d1291B511FF8a2bf987c", // arbitrum
  "0xad901309d9e9DbC5Df19c84f729f429F0189a633", // optimism
  "0xf302f9F50958c5593770FDf4d4812309fF77414f", // gnosis
], "Weighted", 2);

addFactory([
  "0x5Dd94Da3644DDD055fcf6B3E1aa310Bb7801EB8b", // mainnet
  "0x82e4cFaef85b1B6299935340c964C942280327f4", // polygon
  "0xf1665E19bc105BE4EDD3739F88315cC699cc5b65", // arbitrum
  "0xA0DAbEBAAd1b243BBb243f933013d560819eB66f", // optimism
  "0xC128a9954e6c874eA3d62ce62B468bA073093F25", // gnosis
  "0x94f68b54191F62f781Fe8298A8A5Fa3ed772d227", // avalanche
], "Weighted", 3);

addFactory([
  "0x897888115Ada5773E02aA29F775430BFB5F34c51", // mainnet
  "0xFc8a407Bba312ac761D8BFe04CE1201904842B76", // polygon
  "0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7", // arbitrum
  "0x230a59F4d9ADc147480f03B0D3fFfeCd56c3289a", // optimism, avalanche, base
  "0x6CaD2ea22BFA7F4C14Aae92E47F510Cd5C509bc7", // gnosis
  "0x4C32a8a8fDa4E24139B51b456B42290f51d6A1c4", // base
], "Weighted", 4);

// Stable pools
addFactory([
  "0xc66Ba2B6595D3613CCab350C886aCE23866EDe24", // mainnet, polygon
  "0x2433477A10FC5d31B9513C638F19eE85CaED53Fd", // arbitrum
], "Stable", 1);

addFactory([
  "0x8df6EfEc5547e31B0eb7d1291B511FF8a2bf987c", // mainnet
  "0xcA96C4f198d343E251b1a01F3EBA061ef3DA73C1", // polygon
  "0xEF44D6786b2b4d544b7850Fe67CE6381626Bf2D6", // arbitrum
  "0xeb151668006CD04DAdD098AFd0a82e78F77076c3", // optimism
  "0xf23b4DB826DbA14c0e857029dfF076b1c0264843", // gnosis
], "Stable", 2);

// MetaStable pools
addFactory([
  "0x67d27634E44793fE63c467035E31ea8635117cd4", // mainnet
  "0xdAE7e32ADc5d490a43cCba1f0c736033F2b4eFca", // polygon (same addr different chain)
  "0xEBFD5681977E38Af65A7487DC70B8221D089cCAD", // arbitrum
  "0xb08E16cFc07C684dAA2f93C70323BAdb2A6CBFd2", // optimism
], "MetaStable", 1);

// Composable Stable pools (various versions)
addFactory([
  "0xf9ac7B9dF2b3454E841110CcE5550bD5AC6f875F", // mainnet
  "0x136FD06Fa01eCF624C7F2B3CB15742c1339dC2c4", // polygon
  "0xaEb406b0E430BF5Ea2Dc0B9Fe62E4E53f74B3a33", // arbitrum
  "0xf145caFB67081895EE80eB7c04A30Cf87f07b745", // optimism
  "0xBa1b4a90bAD57470a2cbA762A32955dC491f76e0", // mainnet HighAmp
  "0xb08E16cFc07C684dAA2f93C70323BAdb2A6CBFd2", // mainnet StablePhantom
  "0xC128a9954e6c874eA3d62ce62B468bA073093F25", // polygon StablePhantom
], "ComposableStable", 1);

addFactory([
  "0x85a80afee867aDf27B50BdB7b76DA70f1E853062", // mainnet, polygon, arbitrum, gnosis
  "0x76578ecf9a141296Ec657847fb45B0585bCDa3a6", // gnosis
], "ComposableStable", 2);

addFactory([
  "0xdba127fBc23fb20F5929C546af220A991b5C6e01", // mainnet
  "0x7bc6C0E73EDAa66eF3F6E2f27b0EE8661834c6C9", // polygon
  "0x1c99324EDC771c82A0DCCB780CC7DDA0045E50e7", // arbitrum
  "0xe2E901AB09f37884BA31622dF3Ca7FC19AA443Be", // optimism
  "0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD", // gnosis
], "ComposableStable", 3);

addFactory([
  "0xfADa0f4547AB2de89D1304A668C39B3E09Aa7c76", // mainnet
  "0x6Ab5549bBd766A43aFb687776ad8466F8b42f777", // polygon
  "0x2498A2B0d6462d2260EAC50aE1C3e03F4829BA95", // arbitrum
  "0x1802953277FD955f9a254B80Aa0582f193cF1d77", // optimism
  "0xD87F44Df0159DC78029AB9CA7D7e57E7249F5ACD", // gnosis
  "0x3B1eb8EB7b43882b385aB30533D9A2BeF9052a98", // avalanche
], "ComposableStable", 4);

addFactory([
  "0xDB8d758BCb971e482B2C45f7F8a7740283A1bd3A", // mainnet
  "0xe2fa4e1d17725e72dcdAfe943Ecf45dF4B9E285b", // polygon
  "0xA8920455934Da4D853faac1f94Fe7bEf72943eF1", // arbitrum
  "0x043A2daD730d585C44FB79D2614F295D2d625412", // optimism
  "0x4bdCc2fb18AEb9e2d281b0278D946445070EAda7", // gnosis
  "0xE42FFA682A26EF8F25891db4882932711D42e467", // avalanche
  "0x8df317a729fcaA260306d7de28888932cb579b88", // base
], "ComposableStable", 5);

addFactory([
  "0x5B42eC6D40f7B7965BE5308c70e2603c0281C1E9", // mainnet
  "0xEAedc32a51c510d35ebC11088fD5fF2b47aACF2E", // polygon
  "0x4bdCc2fb18AEb9e2d281b0278D946445070EAda7", // arbitrum (reused address)
  "0x47B489bf5836f83ABD928C316F8e39bC0587B020", // gnosis
  "0xb9F8AB3ED3F3aCBa64Bc6cd2DcA74B7F38fD7B88", // avalanche
  "0x956CCab09898C0AF2aCa5e6C229c3aD4E93d9288", // base
], "ComposableStable", 6);

// LBP pools
addFactory([
  "0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE", // mainnet, polygon
  "0x142B9666a0a3A30477b052962ddA81547E7029ab", // arbitrum
], "LiquidityBootstrapping", 1);

addFactory([
  "0x0F3e0c4218b7b0108a3643cFe9D3ec0d4F57c54e", // mainnet TempLBP
  "0x41B953164995c11C81DA73D212ED8Af25741b7Ac", // polygon
  "0x1802953277FD955f9a254B80Aa0582f193cF1d77", // arbitrum
  "0xf302f9F50958c5593770FDf4d4812309fF77414f", // optimism
  "0x85a80afee867aDf27B50BdB7b76DA70f1E853062", // gnosis
  "0x0c6052254551EAe3ECac77B01DFcf1025418828f", // base
], "LiquidityBootstrapping", 1);

// Investment pools
addFactory([
  "0x48767F9F868a4A7b86A90736632F6E44C2df7fa9", // mainnet
  "0x0f7bb7ce7b6ed9366F9b6B910AdeFE72dC538193", // polygon
  "0xaCd615B3705B9c880E4E7293f1030B34e57B4c1c", // arbitrum
], "Investment", 1);

// Managed pools
addFactory([
  "0xBF904F9F340745B4f0c4702c7B6Ab1e808eA6b93", // mainnet
  "0xB8Dfa4fd0F083de2B7EDc0D5eeD5E684e54bA45D", // polygon
  "0x8eA89804145c007e7D226001A96955ad53836087", // arbitrum
  "0x4C32a8a8fDa4E24139B51b456B42290f51d6A1c4", // optimism
  "0xDF9B5B00Ef9bca66e9902Bd813dB14e4343Be025", // gnosis
  "0x03F3Fb107e74F2EAC9358862E91ad3c692712054", // avalanche
], "Managed", 2);

// Linear pools (Aave, ERC4626, Euler, Gearbox, Silo, Yearn)
// All share similar structure — just different wrapped token types
addFactory([
  "0xD7FAD3bd59D6477cbe1BE7f646F7f1BA25b230f8", // mainnet Aave v1
  "0xf302f9F50958c5593770FDf4d4812309fF77414f", // polygon Aave v1
], "AaveLinear", 1);

// Group remaining linear pools by protocol name
const linearFactories: [string[], string, number][] = [
  // AaveLinear v2-v5
  [["0x6A0AC04f5C2A10297D5FA79FA6358837a8770041", "0x8df6EfEc5547e31B0eb7d1291B511FF8a2bf987c", "0xe2E901AB09f37884BA31622dF3Ca7FC19AA443Be", "0x994086630773dC6cB54D3A5E0Ef0963532789E75"], "AaveLinear", 2],
  [["0x7d833FEF5BB92ddb578DA85fc0c35cD5Cc00Fb3e", "0x35c425234DC42e7402f54cC54573f77842963a56", "0xa2D801064652A269D92EE2A59F3261155ec66830", "0xAd3CC7852382C09fdCE54784292c6aB7fb9Df917", "0x9dd5Db2d38b50bEF682cE532bCca5DfD203915E1"], "AaveLinear", 3],
  [["0xb9F8AB3ED3F3aCBa64Bc6cd2DcA74B7F38fD7B88", "0xf23b4DB826DbA14c0e857029dfF076b1c0264843", "0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c"], "AaveLinear", 4],
  [["0x0b576c1245F479506e7C8bbc4dB4db07C1CD31F9", "0xAB2372275809E15198A7968C7f324053867cdB0C", "0x7396f99B48e7436b152427bfA3DD6Aa8C7C6d05B", "0x62aaB12865d7281048c337D53a4dde9d770321E6", "0x6caf662b573F577DE01165d2d38D1910bba41F8A"], "AaveLinear", 5],
  // ERC4626
  [["0xE061bF85648e9FA7b59394668CfEef980aEc4c66", "0xC6bD2497332d24094eC16a7261eec5C412B5a2C1", "0x6637dA12881f66dC7E42b8879B0a79faF43C9be2", "0x2794953110874981a0d301286c986992022A62a1", "0x4C4287b07d293E361281bCeEe8715c8CDeB64E34", "0x4132f7AcC9dB7A6cF7BE2Dd3A9DC8b30C7E6E6c8"], "ERC4626Linear", 1],
  [["0x67A25ca2350Ebf4a0C475cA74C257C94a373b828", "0xa3B9515A9c557455BC53F7a535A85219b59e8B2E"], "ERC4626Linear", 3],
  [["0x813EE7a840CE909E7Fea2117A44a90b8063bd4fd", "0x5C5fCf8fBd4cd563cED27e7D066b88ee20E1867A", "0x7ADbdabaA80F654568421887c12F09E0C7BD9629", "0x4507d91Cd2C0D51D9B4F30Bf0B93AFC938A70BA5"], "ERC4626Linear", 4],
  // Euler
  [["0x5F43FBa61f63Fa6bFF101a0A0458cEA917f6B347"], "EulerLinear", 1],
  // Gearbox
  [["0x2EbE41E1aa44D61c206A94474932dADC7D3FD9E3"], "GearboxLinear", 1],
  [["0x39A79EB449Fc05C92c39aA6f0e9BfaC03BE8dE5B"], "GearboxLinear", 2],
  // Silo
  [["0xfd1c0e6f02f71842b6ffF7CdC7A017eE1Fd3CdAC"], "SiloLinear", 1],
  [["0x4E11AEec21baF1660b1a46472963cB3DA7811C89"], "SiloLinear", 2],
  // Yearn
  [["0x8b7854708c0C54f9D7d1FF351D4F84E6dE0E134C", "0x7396f99B48e7436b152427bfA3DD6Aa8C7C6d05B"], "YearnLinear", 1],
  [["0x5F5222Ffa40F2AEd6380D022184D6ea67C776eE0", "0x0b576c1245F479506e7C8bbc4dB4db07C1CD31F9"], "YearnLinear", 2],
];

for (const [addrs, poolType, version] of linearFactories) {
  addFactory(addrs, poolType, version);
}

// Convergent Curve (Element) pools
addFactory([
  "0xb7561f547F3207eDb42A6AfA42170Cd47ADD17BD", // mainnet
], "Element", 1);

// Gyro2
addFactory([
  "0x5d8545a7330245150bE0Ce88F8afB0EDc41dFc34", // polygon
  "0x579653927BF509B361F6e3813f5D4B95331d98c9", // mainnet
  "0x7a36527A02d96693b0AF2b70421F952816a4a088", // arbitrum
], "Gyro2", 1);

// Gyro3
addFactory([
  "0x90f08B3705208E41DbEEB37A42Fb628dD483AdDa", // polygon
], "Gyro3", 1);

// GyroE
addFactory([
  "0xD4204551BC5397455f8897745d50Ac4F6beE0EF6", // polygon
], "GyroE", 1);

addFactory([
  "0x412a5B2e7a678471985542757A6855847D4931D5", // mainnet
  "0x1a79A24Db0F73e9087205287761fC9C5C305926b", // polygon
  "0xdCA5f1F0d7994A32BC511e7dbA0259946653Eaf6", // arbitrum
  "0x9b683ca24b0e013512e2566b68704dbe9677413c", // optimism
  "0x15e86Be6084C6A5a8c17732D398dFbC2Ec574CEC", // base
], "GyroE", 2);

/**
 * Get pool type info from factory address and chain ID.
 * Returns default "Unknown" if factory not recognized.
 */
export function getPoolTypeFromFactory(factoryAddress: string): V2PoolTypeInfo {
  return FACTORY_MAP[factoryAddress.toLowerCase()] ?? { poolType: "Unknown", poolTypeVersion: 1 };
}

/**
 * Check if a pool type is a linear pool type
 */
export function isLinearPoolType(poolType: string): boolean {
  return poolType.endsWith("Linear");
}

/**
 * Check if a pool type has weights (Weighted, LBP, Investment, Managed)
 */
export function isWeightedPoolType(poolType: string): boolean {
  return poolType === "Weighted" || poolType === "LiquidityBootstrapping" || poolType === "Investment" || poolType === "Managed";
}

/**
 * Check if a pool type has amp parameter
 */
export function isStablePoolType(poolType: string): boolean {
  return poolType === "Stable" || poolType === "MetaStable" || poolType === "ComposableStable" || poolType === "StablePhantom";
}

/**
 * Check if a pool has variable weights that change over time (LBP, Investment, Managed).
 * These pools need weight updates after every swap.
 */
export function isVariableWeightPool(poolType: string | undefined): boolean {
  if (!poolType) return false;
  return poolType === "LiquidityBootstrapping" || poolType === "Investment" || poolType === "Managed";
}

/**
 * Check if a pool is an FX pool (Xave Finance foreign exchange pools)
 */
export function isFXPoolType(poolType: string | undefined): boolean {
  if (!poolType) return false;
  return poolType === "FX";
}
