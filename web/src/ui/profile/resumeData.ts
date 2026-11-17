import type {
  CareerItem,
  MemberAccountInfo,
  PortfolioItem,
} from "@/domain/member/types";

export function buildResumeData({
  careers,
  portfolios,
  account,
  showPortfolios = true,
}: {
  careers: CareerItem[];
  portfolios: PortfolioItem[];
  account?: MemberAccountInfo;
  showPortfolios?: boolean;
}) {
  return {
    careers: careers.filter((item) => item.type === "career"),
    awards: careers.filter((item) => item.type === "award"),
    portfolios: showPortfolios ? portfolios.slice(0, 3) : [],
    contact: {
      email: account?.email,
      phone: account?.phone,
    },
  };
}
