import { CORPUS, CORPUS_TITLES } from "./corpus";
import type { AppDb } from "./db";
import { DOCUMENT_KINDS, type OppStage } from "./enums";
import {
  accounts,
  activities,
  agentRuns,
  auditEvents,
  contacts,
  documents,
  handoffs,
  leads,
  opportunities,
  tokenLedger,
  users,
} from "./schema";

const T = Date.UTC(2026, 0, 15);

type ConvertedSeed = {
  leadId: string;
  company: string;
  industry: string;
  contactName: string;
  contactTitle: string;
  ownerUserId: string;
  sourceSummary: string;
  stage: OppStage;
  searchTags: string;
  activityType: "电话" | "企微" | "邮件" | "拜访";
  activityText: string;
  slug: string;
};

const CONVERTED: ConvertedSeed[] = [
  {
    leadId: "lead-hangchi",
    company: "杭齿精密机电",
    industry: "离散制造 / 零部件",
    contactName: "周工",
    contactTitle: "设备工程师",
    ownerUserId: "user-sales-chen",
    sourceSummary: "种子：产线 MES 对接询价",
    stage: "方案报价",
    searchTags: "离散制造,零部件,齿轮,齿轴,MES,产线,传动件",
    activityType: "电话",
    activityText: "电话沟通齿轴工单字段",
    slug: "hangchi",
  },
  {
    leadId: "lead-jiaxing",
    company: "嘉兴精工装备",
    industry: "离散制造 / 设备",
    contactName: "沈经理",
    contactTitle: "采购经理",
    ownerUserId: "user-sales-chen",
    sourceSummary: "种子：与杭齿同属离散制造",
    stage: "需求确认",
    searchTags: "离散制造,精工装备,齿轮箱,MES,产线,传动件",
    activityType: "企微",
    activityText: "企微对齐齿轮箱装配字段",
    slug: "jiaxing",
  },
  {
    leadId: "lead-chenghai",
    company: "澄海医疗器械",
    industry: "医疗流通",
    contactName: "马采购",
    contactTitle: "采购",
    ownerUserId: "user-sales-liu",
    sourceSummary: "种子：经销授权续约",
    stage: "谈判",
    searchTags: "医疗器械,经销授权,流通",
    activityType: "邮件",
    activityText: "邮件确认授权续约节点",
    slug: "chenghai",
  },
  {
    leadId: "lead-linli",
    company: "邻里鲜超市",
    industry: "生鲜连锁",
    contactName: "何店长",
    contactTitle: "店长",
    ownerUserId: "user-sales-liu",
    sourceSummary: "种子：多店导购与会员",
    stage: "方案报价",
    searchTags: "生鲜,门店,导购,会员,连锁零售",
    activityType: "拜访",
    activityText: "拜访门店看导购排班",
    slug: "linli",
  },
  {
    leadId: "lead-yedeng",
    company: "夜灯便利",
    industry: "便利店连锁",
    contactName: "吴区经",
    contactTitle: "区域经理",
    ownerUserId: "user-sales-liu",
    sourceSummary: "种子：与邻里鲜同属连锁零售",
    stage: "需求确认",
    searchTags: "便利店,门店,导购,会员,连锁零售",
    activityType: "电话",
    activityText: "电话对齐夜班门店会员",
    slug: "yedeng",
  },
  {
    leadId: "lead-haitu",
    company: "海图进出口",
    industry: "外贸",
    contactName: "郑外贸",
    contactTitle: "外贸主管",
    ownerUserId: "user-sales-chen",
    sourceSummary: "种子：刻意不像制造客户",
    stage: "谈判",
    searchTags: "外贸,信用证,报关,提单,FOB",
    activityType: "邮件",
    activityText: "邮件核对提单与信用证节点",
    slug: "haitu",
  },
  {
    leadId: "lead-jiangdong",
    company: "江东水务物资",
    industry: "市政国企采购",
    contactName: "赵科长",
    contactTitle: "物资科长",
    ownerUserId: "user-sales-chen",
    sourceSummary: "种子：招投标周期过长",
    stage: "丢单",
    searchTags: "市政,水务,国企,招标,投标",
    activityType: "拜访",
    activityText: "拜访后确认招标周期无法赶上演示窗口",
    slug: "jiangdong",
  },
];

export function seed(db: AppDb): void {
  db.insert(users).values([
    {
      id: "user-sales-chen",
      username: "chen.sales",
      displayName: "销售-陈",
      role: "sales",
    },
    {
      id: "user-sales-liu",
      username: "liu.sales",
      displayName: "销售-刘",
      role: "sales",
    },
    {
      id: "user-manager-zhou",
      username: "zhou.manager",
      displayName: "经理-周",
      role: "manager",
    },
    {
      id: "user-viewer-wu",
      username: "wu.viewer",
      displayName: "访客-吴",
      role: "viewer",
    },
  ]).run();

  db.insert(leads).values({
    id: "lead-chengguo",
    company: "橙果素质教育",
    industry: "区域教培连锁",
    status: "新线索",
    ownerUserId: null,
    contactName: "林校长",
    sourceSummary: "种子：待录入后走黄金切片",
    lastActivity: "种子数据",
    searchTags: "教培,校区,连锁",
    createdAt: T,
  }).run();

  for (const row of CONVERTED) {
    db.insert(leads).values({
      id: row.leadId,
      company: row.company,
      industry: row.industry,
      status: "已转化",
      ownerUserId: row.ownerUserId,
      contactName: row.contactName,
      sourceSummary: row.sourceSummary,
      lastActivity: "种子数据",
      searchTags: row.searchTags,
      createdAt: T,
    }).run();
    const accountId = `acc-${row.leadId}`;
    const contactId = `ct-${row.leadId}`;
    const oppId = `opp-${row.leadId}`;
    db.insert(accounts).values({
      id: accountId,
      name: row.company,
      leadId: row.leadId,
    }).run();
    db.insert(contacts).values({
      id: contactId,
      accountId,
      name: row.contactName,
      title: row.contactTitle,
    }).run();
    db.insert(opportunities).values({
      id: oppId,
      accountId,
      contactId,
      leadId: row.leadId,
      name: `${row.company} / 衡策销管`,
      stage: row.stage,
    }).run();
    db.insert(activities).values({
      id: `act-${row.leadId}`,
      opportunityId: oppId,
      type: row.activityType,
      text: row.activityText,
      effective: 1,
      createdAt: T,
    }).run();
  }

  const runId = "run-hangchi-seed";
  db.insert(agentRuns).values({
    id: runId,
    leadId: "lead-hangchi",
    agentId: "pipeline",
    status: "已结束",
    promptTokens: 300,
    completionTokens: 160,
    estimatedCny: 0.09,
    startedAt: T,
    endedAt: T,
  }).run();
  db.insert(handoffs).values({
    id: "h-hangchi-seed-pipeline",
    runId,
    leadId: "lead-hangchi",
    agentId: "pipeline",
    status: "已生效",
    summary: "种子回放：杭齿精密机电已转化，商机方案报价。系统分配不是销售同事。",
    hitlKind: "confirm-convert",
    proposedStage: null,
    payload: null,
    promptTokens: 300,
    completionTokens: 160,
    estimatedCny: 0.09,
    createdAt: T,
  }).run();
  db.insert(tokenLedger).values({
    id: "tok-hangchi-seed",
    runId,
    promptTokens: 300,
    completionTokens: 160,
    estimatedCny: 0.09,
    createdAt: T,
  }).run();
  db.insert(auditEvents).values({
    id: "aud-seed",
    actor: "seed",
    action: "bootstrap",
    detail: "M1 种子写入。无充值、无报价单。",
    createdAt: T,
  }).run();

  const slugOf: Record<string, string> = {
    杭齿精密机电: "hangchi",
    嘉兴精工装备: "jiaxing",
    澄海医疗器械: "chenghai",
    橙果素质教育: "chengguo",
    邻里鲜超市: "linli",
    夜灯便利: "yedeng",
    海图进出口: "haitu",
    江东水务物资: "jiangdong",
  };

  for (const [company, slug] of Object.entries(slugOf)) {
    const files = CORPUS[slug];
    if (!files) throw new Error(`缺少语料 ${slug}`);
    for (const kind of DOCUMENT_KINDS) {
      db.insert(documents).values({
        id: `doc-${slug}-${kind}`,
        company,
        slug,
        filename: `${kind}.md`,
        kind,
        title: `${company} · ${CORPUS_TITLES[kind]}`,
        content: files[kind],
      }).run();
    }
  }
}
