# 对象字段

表名英文，展示值中文。不要自造第二套公司名。

## leads

| 字段 | 说明 |
|---|---|
| company | 公司名，必须是八家字面之一 |
| industry | 行业 |
| status | `新线索` 或 `已转化` |
| owner_user_id | 系统分配写入；建档不改所有人 |
| contact_name | 线索上的联系人姓名，转化前不是 contacts 表 |
| source_summary | 来源摘要 |
| search_tags | 逗号分隔档案词，写入 sqlite-vec，不再做 SQL 重叠计数 |

## accounts / contacts / opportunities

| 表 | 要点 |
|---|---|
| accounts | `name` 与线索公司名一致；`lead_id` 唯一 |
| contacts | 挂 `account_id`；name、title |
| opportunities | 挂 account、contact、lead；`stage` 只用五阶段；`name` 形如「公司 / 衡策销管」 |

未转化线索不得有这三张行。

## 八家字面

杭齿精密机电、嘉兴精工装备、澄海医疗器械、橙果素质教育、邻里鲜超市、夜灯便利、海图进出口、江东水务物资。
