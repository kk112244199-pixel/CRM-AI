/** 存活探测。业务路由见 router.ts，不在此暴露 Agent 端口。 */
export function handleHealth(url: string | undefined): {
  status: number;
  body: string;
} {
  if (url === "/api/health" || url === "/health") {
    return {
      status: 200,
      body: JSON.stringify({ ok: true, service: "hengce-api" }),
    };
  }
  return { status: 404, body: JSON.stringify({ ok: false }) };
}

