export const trustLevel = (score: number) => {
  if (score >= 85) return "ELITE";
  if (score >= 70) return "STRONG";
  if (score >= 40) return "OK";
  return "WEAK";
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export interface TrustInputs {
  launchScore: number;
  launchesCount: number;
  rugsCount: number;
  complaintsCount: number;
  positiveVotes: number;
  negativeVotes: number;
  volumeSol: number;
  liquiditySol: number;
  tradesCount: number;
}

export const computeCreatorReputation = (input: Pick<TrustInputs, "launchesCount" | "rugsCount" | "complaintsCount">) => {
  const base = 50;
  const launchBonus = Math.min(20, input.launchesCount * 5);
  const rugPenalty = input.rugsCount * 35;
  const complaintPenalty = Math.min(30, input.complaintsCount * 4);
  return clamp(base + launchBonus - rugPenalty - complaintPenalty);
};

export const computeMarketHealth = (input: Pick<TrustInputs, "volumeSol" | "liquiditySol" | "tradesCount">) => {
  const liquidity = Math.min(35, Math.log10(1 + input.liquiditySol) * 18);
  const volume = Math.min(35, Math.log10(1 + input.volumeSol) * 16);
  const activity = Math.min(30, input.tradesCount * 2);
  return clamp(Math.round(liquidity + volume + activity));
};

export const computeCommunityRisk = (input: Pick<TrustInputs, "complaintsCount" | "positiveVotes" | "negativeVotes">) => {
  const votes = input.positiveVotes + input.negativeVotes;
  const voteScore = votes === 0 ? 50 : ((input.positiveVotes - input.negativeVotes) / votes) * 25 + 50;
  const complaintPenalty = Math.min(45, input.complaintsCount * 8);
  return clamp(Math.round(voteScore - complaintPenalty));
};

export const computeTrustScore = (input: TrustInputs) => {
  const creatorReputation = computeCreatorReputation(input);
  const marketHealth = computeMarketHealth(input);
  const communityRisk = computeCommunityRisk(input);
  const score = Math.round(
    input.launchScore * 0.45 +
      creatorReputation * 0.2 +
      marketHealth * 0.2 +
      communityRisk * 0.15
  );
  return {
    trustScore: clamp(score),
    trustLevel: trustLevel(score),
    launchScore: clamp(input.launchScore),
    creatorReputation,
    marketHealth,
    communityRisk,
  };
};
