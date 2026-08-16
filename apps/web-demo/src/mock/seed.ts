import type {
  Account,
  Contact,
  DemoState,
  Lead,
  Opportunity,
  OppStage,
} from "./types";

function converted(
  lead: Lead,
  stage: OppStage,
  contactTitle: string,
): {
  lead: Lead;
  account: Account;
  contact: Contact;
  opp: Opportunity;
} {
  const accountId = `acc-${lead.id}`;
  const contactId = `ct-${lead.id}`;
  const oppId = `opp-${lead.id}`;
  return {
    lead: { ...lead, status: "已转化" },
    account: { id: accountId, name: lead.company, leadId: lead.id },
    contact: {
      id: contactId,
      accountId,
      name: lead.contactName,
      title: contactTitle,
    },
    opp: {
      id: oppId,
      accountId,
      contactId,
      leadId: lead.id,
      name: `${lead.company} / 衡策销管`,
      stage,
    },
  };
}

const RAW: Lead[] = [
  {
    id: "lead-hangchi",
    company: "杭齿精密机电",
    industry: "离散制造 / 零部件",
    status: "新线索",
    owner: "销售-陈",
    contactName: "周工",
    sourceSummary: "种子：产线 MES 对接询价",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-jiaxing",
    company: "嘉兴精工装备",
    industry: "离散制造 / 设备",
    status: "新线索",
    owner: "销售-陈",
    contactName: "沈经理",
    sourceSummary: "种子：与杭齿同属离散制造",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-chenghai",
    company: "澄海医疗器械",
    industry: "医疗流通",
    status: "新线索",
    owner: "销售-刘",
    contactName: "马采购",
    sourceSummary: "种子：经销授权续约",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-chengguo",
    company: "橙果素质教育",
    industry: "区域教培连锁",
    status: "新线索",
    owner: "未分配",
    contactName: "林校长",
    sourceSummary: "种子：待录入后走黄金切片",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-linli",
    company: "邻里鲜超市",
    industry: "生鲜连锁",
    status: "新线索",
    owner: "销售-刘",
    contactName: "何店长",
    sourceSummary: "种子：多店导购与会员",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-yedeng",
    company: "夜灯便利",
    industry: "便利店连锁",
    status: "新线索",
    owner: "销售-刘",
    contactName: "吴区经",
    sourceSummary: "种子：与邻里鲜同属连锁零售",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-haitu",
    company: "海图进出口",
    industry: "外贸",
    status: "新线索",
    owner: "销售-陈",
    contactName: "郑外贸",
    sourceSummary: "种子：刻意不像制造客户",
    lastActivity: "种子数据",
    draftIngest: "",
  },
  {
    id: "lead-jiangdong",
    company: "江东水务物资",
    industry: "市政国企采购",
    status: "新线索",
    owner: "销售-陈",
    contactName: "赵科长",
    sourceSummary: "种子：招投标周期过长",
    lastActivity: "种子数据",
    draftIngest: "",
  },
];

const PACKS = [
  converted(RAW[0]!, "方案报价", "设备工程师"),
  converted(RAW[1]!, "需求确认", "采购经理"),
  converted(RAW[2]!, "谈判", "采购"),
  { lead: RAW[3]!, account: null, contact: null, opp: null },
  converted(RAW[4]!, "方案报价", "店长"),
  converted(RAW[5]!, "需求确认", "区域经理"),
  converted(RAW[6]!, "谈判", "外贸主管"),
  converted(RAW[7]!, "丢单", "物资科长"),
];

export const SEED_LEADS: Lead[] = PACKS.map((p) => p.lead);
export const SEED_ACCOUNTS: Account[] = PACKS.flatMap((p) =>
  p.account ? [p.account] : [],
);
export const SEED_CONTACTS: Contact[] = PACKS.flatMap((p) =>
  p.contact ? [p.contact] : [],
);
export const SEED_OPPS: Opportunity[] = PACKS.flatMap((p) =>
  p.opp ? [p.opp] : [],
);

export const SIMILAR_HINTS: Record<string, string> = {
  杭齿精密机电: "嘉兴精工装备",
  邻里鲜超市: "夜灯便利",
};

export function createInitialState(): DemoState {
  return {
    role: "sales",
    seq: 1,
    leads: SEED_LEADS.map((l) => ({ ...l })),
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    contacts: SEED_CONTACTS.map((c) => ({ ...c })),
    opportunities: SEED_OPPS.map((o) => ({ ...o })),
    activities: [],
    handoffs: [],
    pendingArrival: {},
  };
}
