import http from "k6/http";
import { check, sleep } from "k6";

// Load testing configuration
export const options = {
  stages: [
    { duration: "10s", target: 5 },
    { duration: "20s", target: 10 },
    { duration: "10s", target: 0 },
  ],

  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

  // Test GET employees API
  const response = http.get(`${BASE_URL}/api/employees`);

  check(response, {
    "Status is 200": (r) => r.status === 200,
    "Response time below 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
