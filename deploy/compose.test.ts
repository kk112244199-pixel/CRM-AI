import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "@hengce/domain";

function read(rel: string): string {
  return readFileSync(join(repoRoot(), rel), "utf8");
}

describe("M4 compose 形状", () => {
  it("三服务：nginx 入口、api、web 静态；volume 挂库", () => {
    const yml = read("docker-compose.yml");
    expect(yml).toMatch(/^\s+nginx:/m);
    expect(yml).toMatch(/^\s+api:/m);
    expect(yml).toMatch(/^\s+web:/m);
    expect(yml).toMatch(/hengce-data:\/data/);
    expect(yml).toMatch(/HENGCE_DB: \/data\/hengce\.db/);
    expect(yml).toMatch(/80:80/);
    expect(yml).not.toMatch(/redis/i);
    expect(yml).not.toMatch(/rabbit/i);
    expect(yml).not.toMatch(/grafana/i);
    expect(yml).not.toMatch(/prometheus/i);
    expect(yml).not.toMatch(/web-demo/);
  });

  it("入口 nginx 反代 /api 与 /，不暴露 Agent 端口", () => {
    const conf = read("deploy/nginx.conf");
    expect(conf).toMatch(/location \/api/);
    expect(conf).toMatch(/proxy_pass http:\/\/api:3001/);
    expect(conf).toMatch(/location \//);
    expect(conf).toMatch(/proxy_pass http:\/\/web:80/);
    expect(conf).not.toMatch(/:3001:3001/);
  });

  it("生产镜像不含 web-demo，api 含 runtime", () => {
    const ignore = read(".dockerignore");
    expect(ignore).toMatch(/web-demo/);
    const api = read("deploy/Dockerfile.api");
    expect(api).toMatch(/COPY runtime runtime/);
    expect(api).not.toMatch(/web-demo/);
    const web = read("deploy/Dockerfile.web");
    expect(web).toMatch(/apps\/web/);
    expect(web).not.toMatch(/web-demo/);
    expect(web).not.toMatch(/CURSOR_API_KEY/);
    expect(web).not.toMatch(/DASHSCOPE_API_KEY/);
  });

  it("密钥只进 api 环境变量", () => {
    const yml = read("docker-compose.yml");
    expect(yml).toMatch(/DASHSCOPE_API_KEY: \$\{DASHSCOPE_API_KEY:-\}/);
    expect(yml).toMatch(/CURSOR_API_KEY: \$\{CURSOR_API_KEY:-\}/);
    const nginx = read("docker-compose.yml").split("nginx:")[1] ?? "";
    expect(nginx).not.toMatch(/CURSOR_API_KEY/);
    expect(nginx).not.toMatch(/DASHSCOPE_API_KEY/);
  });
});
